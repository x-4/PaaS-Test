// ====================================================================
// 实时数据同步引擎
// 负责 WebSocket 长连接管理、数据帧解析、上游通道建立与双向数据流转
// ====================================================================

const net = require('net');
const { WebSocketServer } = require('ws');
const { CONFIG } = require('./config');
const logger = require('./logger');
const { parseFrameHeader, parseTargetAddress } = require('./protocol');
const { processPacketQueue } = require('./dns');
const { sendObfuscated, createInboundObfuscator, isObfuscateEnabled } = require('./obfuscate');
const { getPlatformConfig } = require('./platform');
const {
    isReservedAddress,
    resolveEndpoint,
    isClientBlocked,
    recordAuthEvent,
    clearAuthEvents,
    getClientAddress,
    isIpConnectionLimitReached,
    incrementConnection,
    decrementConnection
} = require('./security');

// 平台自适应配置
const platformConfig = getPlatformConfig();

// 全局活跃连接集合（用于优雅关闭和连接数管理）
const activeConnections = new Set();
let isShuttingDown = false;

function createTransportServer() {
    const wss = new WebSocketServer({
        noServer: true,
        handleProtocols: (protocols) => protocols[0] || false,
        // 二进制数据传输优化：关闭压缩与文本校验
        perMessageDeflate: false,
        skipUTF8Validation: true,
        maxPayload: 64 * 1024 * 1024
    });

    wss.on('connection', (ws, req) => {
        // 关闭期间拒绝新连接
        if (isShuttingDown) {
            ws.close(1001, 'Server shutting down');
            return;
        }

        // 客户端地址（用于访问控制）
        const clientAddr = getClientAddress(req);

        // 访问限制检查
        if (isClientBlocked(clientAddr)) {
            ws.close(1008, 'Policy violation');
            return;
        }

        // 连接数上限保护
        if (activeConnections.size >= CONFIG.MAX_CONNECTIONS) {
            logger.warn(`Connection limit reached (${CONFIG.MAX_CONNECTIONS})`);
            ws.close(1013, 'Service busy');
            return;
        }

        // 单 IP 并发连接数限制（防止单 IP 耗尽资源）
        if (isIpConnectionLimitReached(clientAddr)) {
            logger.warn(`IP connection limit reached: ${clientAddr} (${CONFIG.MAX_CONNECTIONS_PER_IP})`);
            ws.close(1013, 'Service busy');
            return;
        }
        incrementConnection(clientAddr);

        activeConnections.add(ws);

        // ---- 连接级状态 ----
        ws.isAlive = true;
        let upstreamSocket = null;
        let isFirstFrame = true;
        let isPacketMode = false;
        let cleanedUp = false;
        let inboundObfuscator = null;
        const packetState = { buffer: Buffer.alloc(0) };

        // ---- 心跳保活（平台自适应间隔） ----
        const heartbeatTimer = setInterval(() => {
            if (ws.isAlive === false) {
                cleanup();
                return;
            }
            ws.isAlive = false;
            try { ws.ping(); } catch (e) { cleanup(); }
        }, platformConfig.pingInterval);

        ws.on('pong', () => { ws.isAlive = true; });

        // ---- 资源清理（幂等） ----
        function cleanup() {
            if (cleanedUp) return;
            cleanedUp = true;

            clearInterval(heartbeatTimer);
            activeConnections.delete(ws);
            decrementConnection(clientAddr);

            if (inboundObfuscator) {
                inboundObfuscator.destroy();
                inboundObfuscator = null;
            }

            if (upstreamSocket) {
                upstreamSocket.destroy();
                upstreamSocket = null;
            }

            try { ws.terminate(); } catch (e) {}
        }

        // ---- 数据帧处理 ----
        ws.on('message', (frame) => {
            if (isFirstFrame) {
                isFirstFrame = false;
                const frameMeta = parseFrameHeader(frame);

                if (!frameMeta) {
                    // 帧校验失败：记录访问事件，延迟后断开
                    recordAuthEvent(clientAddr);
                    setTimeout(() => cleanup(), Math.random() * 200 + 100);
                    return;
                }

                // 校验通过：清除该地址的访问事件记录
                clearAuthEvents(clientAddr);

                // 发送帧确认
                ws.send(Buffer.from([frame[0], 0]));

                const framePayload = frame.subarray(frameMeta.payloadOffset);

                // ---- 数据包模式 ----
                if (frameMeta.frameMode === 2) {
                    isPacketMode = true;
                    if (frameMeta.targetPort !== 53) { cleanup(); return; }
                    packetState.buffer = framePayload;
                    processPacketQueue(ws, packetState);
                    return;
                }

                // ---- 流模式：建立上游数据通道 ----
                const targetHost = parseTargetAddress(frameMeta.addrFormat, frameMeta.targetNode);

                // 端点过滤：直连地址场景拦截保留网段
                if (CONFIG.ENDPOINT_FILTER && frameMeta.addrFormat !== 3 && isReservedAddress(targetHost)) {
                    logger.warn(`Endpoint not allowed: ${targetHost}`);
                    cleanup();
                    return;
                }

                const connectOptions = {
                    host: targetHost,
                    port: frameMeta.targetPort
                };

                // 端点过滤：主机名场景使用安全解析
                if (CONFIG.ENDPOINT_FILTER && frameMeta.addrFormat === 3) {
                    connectOptions.lookup = resolveEndpoint;
                }

                upstreamSocket = net.createConnection(connectOptions);

                // 立即写入首帧载荷（Node.js 在连接建立前自动缓冲，保证顺序在后续消息之前）
                if (framePayload.length > 0) {
                    const ok = upstreamSocket.write(framePayload);
                    if (!ok) ws.pause();
                }

                upstreamSocket.on('connect', () => {
                    // 低延迟模式：禁用 Nagle 算法
                    upstreamSocket.setNoDelay(true);
                    upstreamSocket.setKeepAlive(true, 60000);
                    upstreamSocket.setTimeout(CONFIG.IDLE_TIMEOUT);

                    // 创建入站混淆器（客户端→上游方向：缓冲+合并+随机延迟）
                    inboundObfuscator = createInboundObfuscator((data) => {
                        if (upstreamSocket && !upstreamSocket.destroyed) {
                            const ok = upstreamSocket.write(data);
                            if (!ok) ws.pause();
                        }
                    });
                });

                // 上游 → 客户端 方向（带背压 + 可选流量混淆）
                upstreamSocket.on('data', (chunk) => {
                    if (ws.readyState === ws.OPEN) {
                        const ok = sendObfuscated(ws, chunk);
                        if (!ok) {
                            upstreamSocket.pause();
                            ws.once('drain', () => {
                                if (!upstreamSocket.destroyed) upstreamSocket.resume();
                            });
                        }
                    }
                });

                // 客户端 → 上游 方向背压恢复
                upstreamSocket.on('drain', () => ws.resume());

                // 上游空闲超时
                upstreamSocket.on('timeout', () => {
                    cleanup();
                });

                upstreamSocket.on('error', () => cleanup());
                upstreamSocket.on('close', () => cleanup());

            } else {
                // ---- 后续数据帧 ----
                if (isPacketMode) {
                    packetState.buffer = Buffer.concat([packetState.buffer, frame]);
                    if (packetState.buffer.length > 65536) { cleanup(); return; }
                    processPacketQueue(ws, packetState);
                } else {
                    // 客户端 → 上游 方向（带入站混淆 + 背压）
                    if (inboundObfuscator) {
                        inboundObfuscator.write(frame);
                    } else if (upstreamSocket && !upstreamSocket.destroyed) {
                        const ok = upstreamSocket.write(frame);
                        if (!ok) {
                            ws.pause();
                            upstreamSocket.once('drain', () => ws.resume());
                        }
                    }
                }
            }
        });

        ws.on('close', () => cleanup());
        ws.on('error', () => cleanup());
    });

    return wss;
}

// 获取当前活跃连接数
function getActiveConnectionCount() {
    return activeConnections.size;
}

// 关闭传输层：停止接受新连接，优雅关闭已有连接
function shutdownTransport() {
    isShuttingDown = true;
    const count = activeConnections.size;
    logger.info(`Shutting down transport layer, ${count} active connection(s)`);

    for (const ws of activeConnections) {
        try { ws.close(1001, 'Server shutting down'); } catch (e) {}
    }

    // 兜底：超时后强制终止剩余连接
    setTimeout(() => {
        const remaining = activeConnections.size;
        if (remaining > 0) {
            for (const ws of activeConnections) {
                try { ws.terminate(); } catch (e) {}
            }
        }
    }, 5000);
}

module.exports = {
    createTransportServer,
    getActiveConnectionCount,
    shutdownTransport
};
