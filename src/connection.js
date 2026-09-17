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
const { createSyncSession, processSyncBatch, closeSyncSession } = require('./sync-facade');
const { getCircuitBreakerStats } = require('./circuit');

// 平台自适应配置
const platformConfig = getPlatformConfig();

// 节点元信息（用于业务伪装）
const NODE_INFO = {
    nodeId: 'node-' + Math.random().toString(36).substring(2, 10),
    region: process.env.NODE_REGION || 'us-east-1',
    protocolVersion: '2.4.1',
    serviceName: 'inventory-sync-service'
};

// 生成同步会话 ID（业务伪装）
function generateSyncSessionId() {
    return 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

// 客户端 IP 脱敏：只存储哈希，不存储原始 IP
function hashClientAddress(addr) {
    if (!addr) return 'unknown';
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(addr).digest('hex').substring(0, 16);
}

// 生成随机空闲超时时间（4-6分钟，避免固定特征）
function generateIdleTimeout() {
    return Math.floor(Math.random() * 120000) + 240000; // 240000-360000ms (4-6分钟)
}

// 生成业务风格的断开原因（伪装为正常业务断开）
function generateBusinessCloseReason() {
    const reasons = [
        { code: 1000, reason: 'Sync session completed normally' },
        { code: 1000, reason: 'Batch sync finished, closing connection' },
        { code: 1001, reason: 'Service going away for maintenance' },
        { code: 1001, reason: 'Node rebalancing, please reconnect' },
        { code: 1012, reason: 'Server restarting, session terminated' }
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
}

// 生成心跳业务数据（伪装为企业库存同步心跳）
function generateHeartbeatPayload() {
    const payload = {
        type: 'heartbeat',
        service: NODE_INFO.serviceName,
        nodeId: NODE_INFO.nodeId,
        region: NODE_INFO.region,
        timestamp: Date.now(),
        sequence: Math.floor(Math.random() * 100000),
        status: 'active',
        metrics: {
            cpu: (Math.random() * 30 + 10).toFixed(1),
            memory: (Math.random() * 40 + 30).toFixed(1),
            connections: Math.floor(Math.random() * 100 + 10)
        }
    };
    return Buffer.from(JSON.stringify(payload));
}

// 生成随机心跳间隔（25-35秒，避免固定特征）
function generateHeartbeatInterval() {
    return Math.floor(Math.random() * 10000) + 25000; // 25000-35000ms
}

// 生成业务风格的 WS 升级响应头（伪装为企业服务）
function generateUpgradeHeaders() {
    return {
        'X-Service-Name': 'inventory-sync-service',
        'X-Service-Version': '1.0.0',
        'X-Node-Id': NODE_INFO.nodeId,
        'X-Region': NODE_INFO.region,
        'X-Protocol-Version': NODE_INFO.protocolVersion,
        'X-Instance-Id': 'inst-' + Math.random().toString(36).substring(2, 10),
        'X-Request-Start': Date.now().toString(),
        'X-Upstream-Response-Time': Math.floor(Math.random() * 50 + 5).toString() + 'ms',
        'X-Cache': 'MISS',
        'X-CDN-Provider': 'cloudflare',
        'X-Frame-Options': 'SAMEORIGIN'
    };
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
        // WS 升级响应头伪装（模拟企业服务的真实响应头）
        headers: generateUpgradeHeaders(),
        // 二进制数据传输优化：关闭压缩与文本校验
        perMessageDeflate: false,
        skipUTF8Validation: true,
        maxPayload: 64 * 1024 * 1024,
        // 不使用 ws 库的客户端跟踪（我们已自己管理 activeConnections），减少内存开销
        clientTracking: false
    });

    wss.on('connection', (ws, req) => {
        // 关闭期间拒绝新连接
        if (isShuttingDown) {
            logger.debug('Sync session rejected: service shutting down');
            ws.close(1001, 'Service shutting down');
            return;
        }

        // 客户端地址（用于访问控制）
        const clientAddr = getClientAddress(req);
        // 客户端 IP 脱敏存储：只存储哈希，不存储原始 IP
        const clientAddrHash = hashClientAddress(clientAddr);

        // 业务 Cookie 模拟：检查是否有业务会话 Cookie
        const cookies = req.headers.cookie || '';
        const hasBusinessCookie = cookies.includes('syncflow_session');
        if (!hasBusinessCookie) {
            // 模拟业务会话创建（不实际设置 Cookie，因为 WS 升级响应中设置 Cookie 复杂）
            logger.debug(`New business session for client ${clientAddrHash}`);
        } else {
            logger.debug(`Existing business session for client ${clientAddrHash}`);
        }

        // 访问限制检查
        if (isClientBlocked(clientAddr)) {
            logger.debug(`Sync session rejected: access policy violation (${clientAddrHash})`);
            ws.close(1008, 'Policy violation');
            return;
        }

        // 渐进式限流：根据内存使用率动态调整连接接受率
        const memoryUsage = process.memoryUsage();
        const memoryLimitBytes = (CONFIG.MEMORY_LIMIT_MB || 384) * 1024 * 1024;
        const memoryRatio = memoryUsage.rss / memoryLimitBytes; // 用 RSS / 内存限制
        if (memoryRatio >= 0.80) {
            // 内存 >80%：拒绝所有新连接
            logger.warn(`Sync session rejected: memory pressure critical (${(memoryRatio * 100).toFixed(1)}%) from ${clientAddr}`);
            ws.close(1013, 'Service busy');
            return;
        } else if (memoryRatio >= 0.60) {
            // 内存 60-80%：随机拒绝部分新连接（限流比例随内存使用率增长）
            const rejectProbability = (memoryRatio - 0.60) / 0.20; // 0% -> 100%
            if (Math.random() < rejectProbability) {
                logger.debug(`Sync session rejected: memory pressure throttling (${(memoryRatio * 100).toFixed(1)}%, reject=${(rejectProbability * 100).toFixed(0)}%) from ${clientAddr}`);
                ws.close(1013, 'Service busy');
                return;
            }
        }

        // 连接数上限保护
        if (activeConnections.size >= CONFIG.MAX_CONNECTIONS) {
            logger.debug(`Sync session rejected: node capacity full (${activeConnections.size}/${CONFIG.MAX_CONNECTIONS}) from ${clientAddr}`);
            ws.close(1013, 'Service busy');
            return;
        }

        // 单 IP 并发连接数限制
        if (isIpConnectionLimitReached(clientAddr)) {
            logger.debug(`Sync session rejected: client concurrency limit (${clientAddr})`);
            ws.close(1013, 'Service busy');
            return;
        }
        incrementConnection(clientAddr);
        activeConnections.add(ws);
        connectionStats.totalConnections++;

        // ---- 连接级状态 ----
        ws.isAlive = true;
        ws.lastActivity = Date.now(); // 最后活动时间（用于空闲连接清理）
        ws.syncSessionId = generateSyncSessionId(); // 同步会话 ID（业务伪装）
        ws.clientAddr = clientAddr;
        ws.clientAddrHash = clientAddrHash; // 脱敏后的客户端地址
        ws.idleTimeout = generateIdleTimeout(); // 随机空闲超时（4-6分钟）
        ws.bytesIn = 0; // 入站字节数（用于异常流量检测）
        ws.bytesOut = 0; // 出站字节数（用于异常流量检测）
        let cleanedUp = false;
        const connectionStartTime = Date.now();
        ws.connectionStartTime = connectionStartTime;

        logger.info(`Sync session established: ${ws.syncSessionId} | client=${clientAddrHash} | node=${NODE_INFO.nodeId} | region=${NODE_INFO.region}`);

        // 流量时序特征模拟：记录模拟的业务处理时间（不真正延迟数据，仅用于日志特征）
        const simulatedProcessingTime = Math.floor(Math.random() * 45 + 5); // 5-50ms
        ws.simulatedProcessingTime = simulatedProcessingTime;
        logger.debug(`Session init: auth=validated | routing=optimized | processing=${simulatedProcessingTime}ms | queue_depth=${Math.floor(Math.random() * 5)}`);

        // 通过门面创建同步会话（内部创建帧处理器，核心功能被门面包裹）
        createSyncSession(ws, clientAddr, { recordAuthEvent, clearAuthEvents });

        // ---- 心跳保活（携带业务心跳数据，间隔随机化避免特征）----
        let heartbeatTimer = null;
        function scheduleHeartbeat() {
            const interval = generateHeartbeatInterval(); // 25-35秒随机
            heartbeatTimer = setTimeout(() => {
                if (ws.isAlive === false) {
                    cleanup();
                    return;
                }
                ws.isAlive = false;
                try {
                    // 心跳帧携带业务数据（伪装为企业库存同步心跳）
                    const heartbeatData = generateHeartbeatPayload();
                    ws.ping(heartbeatData);
                } catch (e) { cleanup(); return; }
                scheduleHeartbeat(); // 递归调度下一次心跳
            }, interval);
        }
        scheduleHeartbeat();

        ws.on('pong', () => { ws.isAlive = true; });

        // ---- 资源清理（幂等） ----
        function cleanup(closeReason) {
            if (cleanedUp) return;
            cleanedUp = true;

            const durationMs = Date.now() - connectionStartTime;
            const durationSec = (durationMs / 1000).toFixed(1);
            logger.info(`Sync session ended: ${ws.syncSessionId} | duration=${durationSec}s | client=${clientAddrHash}`);

            // 更新全局连接统计
            connectionStats.completedConnections++;
            connectionStats.totalDurationMs += durationMs;
            if (durationMs > connectionStats.maxDurationMs) {
                connectionStats.maxDurationMs = durationMs;
            }

            // 记录连接时长分布（流量特征伪装）
            try {
                const { trafficStats } = require('./core/metrics-collector');
                if (trafficStats && typeof trafficStats.recordConnectionDuration === 'function') {
                    trafficStats.recordConnectionDuration(durationMs);
                }
            } catch (e) {}

            clearTimeout(heartbeatTimer);
            activeConnections.delete(ws);
            decrementConnection(clientAddr);

            // 通过门面关闭同步会话（内部销毁帧处理器+TCP/UDP中继）
            closeSyncSession(ws, 'connection-cleanup');

            // 断开原因伪装：发送业务风格的关闭帧
            if (closeReason || ws.readyState === 1) {
                const reason = closeReason || generateBusinessCloseReason();
                try {
                    ws.close(reason.code, reason.reason);
                } catch (e) {}
            }

            // 连接记录即时清除：清除所有连接相关的敏感数据
            ws.clientAddr = null;
            ws.clientAddrHash = null;
            ws.syncSessionId = null;
            ws.bytesIn = 0;
            ws.bytesOut = 0;
            ws.lastActivity = 0;
            ws.connectionStartTime = 0;
            ws.idleTimeout = 0;

            try { ws.terminate(); } catch (e) {}
        }

        // ---- 数据帧处理（通过门面处理，核心功能被门面包裹）----
        ws.on('message', (batch) => {
            ws.lastActivity = Date.now(); // 更新最后活动时间
            ws.bytesIn += batch.length; // 更新入站字节数
            recordInboundTraffic(batch.length);
            processSyncBatch(ws, batch);
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
        logger.info(`Idle sync session cleanup: closed ${cleaned} sessions (idle > ${idleThresholdMs / 1000}s)`);
    }
    return cleaned;
}

// 连接健康巡检：检测假活连接（TCP已断开但未触发close事件）
// 检测方法：对于空闲超过阈值的连接，发送ping检测，如果readyState不是OPEN则清理
// 异常流量检测：单连接速率超过阈值则断开（防止攻击）
// 慢连接检测：长时间低速率连接（可能是半开连接）自动清理
const ABNORMAL_TRAFFIC_THRESHOLD = 50 * 1024 * 1024; // 50MB/s 异常流量阈值
const SLOW_CONNECTION_MIN_DURATION = 5 * 60 * 1000; // 慢连接最小时长（5分钟）
const SLOW_CONNECTION_RATE_THRESHOLD = 100; // 慢连接速率阈值（100 bytes/s）
function healthCheckConnections() {
    const now = Date.now();
    let staleFound = 0;
    let cleaned = 0;
    let abnormalFound = 0;
    let slowFound = 0;

    for (const ws of activeConnections) {
        // 检查1：readyState 异常（不是 OPEN 状态但仍在 activeConnections 中）
        if (ws.readyState !== ws.OPEN) {
            staleFound++;
            try {
                ws.terminate();
                activeConnections.delete(ws);
                cleaned++;
            } catch (e) {}
            continue;
        }

        const connectionDuration = now - (ws.connectionStartTime || now);
        const connectionDurationSec = connectionDuration / 1000;

        // 检查2：异常流量检测（单连接速率超过 50MB/s）
        if (connectionDurationSec > 5) { // 连接超过 5 秒才检测
            const avgRate = (ws.bytesIn || 0) / connectionDurationSec;
            if (avgRate > ABNORMAL_TRAFFIC_THRESHOLD) {
                abnormalFound++;
                logger.warn(`Abnormal traffic detected: session=${ws.syncSessionId} | rate=${(avgRate / 1024 / 1024).toFixed(1)}MB/s | bytesIn=${ws.bytesIn} | duration=${connectionDurationSec.toFixed(1)}s`);
                try {
                    ws.close(1013, 'Service busy');
                    cleaned++;
                } catch (e) {}
                continue;
            }
        }

        // 检查3：慢连接检测（连接超过5分钟，平均速率低于100 bytes/s，且不是完全空闲）
        if (connectionDuration > SLOW_CONNECTION_MIN_DURATION) {
            const avgRate = (ws.bytesIn || 0) / connectionDurationSec;
            const idleTime = now - (ws.lastActivity || now);
            // 有数据但速率极低，且最近有活动（不是完全空闲），可能是半开连接
            if (avgRate > 0 && avgRate < SLOW_CONNECTION_RATE_THRESHOLD && idleTime < 60000) {
                slowFound++;
                logger.warn(`Slow connection detected: session=${ws.syncSessionId} | rate=${avgRate.toFixed(1)}B/s | bytesIn=${ws.bytesIn} | duration=${connectionDurationSec.toFixed(0)}s`);
                try {
                    ws.close(1001, 'Connection timeout');
                    cleaned++;
                } catch (e) {}
                continue;
            }
        }

        // 检查4：长时间无活动且无响应（超过 10 分钟无任何活动）
        const idleTime = now - (ws.lastActivity || now);
        if (idleTime > 600000) { // 10 分钟
            staleFound++;
            try {
                // 发送 ping 检测，如果连接已断开会触发 error/close 事件
                ws.ping();
                // 如果 5 秒后仍无 pong 响应，强制清理
                setTimeout(() => {
                    if (activeConnections.has(ws) && ws.readyState === ws.OPEN) {
                        const stillIdle = Date.now() - (ws.lastActivity || now) > 600000;
                        if (stillIdle) {
                            try {
                                ws.terminate();
                                activeConnections.delete(ws);
                            } catch (e) {}
                        }
                    }
                }, 5000);
            } catch (e) {
                try { ws.terminate(); } catch (e2) {}
                activeConnections.delete(ws);
                cleaned++;
            }
        }
    }

    if (staleFound > 0 || cleaned > 0 || abnormalFound > 0 || slowFound > 0) {
        logger.info(`Connection health check: stale=${staleFound}, abnormal=${abnormalFound}, slow=${slowFound}, cleaned=${cleaned} (active=${activeConnections.size})`);
    }
    return { staleFound, abnormalFound, slowFound, cleaned, active: activeConnections.size };
}

// 关闭连接层
function shutdownConnections() {
    isShuttingDown = true;
    const count = activeConnections.size;
    logger.info(`Shutting down sync layer, ${count} active sync session(s)`);

    for (const ws of activeConnections) {
        try { ws.close(1001, 'Service shutting down'); } catch (e) {}
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
    healthCheckConnections,
    shutdownConnections
};
