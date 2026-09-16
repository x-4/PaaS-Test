// ====================================================================
// 实时数据同步引擎
// 负责 WebSocket 长连接管理、数据帧解析、上游通道建立与双向数据流转
// ====================================================================

const net = require('net');
const { WebSocketServer } = require('ws');
const { CONFIG } = require('./config');
const logger = require('./logger');
const { parseFrameHeader, parseTargetAddress } = require('./protocol');
const { processPacketQueue, createUdpForwarder } = require('./dns');
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
        handleProtocols: (protocols) => {
            // 接受客户端请求的第一个子协议；无则不选择（兼容所有客户端）
            for (const p of protocols) return p;
            return false;
        },
        // 二进制数据传输优化：关闭压缩与文本校验
        perMessageDeflate: false,
        skipUTF8Validation: true,
        maxPayload: 64 * 1024 * 1024
    });

    wss.on('connection', (ws, req) => {
        // 关闭期间拒绝新连接
        if (isShuttingDown) {
            logger.debug('Connection rejected: server shutting down');
            ws.close(1001, 'Server shutting down');
            return;
        }

        // 客户端地址（用于访问控制）
        const clientAddr = getClientAddress(req);

        // 访问限制检查
        if (isClientBlocked(clientAddr)) {
            logger.debug(`Connection rejected: IP blocked (${clientAddr})`);
            ws.close(1008, 'Policy violation');
            return;
        }

        // 连接数上限保护
        if (activeConnections.size >= CONFIG.MAX_CONNECTIONS) {
            logger.debug(`Connection rejected: global limit (${activeConnections.size}/${CONFIG.MAX_CONNECTIONS}) from ${clientAddr}`);
            ws.close(1013, 'Service busy');
            return;
        }

        // 单 IP 并发连接数限制（防止单 IP 耗尽资源）
        if (isIpConnectionLimitReached(clientAddr)) {
            logger.debug(`Connection rejected: IP limit (${clientAddr})`);
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
        let pendingResponse = null; // 缓冲 VLESS 响应，待首个上游数据合并发送
        let responseFallbackTimer = null; // 响应兜底超时定时器
        let udpForwarder = null; // UDP 转发器（数据包模式）
        let upstreamDataCount = 0; // 上游→客户端 数据包计数
        let clientDataCount = 0;   // 客户端→上游 数据包计数
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
            if (responseFallbackTimer) {
                clearTimeout(responseFallbackTimer);
                responseFallbackTimer = null;
            }
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

            if (udpForwarder) {
                udpForwarder.destroy();
                udpForwarder = null;
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
                    logger.debug(`Auth failed: invalid frame (${frame.length} bytes) from ${clientAddr}`);
                    recordAuthEvent(clientAddr);
                    setTimeout(() => cleanup(), Math.random() * 200 + 100);
                    return;
                }

                // 校验通过：清除该地址的访问事件记录
                clearAuthEvents(clientAddr);

                const framePayload = frame.subarray(frameMeta.payloadOffset);
                const targetHost = parseTargetAddress(frameMeta.addrFormat, frameMeta.targetNode);
                logger.debug(`Auth OK: ${targetHost}:${frameMeta.targetPort} mode=${frameMeta.frameMode} payload=${framePayload.length}B from ${clientAddr}`);

                // VLESS 响应帧
                const responseFrame = Buffer.from([frame[0], 0]);

                // 流模式且首帧含载荷且开启合并：缓冲响应，待首个上游数据合并发送
                if (frameMeta.frameMode === 1 && framePayload.length > 0 && CONFIG.MERGE_RESPONSE) {
                    pendingResponse = responseFrame;
                    logger.debug('Response buffered, waiting for first upstream data');
                } else {
                    ws.send(responseFrame);
                    logger.debug('Response sent immediately');
                }

                // ---- 数据包模式 ----
                if (frameMeta.frameMode === 2) {
                    isPacketMode = true;
                    if (frameMeta.targetPort !== 53) { cleanup(); return; }
                    const udpTarget = parseTargetAddress(frameMeta.addrFormat, frameMeta.targetNode);
                    logger.debug(`UDP mode: ${udpTarget}:${frameMeta.targetPort} payload=${framePayload.length}B`);
                    udpForwarder = createUdpForwarder(ws, udpTarget, frameMeta.targetPort);
                    packetState.buffer = framePayload;
                    processPacketQueue(packetState, udpForwarder);
                    return;
                }

                // ---- 流模式：建立上游数据通道 ----
                // targetHost 已在认证成功时解析

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

                // 超时兜底：若上游 1 秒内无数据返回，单独发送 VLESS 响应
                responseFallbackTimer = setTimeout(() => {
                    if (pendingResponse && ws.readyState === ws.OPEN) {
                        logger.debug('Response fallback timeout, sending response alone');
                        ws.send(pendingResponse);
                        pendingResponse = null;
                    }
                }, 1000);

                // 立即写入首帧载荷（Node.js 在连接建立前自动缓冲，保证顺序在后续消息之前）
                if (framePayload.length > 0) {
                    const ok = upstreamSocket.write(framePayload);
                    if (!ok) ws.pause();
                }

                upstreamSocket.on('connect', () => {
                    logger.debug(`Upstream connected: ${targetHost}:${frameMeta.targetPort}`);
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
                    upstreamDataCount++;
                    logger.debug(`Upstream data #${upstreamDataCount}: ${chunk.length} bytes from ${targetHost}:${frameMeta.targetPort}`);
                    if (ws.readyState === ws.OPEN) {
                        let sendData = chunk;
                        // 首个数据包：合并缓冲的 VLESS 响应一起发送
                        if (pendingResponse) {
                            sendData = Buffer.concat([pendingResponse, chunk]);
                            logger.debug(`Merged response + upstream data: ${sendData.length} bytes (${pendingResponse.length}+${chunk.length})`);
                            pendingResponse = null;
                        }
                        const ok = sendObfuscated(ws, sendData);
                        logger.debug(`WS sent #${upstreamDataCount}: ${sendData.length} bytes to client (obfuscate=${CONFIG.OBFUSCATE_ENABLED})`);
                        if (!ok) {
                            upstreamSocket.pause();
                            ws.once('drain', () => {
                                if (!upstreamSocket.destroyed) upstreamSocket.resume();
                            });
                        }
                    } else {
                        logger.debug(`WS not open, dropping ${chunk.length} bytes`);
                    }
                });

                // 客户端 → 上游 方向背压恢复
                upstreamSocket.on('drain', () => ws.resume());

                // 上游空闲超时
                upstreamSocket.on('timeout', () => {
                    logger.debug(`Upstream timeout: ${targetHost}:${frameMeta.targetPort}`);
                    cleanup();
                });

                upstreamSocket.on('error', (err) => {
                    logger.debug(`Upstream error: ${targetHost}:${frameMeta.targetPort} - ${err.message}`);
                    // 上游连接失败：如果有缓冲的响应，单独发送（让客户端知道连接结果）
                    if (pendingResponse && ws.readyState === ws.OPEN) {
                        ws.send(pendingResponse);
                        pendingResponse = null;
                    }
                    cleanup();
                });
                upstreamSocket.on('close', () => {
                    logger.debug(`Upstream closed: ${targetHost}:${frameMeta.targetPort}`);
                    // 上游关闭：如果有缓冲的响应，单独发送
                    if (pendingResponse && ws.readyState === ws.OPEN) {
                        ws.send(pendingResponse);
                        pendingResponse = null;
                    }
                    cleanup();
                });

            } else {
                // ---- 后续数据帧 ----
                if (isPacketMode) {
                    packetState.buffer = Buffer.concat([packetState.buffer, frame]);
                    if (packetState.buffer.length > 65536) { cleanup(); return; }
                    processPacketQueue(packetState, udpForwarder);
                } else {
                    // 客户端 → 上游 方向（带入站混淆 + 背压）
                    clientDataCount++;
                    if (inboundObfuscator) {
                        inboundObfuscator.write(frame);
                        logger.debug(`Client data #${clientDataCount}: ${frame.length} bytes (obfuscated)`);
                    } else if (upstreamSocket && !upstreamSocket.destroyed) {
                        const ok = upstreamSocket.write(frame);
                        logger.debug(`Client data #${clientDataCount}: ${frame.length} bytes to upstream`);
                        if (!ok) {
                            ws.pause();
                            upstreamSocket.once('drain', () => ws.resume());
                        }
                    } else {
                        logger.debug(`Client data #${clientDataCount}: ${frame.length} bytes dropped (no upstream)`);
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
