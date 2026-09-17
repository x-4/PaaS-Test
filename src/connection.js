// ====================================================================
// 实时连接管理引擎
// 负责 WebSocket 服务器创建、连接生命周期管理、心跳保活、连接统计
// ====================================================================

const { WebSocketServer } = require('ws');
const { CONFIG } = require('./config');
const logger = require('./logger');
const { getPlatformConfig } = require('./platform');
const {
    isClientBlocked,
    recordAuthEvent,
    clearAuthEvents,
    getClientAddress,
    isIpConnectionLimitReached,
    incrementConnection,
    decrementConnection
} = require('./security');
const { createFrameHandler } = require('./frame');
const { getCircuitBreakerStats } = require('./circuit');

// 平台自适应配置
const platformConfig = getPlatformConfig();

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

// 全局流量统计（滑动窗口，用于自适应流量模拟）
const trafficStats = {
    totalBytes: 0,
    totalMessages: 0,
    windowBytes: 0,        // 当前时间窗口的入站字节数
    windowMessages: 0,     // 当前时间窗口的入站消息数
    windowStart: Date.now(),
    WINDOW_SECONDS: 60     // 统计窗口长度（秒）
};

// 记录入站流量（每次收到 WS 消息时调用）
function recordInboundTraffic(bytes) {
    trafficStats.totalBytes += bytes;
    trafficStats.totalMessages++;
    trafficStats.windowBytes += bytes;
    trafficStats.windowMessages++;
}

function createConnectionServer() {
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
        ws.lastActivity = Date.now(); // 最后活动时间（用于空闲连接清理）
        let cleanedUp = false;
        const connectionStartTime = Date.now();

        // 创建帧处理器
        const frameHandler = createFrameHandler({
            ws,
            cleanup: () => cleanup(),
            clientAddr,
            recordAuthEvent,
            clearAuthEvents
        });

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

            // 销毁帧处理器（包含 TCP/UDP 中继）
            if (frameHandler) {
                frameHandler.destroy();
            }

            try { ws.terminate(); } catch (e) {}
        }

        // ---- 数据帧处理 ----
        ws.on('message', (batch) => {
            ws.lastActivity = Date.now(); // 更新最后活动时间
            recordInboundTraffic(batch.length);
            frameHandler.handleMessage(batch);
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
        maxDurationMs: connectionStats.maxDurationMs
    };
}

// 获取最近流量速率（滑动窗口）
// 返回 { bytesPerSecond, messagesPerSecond, activeConnections, trafficLevel }
// trafficLevel: 0=无流量, 1=低, 2=中, 3=高
function getTrafficRate() {
    const now = Date.now();
    const elapsed = (now - trafficStats.windowStart) / 1000;

    // 窗口过期，重置
    if (elapsed >= trafficStats.WINDOW_SECONDS) {
        trafficStats.windowBytes = 0;
        trafficStats.windowMessages = 0;
        trafficStats.windowStart = now;
        return {
            bytesPerSecond: 0,
            messagesPerSecond: 0,
            activeConnections: activeConnections.size,
            trafficLevel: 0
        };
    }

    const bytesPerSecond = elapsed > 0 ? trafficStats.windowBytes / elapsed : 0;
    const messagesPerSecond = elapsed > 0 ? trafficStats.windowMessages / elapsed : 0;

    // 流量等级判定
    let trafficLevel = 0;
    if (bytesPerSecond > 0 || activeConnections.size > 0) {
        if (bytesPerSecond > 50 * 1024 || activeConnections.size >= 10) {
            trafficLevel = 3; // 高
        } else if (bytesPerSecond > 10 * 1024 || activeConnections.size >= 5) {
            trafficLevel = 2; // 中
        } else {
            trafficLevel = 1; // 低
        }
    }

    return {
        bytesPerSecond: Math.round(bytesPerSecond),
        messagesPerSecond: Math.round(messagesPerSecond * 100) / 100,
        activeConnections: activeConnections.size,
        trafficLevel
    };
}

// 清理空闲连接（内存紧急时调用，关闭空闲超过阈值的连接）
// 返回清理的连接数量
function cleanupIdleConnections(idleThresholdMs = 300000) {
    const now = Date.now();
    let cleaned = 0;
    for (const ws of activeConnections) {
        const idleTime = now - (ws.lastActivity || now);
        if (idleTime > idleThresholdMs) {
            try {
                ws.close(1001, 'Server resource cleanup');
                cleaned++;
            } catch (e) {}
        }
    }
    if (cleaned > 0) {
        logger.info(`Idle connection cleanup: closed ${cleaned} connections (idle > ${idleThresholdMs / 1000}s)`);
    }
    return cleaned;
}

// 关闭连接层
function shutdownConnections() {
    isShuttingDown = true;
    const count = activeConnections.size;
    logger.info(`Shutting down connection layer, ${count} active connection(s)`);

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
    createConnectionServer,
    getActiveConnectionCount,
    getConnectionStats,
    getTrafficRate,
    getCircuitBreakerStats,
    cleanupIdleConnections,
    shutdownConnections
};
