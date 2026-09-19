// ====================================================================
// 出站连接管理器
// 企业库存同步平台 - 仓库节点连接建立与管理
// 负责 TCP 连接建立、超时控制、Keepalive 配置、连接状态跟踪
// ====================================================================

const net = require('net');
const logger = require('../logger');
const { maskAddress } = require('../logger');
const { dnsCache } = require('../dns-cache');

/**
 * 连接状态枚举
 */
const ConnectionState = {
    IDLE: 'idle',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    CLOSED: 'closed',
    ERROR: 'error'
};

/**
 * 连接配置常量
 */
const ConnectionConfig = {
    CONNECT_TIMEOUT_MS: 10000,       // 连接建立超时（10秒）
    KEEPALIVE_INITIAL_DELAY: 30000,  // Keepalive 初始探针延迟（30秒）
    IDLE_TIMEOUT_MS: 300000,          // 空闲超时（5分钟）
    FIRST_BYTE_TIMEOUT_MS: 10000      // 首字节超时（10秒）
};

/**
 * 错误分类：判断是否为可重试的连接错误
 */
function isRetryableError(err) {
    return err.code === 'ECONNREFUSED' ||
           err.code === 'ETIMEDOUT' ||
           err.code === 'EHOSTUNREACH' ||
           err.code === 'ENETUNREACH' ||
           err.code === 'EAI_AGAIN' ||
           err.code === 'ECONNRESET';
}

/**
 * 错误描述映射
 */
function describeError(err) {
    const descriptions = {
        'ECONNREFUSED': 'Connection refused (target port not open)',
        'ETIMEDOUT': 'Connection timed out',
        'EHOSTUNREACH': 'Host unreachable',
        'ENETUNREACH': 'Network unreachable',
        'EAI_AGAIN': 'DNS lookup temporary failure',
        'ECONNRESET': 'Connection reset by peer',
        'EPIPE': 'Broken pipe',
        'ENOTFOUND': 'DNS lookup failed',
        'EACCES': 'Permission denied'
    };
    return descriptions[err.code] || err.message;
}

/**
 * 出站连接类
 * 封装一个到仓库节点的 TCP 连接
 */
class UpstreamConnection {
    constructor(options) {
        this.targetHost = options.targetHost;
        this.targetPort = options.targetPort;
        this.connectOptions = options.connectOptions || {};
        this.socket = null;
        this.state = ConnectionState.IDLE;
        this.connectedAt = null;
        this.bytesWritten = 0;
        this.bytesRead = 0;
        this.firstByteReceived = false;
        this._firstByteTimer = null;
        this._connectTimer = null;
        this._connectReject = null;
    }

