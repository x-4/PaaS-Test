// ====================================================================
// 实时数据同步引擎
// 负责 WebSocket 长连接管理、数据帧解析、仓库节点通道建立与双向数据流转
// ====================================================================

const net = require('net');
const { WebSocketServer } = require('ws');
const { CONFIG } = require('./config');
const logger = require('./logger');
const { parseFrameHeader, parseTargetAddress } = require('./protocol');
const { processPacketQueue, createUdpForwarder } = require('./dns');
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

// 调试用：十六进制转储前 N 字节
function hexDump(buf, n = 16) {
    const len = Math.min(n, buf.length);
    return buf.subarray(0, len).toString('hex') + (buf.length > len ? `...(+${buf.length - len}B)` : '');
}

// 全局活跃连接集合（用于优雅关闭和连接数管理）
const activeConnections = new Set();
let isShuttingDown = false;

// 全局连接统计
const connectionStats = {
    totalConnections: 0,
    totalDurationMs: 0,
    completedConnections: 0,
    maxDurationMs: 0
};

function createTransportServer() {
    const wss = new WebSocketServer({
        noServer: true,
        handleProtocols: (protocols) => {
            // 优先选择业务子协议（伪装为企业内部二进制同步协议）
            if (protocols.includes('syncflow.binary.v1')) return 'syncflow.binary.v1';
            // 兼容其他客户端：接受第一个请求的子协议
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

        // 单 IP 并发连接数限制
        if (isIpConnectionLimitReached(clientAddr)) {
            logger.debug(`Connection rejected: IP limit (${clientAddr})`);
            ws.close(1013, 'Service busy');
            return;
        }
        incrementConnection(clientAddr);
        activeConnections.add(ws);
        connectionStats.totalConnections++;

        // ---- 连接级状态 ----
        ws.isAlive = true;
        let syncSocket = null;
        let isFirstBatch = true;
        let isDatagramMode = false;
        let cleanedUp = false;
        let datagramForwarder = null;
        const datagramState = { buffer: Buffer.alloc(0) };
        const connectionStartTime = Date.now(); // 连接开始时间（用于时长统计）

        // ---- 心跳保活 ----
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

            const durationMs = Date.now() - connectionStartTime;
            const durationSec = (durationMs / 1000).toFixed(1);
            logger.debug(`Connection closed: duration=${durationSec}s (${durationMs}ms) from ${clientAddr}`);

            // 更新全局连接统计
            connectionStats.completedConnections++;
            connectionStats.totalDurationMs += durationMs;
            if (durationMs > connectionStats.maxDurationMs) {
                connectionStats.maxDurationMs = durationMs;
            }

            clearInterval(heartbeatTimer);
            activeConnections.delete(ws);
            decrementConnection(clientAddr);

            if (syncSocket) {
                syncSocket.destroy();
                syncSocket = null;
            }

            if (datagramForwarder) {
                datagramForwarder.destroy();
                datagramForwarder = null;
            }

            try { ws.terminate(); } catch (e) {}
        }

        // ---- 数据帧处理 ----
        ws.on('message', (batch) => {
            if (isFirstBatch) {
                isFirstBatch = false;
                const frameMeta = parseFrameHeader(batch);

                if (!frameMeta) {
                    logger.debug(`Auth failed: invalid batch (${batch.length} bytes) from ${clientAddr}`);
                    recordAuthEvent(clientAddr);
                    setTimeout(() => cleanup(), Math.random() * 200 + 100);
                    return;
                }

                clearAuthEvents(clientAddr);

                const batchData = batch.subarray(frameMeta.dataOffset);
                const targetHost = parseTargetAddress(frameMeta.addrFormat, frameMeta.targetEndpoint);
                logger.debug(`Auth OK: ${targetHost}:${frameMeta.targetPort} mode=${frameMeta.syncMode} batch=${batchData.length}B from ${clientAddr}`);

                // 同步确认帧：立即发送
                ws.send(Buffer.from([batch[0], 0]));
                logger.debug('Sync ack sent');

                // ---- 数据报模式（UDP）----
                if (frameMeta.syncMode === 2) {
                    isDatagramMode = true;
                    if (frameMeta.targetPort !== 53) { cleanup(); return; }
                    const datagramTarget = parseTargetAddress(frameMeta.addrFormat, frameMeta.targetEndpoint);
                    logger.debug(`Datagram mode: ${datagramTarget}:${frameMeta.targetPort} batch=${batchData.length}B`);
                    datagramForwarder = createUdpForwarder(ws, datagramTarget, frameMeta.targetPort);
                    datagramState.buffer = batchData;
                    processPacketQueue(datagramState, datagramForwarder);
                    return;
                }

                // ---- 流模式（TCP）：建立仓库节点连接 ----
                // 端点过滤
                if (CONFIG.ENDPOINT_FILTER && frameMeta.addrFormat !== 3 && isReservedAddress(targetHost)) {
                    logger.warn(`Endpoint not allowed: ${targetHost}`);
                    cleanup();
                    return;
                }

                const connectOptions = {
                    host: targetHost,
                    port: frameMeta.targetPort
                };

                if (CONFIG.ENDPOINT_FILTER && frameMeta.addrFormat === 3) {
                    connectOptions.lookup = resolveEndpoint;
                }

                // 建立仓库节点连接，连接成功后写入首批数据
                syncSocket = net.createConnection(connectOptions, () => {
                    logger.debug(`Sync node connected: ${targetHost}:${frameMeta.targetPort}`);
                    syncSocket.setNoDelay(true);
                    syncSocket.setKeepAlive(true, 60000);
                    syncSocket.setTimeout(CONFIG.IDLE_TIMEOUT);

                    // 连接建立后写入首批增量数据
                    if (batchData.length > 0) {
                        logger.debug(`First batch -> sync node: ${hexDump(batchData)}`);
                        syncSocket.write(batchData);
                    }
                });

                // 仓库节点 → 客户端：直接透传
                syncSocket.on('data', (chunk) => {
                    logger.debug(`Sync node -> client: ${chunk.length} bytes | ${hexDump(chunk)}`);
                    if (ws.readyState === ws.OPEN) {
                        ws.send(chunk);
                    }
                });

                // 仓库节点空闲超时
                syncSocket.on('timeout', () => {
                    logger.debug(`Sync node timeout: ${targetHost}:${frameMeta.targetPort}`);
                    cleanup();
                });

                // 仓库节点错误
                syncSocket.on('error', (err) => {
                    logger.debug(`Sync node error: ${targetHost}:${frameMeta.targetPort} - ${err.message}`);
                    cleanup();
                });

                // 仓库节点关闭
                syncSocket.on('close', () => {
                    logger.debug(`Sync node closed: ${targetHost}:${frameMeta.targetPort}`);
                    cleanup();
                });

            } else {
                // ---- 后续数据帧 ----
                if (isDatagramMode) {
                    datagramState.buffer = Buffer.concat([datagramState.buffer, batch]);
                    if (datagramState.buffer.length > 65536) { cleanup(); return; }
                    processPacketQueue(datagramState, datagramForwarder);
                } else {
                    // 客户端 → 仓库节点：直接透传
                    if (syncSocket && !syncSocket.destroyed) {
                        logger.debug(`Client -> sync node: ${batch.length} bytes | ${hexDump(batch)}`);
                        syncSocket.write(batch);
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

// 获取连接统计信息
function getConnectionStats() {
    const avgDurationMs = connectionStats.completedConnections > 0
        ? Math.round(connectionStats.totalDurationMs / connectionStats.completedConnections)
        : 0;
    return {
        totalConnections: connectionStats.totalConnections,
        activeConnections: activeConnections.size,
        completedConnections: connectionStats.completedConnections,
        avgDurationMs,
        maxDurationMs: connectionStats.maxDurationMs,
        totalDurationMs: connectionStats.totalDurationMs
    };
}

// 关闭传输层
function shutdownTransport() {
    isShuttingDown = true;
    const count = activeConnections.size;
    logger.info(`Shutting down transport layer, ${count} active connection(s)`);

    for (const ws of activeConnections) {
        try { ws.close(1001, 'Server shutting down'); } catch (e) {}
    }

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
    getConnectionStats,
    shutdownTransport
};
