// ====================================================================
// 同步会话管理器
// 企业库存同步平台 - 会话生命周期管理
// 负责会话注册、注销、状态跟踪、空闲清理、连接数限制
// ====================================================================

const logger = require('../logger');

/**
 * 会话配置
 */
const SessionConfig = {
    MAX_CONNECTIONS_PER_IP: 10,     // 每 IP 最大连接数
    IDLE_TIMEOUT_MS: 300000,         // 空闲超时（5分钟）
    CLEANUP_INTERVAL_MS: 60000,      // 清理间隔（1分钟）
    MAX_TOTAL_CONNECTIONS: 1000      // 最大总连接数
};

/**
 * 会话信息类
 * 封装一个同步会话的元信息
 */
class SessionInfo {
    constructor(sessionId, clientAddress, ws) {
        this.sessionId = sessionId;
        this.clientAddress = clientAddress;
        this.ws = ws;
        this.createdAt = Date.now();
        this.lastActivityAt = Date.now();
        this.bytesIn = 0;
        this.bytesOut = 0;
        this.messageCount = 0;
        this.processor = null;  // 数据处理器（流管道或数据报转发器）
        this.isClosed = false;
    }

    /**
     * 记录活动
     */
    recordActivity() {
        this.lastActivityAt = Date.now();
    }

    /**
     * 记录入站字节
     */
    recordInbound(bytes) {
        this.bytesIn += bytes;
        this.messageCount++;
        this.recordActivity();
    }

    /**
     * 记录出站字节
     */
    recordOutbound(bytes) {
        this.bytesOut += bytes;
        this.recordActivity();
    }

    /**
     * 获取空闲时长（毫秒）
     */
    get idleMs() {
        return Date.now() - this.lastActivityAt;
    }

    /**
     * 获取会话时长（毫秒）
     */
    get durationMs() {
        return Date.now() - this.createdAt;
    }

    /**
     * 是否空闲超时
     */
    get isIdleTimeout() {
        return this.idleMs > SessionConfig.IDLE_TIMEOUT_MS;
    }

    /**
     * 获取平均速率（字节/秒）
     */
    get bytesPerSecond() {
        const seconds = this.durationMs / 1000;
        return seconds > 0 ? Math.round((this.bytesIn + this.bytesOut) / seconds) : 0;
    }

    /**
     * 转换为统计格式
     */
    toStats() {
        return {
            sessionId: this.sessionId,
            client: this.clientAddress,
            durationMs: this.durationMs,
            idleMs: this.idleMs,
            bytesIn: this.bytesIn,
            bytesOut: this.bytesOut,
            messageCount: this.messageCount,
            bytesPerSecond: this.bytesPerSecond,
            createdAt: new Date(this.createdAt).toISOString()
        };
    }
}

/**
 * 会话管理器类
 * 管理所有活跃同步会话
 */
class SessionManager {
    constructor() {
        this.sessions = new Map();  // sessionId -> SessionInfo
        this.ipConnections = new Map();  // clientAddress -> count
        this.cleanupTimer = null;
        this.stats = {
            totalCreated: 0,
            totalClosed: 0,
            peakConcurrent: 0
        };
    }

    /**
     * 启动定期清理
     */
    startCleanup() {
        if (this.cleanupTimer) return;
        this.cleanupTimer = setInterval(() => {
            this.cleanupIdleSessions();
        }, SessionConfig.CLEANUP_INTERVAL_MS);
        if (this.cleanupTimer.unref) this.cleanupTimer.unref();
    }

    /**
     * 停止清理
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * 创建新会话
     */
    createSession(clientAddress, ws) {
        // 检查总连接数
        if (this.sessions.size >= SessionConfig.MAX_TOTAL_CONNECTIONS) {
            logger.warn(`Max total connections reached: ${SessionConfig.MAX_TOTAL_CONNECTIONS}`);
            return null;
        }

        // 检查每 IP 连接数
        const ipCount = this.ipConnections.get(clientAddress) || 0;
        if (ipCount >= SessionConfig.MAX_CONNECTIONS_PER_IP) {
            logger.warn(`Max connections per IP reached: ${clientAddress}`);
            return null;
        }

        const sessionId = 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
        const session = new SessionInfo(sessionId, clientAddress, ws);
        this.sessions.set(sessionId, session);
        this.ipConnections.set(clientAddress, ipCount + 1);
        this.stats.totalCreated++;
        this.stats.peakConcurrent = Math.max(this.stats.peakConcurrent, this.sessions.size);

        return session;
    }

    /**
     * 关闭会话
     */
    closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.isClosed = true;
        if (session.processor && session.processor.destroy) {
            session.processor.destroy();
        }
        if (session.ws) {
            try { session.ws.close(); } catch (e) { /* ignore */ }
        }

        this.sessions.delete(sessionId);
        this.stats.totalClosed++;

        const ipCount = this.ipConnections.get(session.clientAddress) || 0;
        if (ipCount <= 1) {
            this.ipConnections.delete(session.clientAddress);
        } else {
            this.ipConnections.set(session.clientAddress, ipCount - 1);
        }
    }

    /**
     * 清理空闲会话
     */
    cleanupIdleSessions() {
        let cleaned = 0;
        for (const [sessionId, session] of this.sessions) {
            if (session.isIdleTimeout) {
                logger.debug(`Idle session timeout: ${sessionId} (${(session.idleMs/1000).toFixed(0)}s)`);
                this.closeSession(sessionId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.debug(`Cleaned ${cleaned} idle sessions`);
        }
        return cleaned;
    }

    /**
     * 关闭所有会话（优雅关闭）
     */
    closeAll() {
        const count = this.sessions.size;
        for (const sessionId of [...this.sessions.keys()]) {
            this.closeSession(sessionId);
        }
        this.stopCleanup();
        return count;
    }

    /**
     * 获取活跃会话数
     */
    get activeCount() {
        return this.sessions.size;
    }

    /**
     * 获取所有会话统计
     */
    getAllStats() {
        return [...this.sessions.values()].map(s => s.toStats());
    }

    /**
     * 获取管理器统计
     */
    getManagerStats() {
        return {
            active: this.activeCount,
            totalCreated: this.stats.totalCreated,
            totalClosed: this.stats.totalClosed,
            peakConcurrent: this.stats.peakConcurrent,
            uniqueIps: this.ipConnections.size
        };
    }
}

// 全局会话管理器实例
const sessionManager = new SessionManager();

module.exports = {
    SessionConfig,
    SessionInfo,
    SessionManager,
    sessionManager
};