    /**
     * 建立连接（带DNS缓存优化）
     * @returns {Promise<net.Socket>} 连接成功的 socket
     */
    async connect() {
        this.state = ConnectionState.CONNECTING;

        // DNS 缓存优化：优先使用缓存的IP地址
        let connectHost = this.targetHost;
        let blocked = false;
        try {
            const cachedIp = await dnsCache.resolve(this.targetHost);
            if (cachedIp && cachedIp !== this.targetHost) {
                // SSRF 防护：检查解析后的IP是否是保留地址
                const { isReservedAddress } = require('../security');
                if (isReservedAddress(cachedIp)) {
                    logger.warn(`Blocked reserved address: ${cachedIp} (from ${this.targetHost})`);
                    blocked = true;
                } else {
                    connectHost = cachedIp;
                    logger.debug(`DNS cache hit: ${maskAddress(this.targetHost)} -> ${cachedIp}`);
                }
            }
        } catch (e) {
            // DNS解析失败，使用原域名让net.createConnection处理
            logger.debug(`DNS cache miss, using original host: ${maskAddress(this.targetHost)}`);
        }

        // 如果被SSRF拦截，直接拒绝连接
        if (blocked) {
            return Promise.reject(new Error('EACCES: Reserved address blocked'));
        }

        return new Promise((resolve, reject) => {
            // 保存 reject 句柄，供 destroy() 在外部销毁时强制 reject 悬挂的 Promise
            this._connectReject = reject;

            const options = { ...this.connectOptions, host: connectHost };
            const socket = net.createConnection(options);
            this.socket = socket;

            // 连接超时
            this._connectTimer = setTimeout(() => {
                socket.destroy();
                this._connectReject = null;
                reject(Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' }));
            }, ConnectionConfig.CONNECT_TIMEOUT_MS);

            socket.once('connect', () => {
                clearTimeout(this._connectTimer);
                this._connectReject = null;
                this.state = ConnectionState.CONNECTED;
                this.connectedAt = Date.now();

                // 配置 TCP_NODELAY（禁用 Nagle 算法，降低延迟）
                socket.setNoDelay(true);

                // 配置 Keepalive
                socket.setKeepAlive(true, ConnectionConfig.KEEPALIVE_INITIAL_DELAY);

                // 首字节超时
                this._startFirstByteTimer();

                logger.debug(`Node connected: ${maskAddress(this.targetHost)}:${this.targetPort}`);
                resolve(socket);
            });

            socket.once('error', (err) => {
                clearTimeout(this._connectTimer);
                this._clearFirstByteTimer();
                this._connectReject = null;
                this.state = ConnectionState.ERROR;
                reject(err);
            });
        });
    }

    /**
     * 启动首字节超时计时器
     */
    _startFirstByteTimer() {
        // 透传代理不假设服务端先说话：客户端先发、长轮询、慢 LB 等场景均合法
        // 保留方法签名以维持调用链完整性，但不启动实际超时计时器
        this._firstByteTimer = null;
    }

    /**
     * 清除首字节超时计时器
     */
    _clearFirstByteTimer() {
        if (this._firstByteTimer) {
            clearTimeout(this._firstByteTimer);
            this._firstByteTimer = null;
        }
    }

    /**
     * 写入数据
     */
    write(data) {
        if (!this.socket || this.state !== ConnectionState.CONNECTED) {
            return false;
        }
        this.bytesWritten += data.length;
        return this.socket.write(data);
    }

    /**
     * 记录读取的数据
     */
    recordRead(bytes) {
        this.bytesRead += bytes;
        if (!this.firstByteReceived) {
            this.firstByteReceived = true;
            this._clearFirstByteTimer();
        }
    }

    /**
     * 半关闭（发送 FIN）
     */
    end() {
        if (this.socket && this.state === ConnectionState.CONNECTED) {
            this.socket.end();
        }
    }

    /**
     * 销毁连接
     */
    destroy() {
        this._clearFirstByteTimer();
        if (this._connectTimer) {
            clearTimeout(this._connectTimer);
            this._connectTimer = null;
        }
        // 如果有悬挂的 connect Promise，强制 reject 防止永久悬挂
        if (this._connectReject) {
            const pendingReject = this._connectReject;
            this._connectReject = null;
            this.state = ConnectionState.CLOSED;
            try {
                pendingReject(new Error('Connection destroyed before connect'));
            } catch (e) {}
        }
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        this.state = ConnectionState.CLOSED;
    }

    /**
     * 获取连接统计
     */
    getStats() {
        return {
            state: this.state,
            target: `${maskAddress(this.targetHost)}:${this.targetPort}`,
            connectedAt: this.connectedAt ? new Date(this.connectedAt).toISOString() : null,
            durationMs: this.connectedAt ? Date.now() - this.connectedAt : 0,
            bytesWritten: this.bytesWritten,
            bytesRead: this.bytesRead,
            firstByteReceived: this.firstByteReceived
        };
    }
}

/**
 * 出站连接工厂
 * 创建和管理出站连接
 */
class UpstreamConnector {
    constructor() {
        this.connections = new Set();
        this.totalCreated = 0;
        this.totalFailed = 0;
    }

    /**
     * 创建新连接
     */
    create(options) {
        const conn = new UpstreamConnection(options);
        this.connections.add(conn);
        this.totalCreated++;
        return conn;
    }

    /**
     * 移除连接
     */
    remove(conn) {
        this.connections.delete(conn);
    }

    /**
     * 获取活跃连接数
     */
    get activeCount() {
        return this.connections.size;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            active: this.activeCount,
            totalCreated: this.totalCreated,
            totalFailed: this.totalFailed,
            states: [...this.connections].reduce((acc, c) => {
                acc[c.state] = (acc[c.state] || 0) + 1;
                return acc;
            }, {})
        };
    }
}

// 全局连接器实例
const upstreamConnector = new UpstreamConnector();

module.exports = {
    ConnectionState,
    ConnectionConfig,
    isRetryableError,
    describeError,
    UpstreamConnection,
    UpstreamConnector,
    upstreamConnector
};
