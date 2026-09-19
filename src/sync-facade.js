// ====================================================================
// 同步服务门面（Sync Facade）
// 为复杂子系统提供简单的业务接口，外部只能通过门面访问
// 内部通过 EventBus 协调，核心功能被门面完全包裹
// 品牌：SyncFlow - 企业级库存同步平台
// ====================================================================

const { eventBus } = require('./event-bus');
const { createBatchProcessor } = require('./frame');
// 注意：不直接 require connection.js，避免循环依赖
// connection.js -> sync-facade.js -> connection.js
// 统计函数在 getSyncStats 中延迟引入
const { getCircuitBreakerStats, getRetryStats } = require('./circuit');
const { getDnsCacheStats } = require('./security');
const logger = require('./logger');

// 会话存储（ws -> batchProcessor 映射）
const sessions = new Map();

// ---- 门面业务接口 ----

/**
 * 创建同步会话
 * 对外：创建库存同步会话
 * 内部：创建帧处理器，管理连接生命周期
 * @param {WebSocket} ws - WebSocket 连接
 * @param {string} clientAddr - 客户端地址
 * @param {object} options - 配置选项
 * @returns {object} 会话信息
 */
function createSyncSession(ws, clientAddr, options = {}) {
    const sessionId = ws.syncSessionId || `sync_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    // eventBus.emit('sync:session:create', { sessionId, clientAddr, ws }); // 零订阅者，已禁用

    // 创建批次处理器（内部核心逻辑）
    const batchProcessor = createBatchProcessor({
        ws,
        cleanup: () => closeSyncSession(ws, 'cleanup'),
        clientAddr,
        recordAuthEvent: options.recordAuthEvent,
        clearAuthEvents: options.clearAuthEvents
    });

    sessions.set(ws, {
        sessionId,
        clientAddr,
        batchProcessor,
        createdAt: Date.now(),
        bytesProcessed: 0,
        batchesProcessed: 0
    });

    logger.info(`Sync session created: ${sessionId} | client=${clientAddr}`);

    return { sessionId, clientAddr, createdAt: Date.now() };
}

/**
 * 处理同步数据批次
 * 对外：处理库存同步数据批次
 * 内部：帧解析、认证、分发、转发
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Buffer} batch - 数据批次
 */
function processSyncBatch(ws, batch) {
    const session = sessions.get(ws);
    if (!session) {
        logger.warn(`Sync batch received for unknown session`);
        return;
    }

    session.batchesProcessed++;
    session.bytesProcessed += batch.length;

    // eventBus.emit('sync:batch:receive', {
    //     sessionId: session.sessionId,
    //     batchSize: batch.length,
    //     batchNumber: session.batchesProcessed
    // }); // 零订阅者，已禁用

    // 调用核心帧处理器
    session.batchProcessor.handleMessage(batch);

    // eventBus.emit('sync:batch:processed', {
    //     sessionId: session.sessionId,
    //     batchSize: batch.length,
    //     durationMs: 0
    // }); // 零订阅者，已禁用
}

/**
 * 关闭同步会话
 * 对外：关闭库存同步会话
 * 内部：清理连接、释放资源
 * @param {WebSocket} ws - WebSocket 连接
 * @param {string} reason - 关闭原因
 */
function closeSyncSession(ws, reason = 'unknown') {
    const session = sessions.get(ws);
    if (!session) return;

    const durationMs = Date.now() - session.createdAt;

    // eventBus.emit('sync:session:close', {
    //     sessionId: session.sessionId,
    //     reason,
    //     durationMs,
    //     bytesProcessed: session.bytesProcessed,
    //     batchesProcessed: session.batchesProcessed
    // }); // 零订阅者，已禁用

    // 销毁帧处理器（内部清理 TCP/UDP 中继）
    if (session.batchProcessor && typeof session.batchProcessor.destroy === 'function') {
        session.batchProcessor.destroy();
    }

    sessions.delete(ws);

    // 关闭客户端 WebSocket 连接，防止连接槽位泄漏
    // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
    if (ws && ws.readyState <= 1) {
        try { ws.close(1000, reason); } catch (e) { /* 忽略关闭错误 */ }
    }

    logger.info(`Sync session closed: ${session.sessionId} | reason=${reason} | duration=${(durationMs / 1000).toFixed(1)}s | bytes=${session.bytesProcessed}`);
}

/**
 * 获取同步统计
 * 对外：获取库存同步服务统计信息
 * 内部：聚合连接、流量、熔断、DNS 等统计
 * @returns {object} 统计信息
 */
function getSyncStats() {
    // 延迟引入 connection.js，避免循环依赖
    const { getActiveConnectionCount, getConnectionStats, getTrafficRate } = require('./connection');

    const connStats = getConnectionStats();
    const trafficStats = getTrafficRate();
    const cbStats = getCircuitBreakerStats();
    const retryStats = getRetryStats();
    const dnsStats = getDnsCacheStats();

    return {
        service: 'inventory-sync-service',
        status: 'operational',
        sessions: {
            active: getActiveConnectionCount(),
            total: connStats.totalConnections,
            completed: connStats.completedConnections,
            avgDurationMs: connStats.avgDurationMs
        },
        traffic: {
            bytesPerSecond: trafficStats.bytesPerSecond,
            messagesPerSecond: trafficStats.messagesPerSecond,
            level: ['idle', 'low', 'medium', 'high'][trafficStats.trafficLevel]
        },
        reliability: {
            circuitBreakers: {
                open: cbStats.filter(c => c.state === 'open').length,
                halfOpen: cbStats.filter(c => c.state === 'half-open').length,
                total: cbStats.length
            },
            retries: retryStats
        },
        dns: {
            cacheSize: dnsStats.cacheSize,
            hitRate: dnsStats.hitRatePercent,
            totalQueries: dnsStats.totalQueries
        }
    };
}

/**
 * 获取活跃会话列表
 * @returns {Array} 会话列表
 */
function getActiveSessions() {
    return Array.from(sessions.entries()).map(([ws, session]) => ({
        sessionId: session.sessionId,
        clientAddr: session.clientAddr,
        durationMs: Date.now() - session.createdAt,
        bytesProcessed: session.bytesProcessed,
        batchesProcessed: session.batchesProcessed
    }));
}

/**
 * 检查会话是否存在
 * @param {WebSocket} ws
 * @returns {boolean}
 */
function hasSession(ws) {
    return sessions.has(ws);
}

module.exports = {
    createSyncSession,
    processSyncBatch,
    closeSyncSession,
    getSyncStats,
    getActiveSessions,
    hasSession
};
