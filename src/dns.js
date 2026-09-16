// ====================================================================
// 遥测数据解析模块
// 负责数据包队列处理与 UDP 端点直接转发
// ====================================================================

const dgram = require('dgram');
const logger = require('./logger');

// 创建 UDP 转发器：直接将数据包转发到目标地址，接收响应后回传客户端
function createUdpForwarder(ws, targetHost, targetPort) {
    const socket = dgram.createSocket('udp4');
    let closed = false;

    // 上游响应 → 客户端（封装为 2字节长度 + 数据体）
    socket.on('message', (msg) => {
        if (closed || ws.readyState !== ws.OPEN) return;
        const frame = Buffer.alloc(2 + msg.length);
        frame[0] = msg.length >> 8;
        frame[1] = msg.length & 0xFF;
        frame.set(msg, 2);
        ws.send(frame);
    });

    socket.on('error', (err) => {
        logger.debug(`UDP forwarder error: ${targetHost}:${targetPort} - ${err.message}`);
    });

    return {
        send: (data) => {
            if (closed) return;
            socket.send(data, targetPort, targetHost, (err) => {
                if (err) logger.debug(`UDP send error: ${err.message}`);
            });
        },
        destroy: () => {
            closed = true;
            try { socket.close(); } catch (e) {}
        }
    };
}

// 处理数据包队列（帧格式：2字节长度 + 数据体）
function processPacketQueue(packetState, forwarder) {
    while (packetState.buffer.length >= 2) {
        const len = (packetState.buffer[0] << 8) | packetState.buffer[1];

        if (len <= 0 || len > 65535) {
            // 无效长度，丢弃缓冲
            packetState.buffer = Buffer.alloc(0);
            break;
        }

        if (packetState.buffer.length >= 2 + len) {
            const payload = packetState.buffer.subarray(2, 2 + len);
            packetState.buffer = packetState.buffer.subarray(2 + len);
            forwarder.send(payload);
        } else {
            break; // 数据不完整，等待更多
        }
    }
}

module.exports = { createUdpForwarder, processPacketQueue };
