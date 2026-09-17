// ====================================================================
// 数据报转发器（UDP）
// 企业库存同步平台 - 数据报模式路由
// 负责 UDP 数据包的封装、解析、转发
// ====================================================================

const dgram = require('dgram');
const logger = require('../logger');
const { maskAddress } = require('../logger');

/**
 * 数据报配置
 */
const DatagramConfig = {
    MAX_PACKET_SIZE: 65536,     // 最大数据包大小
    SOCKET_TIMEOUT_MS: 30000,   // Socket 超时（30秒）
    DNS_PORT: 53                 // DNS 端口
};

/**
 * 数据包类
 * 封装一个 UDP 数据包
 */
class DatagramPacket {
    constructor(data, address, port) {
        this.data = data;      // Buffer
        this.address = address;
        this.port = port;
        this.createdAt = Date.now();
        this.id = DatagramPacket._nextId++;
    }

    /**
     * 获取数据包大小
     */
    get size() {
        return this.data.length;
    }

    /**
     * 是否为 DNS 查询
     */
    get isDns() {
        return this.port === DatagramConfig.DNS_PORT;
    }

    /**
     * 转换为日志格式
     */
    toLogFormat() {
        return {
            id: this.id,
            size: this.size,
            target: `${maskAddress(this.address)}:${this.port}`,
            isDns: this.isDns
        };
    }
}
DatagramPacket._nextId = 1;

/**
 * 数据包队列类
 * 管理待发送的数据包队列
 */
class PacketQueue {
    constructor(maxSize = DatagramConfig.MAX_PACKET_SIZE) {
        this.packets = [];
        this.maxSize = maxSize;
        this.totalBytes = 0;
        this.totalEnqueued = 0;
        this.totalDropped = 0;
    }

    /**
     * 入队数据包
     * @returns {boolean} 是否成功
     */
    enqueue(packet) {
        if (this.totalBytes + packet.size > this.maxSize) {
            this.totalDropped++;
            return false;
        }
        this.packets.push(packet);
        this.totalBytes += packet.size;
        this.totalEnqueued++;
        return true;
    }

    /**
     * 出队数据包
     * @returns {DatagramPacket|null}
     */
    dequeue() {
        const packet = this.packets.shift();
        if (packet) {
            this.totalBytes -= packet.size;
        }
        return packet;
    }

    /**
     * 查看队首数据包
     */
    peek() {
        return this.packets[0] || null;
    }

    /**
     * 队列是否为空
     */
    get isEmpty() {
        return this.packets.length === 0;
    }

    /**
     * 获取队列长度
     */
    get length() {
        return this.packets.length;
    }

    /**
     * 清空队列
     */
    clear() {
        this.packets = [];
        this.totalBytes = 0;
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            pending: this.packets.length,
            totalBytes: this.totalBytes,
            totalEnqueued: this.totalEnqueued,
            totalDropped: this.totalDropped
        };
    }
}

/**
 * 数据报转发器类
 * 管理 UDP Socket 和数据包转发
 */
class DatagramForwarder {
    constructor(ws, targetHost, targetPort) {
        this.ws = ws;
        this.targetHost = targetHost;
        this.targetPort = targetPort;
        this.socket = null;
        this.isDestroyed = false;
        this.stats = {
            packetsSent: 0,
            packetsReceived: 0,
            bytesSent: 0,
            bytesReceived: 0,
            errors: 0
        };

        this._createSocket();
    }

    /**
     * 创建 UDP Socket
     */
    _createSocket() {
        this.socket = dgram.createSocket('udp4');

        this.socket.on('message', (msg, rinfo) => {
            this._onMessage(msg, rinfo);
        });

        this.socket.on('error', (err) => {
            this.stats.errors++;
            logger.debug(`Datagram socket error: ${err.message}`);
        });

        this.socket.on('close', () => {
            logger.debug(`Datagram socket closed`);
        });

        // 设置超时
        this.socket.setTimeout && this.socket.setTimeout(DatagramConfig.SOCKET_TIMEOUT_MS);
    }

    /**
     * 收到上游数据
     */
    _onMessage(msg, rinfo) {
        if (this.isDestroyed) return;

        this.stats.packetsReceived++;
        this.stats.bytesReceived += msg.length;

        // 封装为 VLESS UDP 格式：2字节长度 + 数据
        const lengthBuf = Buffer.alloc(2);
        lengthBuf.writeUInt16BE(msg.length);
        const framed = Buffer.concat([lengthBuf, msg]);

        // 完全透传：直接 ws.send
        if (this.ws.readyState === 1) {
            this.ws.send(framed);
        }
    }

    /**
     * 发送数据包
     */
    send(data) {
        if (this.isDestroyed || !this.socket) return false;

        this.socket.send(data, this.targetPort, this.targetHost, (err) => {
            if (err) {
                this.stats.errors++;
                logger.debug(`Datagram send error: ${err.message}`);
            }
        });

        this.stats.packetsSent++;
        this.stats.bytesSent += data.length;
        return true;
    }

    /**
     * 销毁转发器
     */
    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        if (this.socket) {
            try {
                this.socket.close();
            } catch (e) {
                // 忽略
            }
            this.socket = null;
        }
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            target: `${maskAddress(this.targetHost)}:${this.targetPort}`,
            ...this.stats,
            destroyed: this.isDestroyed
        };
    }
}

/**
 * 创建数据报转发器
 * @param {WebSocket} ws - WebSocket 连接
 * @param {string} targetHost - 目标主机
 * @param {number} targetPort - 目标端口
 * @returns {DatagramForwarder}
 */
function createDatagramForwarder(ws, targetHost, targetPort) {
    return new DatagramForwarder(ws, targetHost, targetPort);
}

/**
 * 处理数据包队列
 * 从缓冲区中解析 VLESS UDP 帧并发送
 * @param {Object} state - 状态对象 { buffer }
 * @param {DatagramForwarder} forwarder - 转发器
 */
function processPacketQueue(state, forwarder) {
    if (!state || !state.buffer || state.buffer.length < 2) return;

    let offset = 0;
    while (offset + 2 <= state.buffer.length) {
        const packetLength = state.buffer.readUInt16BE(offset);
        if (offset + 2 + packetLength > state.buffer.length) break;

        const packetData = state.buffer.subarray(offset + 2, offset + 2 + packetLength);
        forwarder.send(packetData);
        offset += 2 + packetLength;
    }

    // 保留未处理的数据
    if (offset > 0) {
        state.buffer = state.buffer.subarray(offset);
    }
}

// 兼容旧接口
const createUdpForwarder = createDatagramForwarder;

module.exports = {
    DatagramConfig,
    DatagramPacket,
    PacketQueue,
    DatagramForwarder,
    createDatagramForwarder,
    createUdpForwarder,  // 兼容旧接口
    processPacketQueue
};
