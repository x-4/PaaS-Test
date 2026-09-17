// ====================================================================
// 同步指标收集器
// 企业库存同步平台 - 吞吐量统计与性能监控
// 负责流量统计、延迟监控、滑动窗口指标
// ====================================================================

/**
 * 指标配置
 */
const MetricsConfig = {
    WINDOW_SECONDS: 60,           // 统计窗口长度（秒）
    MAX_HISTORY_SIZE: 1000,       // 最大历史记录数
    SLOW_CONNECTION_THRESHOLD: 100, // 慢连接阈值（字节/秒）
    SLOW_CONNECTION_MIN_MS: 300000, // 慢连接最小时长（5分钟）
    ABNORMAL_TRAFFIC_THRESHOLD: 50 * 1024 * 1024 // 异常流量阈值（50MB/s）
};

/**
 * 流量统计类
 * 记录入站/出站流量
 */
class TrafficStats {
    constructor() {
        this.totalBytesIn = 0;
        this.totalBytesOut = 0;
        this.totalMessagesIn = 0;
        this.totalMessagesOut = 0;
        this.windowBytesIn = 0;
        this.windowBytesOut = 0;
        this.windowMessagesIn = 0;
        this.windowMessagesOut = 0;
        this.windowStart = Date.now();
        // 帧大小分布统计（模拟正常业务的流量大小分布）
        this.frameSizeDistribution = {
            '0-128': 0,      // 小帧（控制帧、心跳）
            '128-1024': 0,   // 中帧（普通请求）
            '1024-8192': 0,  // 大帧（数据传输）
            '8192+': 0       // 超大帧（批量同步）
        };
        // 连接时长分布统计（模拟正常业务的连接时长分布）
        this.connectionDurationDistribution = {
            '0-10s': 0,       // 短连接（API 请求）
            '10s-1m': 0,      // 中等连接（页面浏览）
            '1m-5m': 0,       // 长连接（数据同步）
            '5m-30m': 0,      // 超长连接（批量任务）
            '30m+': 0         // 持久连接（实时监控）
        };
    }

    /**
     * 记录帧大小分布
     */
    _recordFrameSize(bytes) {
        if (bytes < 128) this.frameSizeDistribution['0-128']++;
        else if (bytes < 1024) this.frameSizeDistribution['128-1024']++;
        else if (bytes < 8192) this.frameSizeDistribution['1024-8192']++;
        else this.frameSizeDistribution['8192+']++;
    }

    /**
     * 记录连接时长分布
     */
    recordConnectionDuration(durationMs) {
        if (durationMs < 10000) this.connectionDurationDistribution['0-10s']++;
        else if (durationMs < 60000) this.connectionDurationDistribution['10s-1m']++;
        else if (durationMs < 300000) this.connectionDurationDistribution['1m-5m']++;
        else if (durationMs < 1800000) this.connectionDurationDistribution['5m-30m']++;
        else this.connectionDurationDistribution['30m+']++;
    }

    /**
     * 获取上下行流量比
     */
    get trafficRatio() {
        if (this.totalBytesIn === 0) return 0;
        return (this.totalBytesOut / this.totalBytesIn).toFixed(2);
    }

    /**
     * 记录入站流量
     */
    recordInbound(bytes) {
        this.totalBytesIn += bytes;
        this.totalMessagesIn++;
        this._recordFrameSize(bytes);
        this._checkWindow();
        this.windowBytesIn += bytes;
        this.windowMessagesIn++;
    }

    /**
     * 记录出站流量
     */
    recordOutbound(bytes) {
        this.totalBytesOut += bytes;
        this.totalMessagesOut++;
        this._checkWindow();
        this.windowBytesOut += bytes;
        this.windowMessagesOut++;
    }

    /**
     * 检查并重置时间窗口
     */
    _checkWindow() {
        const now = Date.now();
        if (now - this.windowStart >= MetricsConfig.WINDOW_SECONDS * 1000) {
            this.windowBytesIn = 0;
            this.windowBytesOut = 0;
            this.windowMessagesIn = 0;
            this.windowMessagesOut = 0;
            this.windowStart = now;
        }
    }

    /**
     * 获取当前窗口速率（字节/秒）
     */
    get windowRate() {
        const elapsed = (Date.now() - this.windowStart) / 1000;
        if (elapsed <= 0) return 0;
        return Math.round((this.windowBytesIn + this.windowBytesOut) / elapsed);
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            total: {
                bytesIn: this.totalBytesIn,
                bytesOut: this.totalBytesOut,
                messagesIn: this.totalMessagesIn,
                messagesOut: this.totalMessagesOut,
                trafficRatio: this.trafficRatio
            },
            window: {
                bytesIn: this.windowBytesIn,
                bytesOut: this.windowBytesOut,
                rate: this.windowRate,
                durationSec: Math.round((Date.now() - this.windowStart) / 1000)
            },
            frameSizeDistribution: { ...this.frameSizeDistribution },
            connectionDurationDistribution: { ...this.connectionDurationDistribution }
        };
    }
}

/**
 * 连接指标类
 * 记录单个连接的性能指标
 */
class ConnectionMetrics {
    constructor(connectionId) {
        this.connectionId = connectionId;
        this.createdAt = Date.now();
        this.bytesIn = 0;
        this.bytesOut = 0;
        this.messageCount = 0;
        this.firstByteAt = null;
        this.lastByteAt = null;
        this.errors = 0;
        this.retries = 0;
    }

    /**
     * 记录数据传输
     */
    recordData(direction, bytes) {
        if (direction === 'in') {
            this.bytesIn += bytes;
        } else {
            this.bytesOut += bytes;
        }
        this.messageCount++;
        this.lastByteAt = Date.now();
        if (!this.firstByteAt) {
            this.firstByteAt = Date.now();
        }
    }

    /**
     * 获取首字节延迟（毫秒）
     */
    get firstByteLatencyMs() {
        if (!this.firstByteAt) return null;
        return this.firstByteAt - this.createdAt;
    }

    /**
     * 获取平均速率（字节/秒）
     */
    get avgRate() {
        const elapsed = (this.lastByteAt || Date.now()) - this.createdAt;
        const seconds = elapsed / 1000;
        return seconds > 0 ? Math.round((this.bytesIn + this.bytesOut) / seconds) : 0;
    }

    /**
     * 是否为慢连接
     */
    get isSlow() {
        const duration = Date.now() - this.createdAt;
        return duration >= MetricsConfig.SLOW_CONNECTION_MIN_MS &&
               this.avgRate > 0 &&
               this.avgRate <= MetricsConfig.SLOW_CONNECTION_THRESHOLD;
    }

    /**
     * 是否为异常流量
     */
    get isAbnormalTraffic() {
        return this.avgRate >= MetricsConfig.ABNORMAL_TRAFFIC_THRESHOLD;
    }

    /**
     * 获取持续时间
     */
    get durationMs() {
        return Date.now() - this.createdAt;
    }

    /**
     * 转换为统计格式
     */
    toStats() {
        return {
            connectionId: this.connectionId,
            durationMs: this.durationMs,
            bytesIn: this.bytesIn,
            bytesOut: this.bytesOut,
            messageCount: this.messageCount,
            avgRate: this.avgRate,
            firstByteLatencyMs: this.firstByteLatencyMs,
            isSlow: this.isSlow,
            errors: this.errors,
            retries: this.retries
        };
    }
}

/**
 * 指标收集器类
 * 收集和管理全局指标
 */
class MetricsCollector {
    constructor() {
        this.traffic = new TrafficStats();
        this.connections = new Map();  // connectionId -> ConnectionMetrics
        this.history = [];  // 历史指标快照
        this.startedAt = Date.now();
    }

    /**
     * 记录入站流量
     */
    recordInbound(bytes, connectionId = null) {
        this.traffic.recordInbound(bytes);
        if (connectionId) {
            this._getConnection(connectionId).recordData('in', bytes);
        }
    }

    /**
     * 记录出站流量
     */
    recordOutbound(bytes, connectionId = null) {
        this.traffic.recordOutbound(bytes);
        if (connectionId) {
            this._getConnection(connectionId).recordData('out', bytes);
        }
    }

    /**
     * 获取或创建连接指标
     */
    _getConnection(connectionId) {
        let metrics = this.connections.get(connectionId);
        if (!metrics) {
            metrics = new ConnectionMetrics(connectionId);
            this.connections.set(connectionId, metrics);
        }
        return metrics;
    }

    /**
     * 移除连接指标
     */
    removeConnection(connectionId) {
        this.connections.delete(connectionId);
    }

    /**
     * 记录错误
     */
    recordError(connectionId) {
        const metrics = this.connections.get(connectionId);
        if (metrics) metrics.errors++;
    }

    /**
     * 记录重试
     */
    recordRetry(connectionId) {
        const metrics = this.connections.get(connectionId);
        if (metrics) metrics.retries++;
    }

    /**
     * 快照当前指标
     */
    snapshot() {
        const snapshot = {
            timestamp: Date.now(),
            traffic: this.traffic.getStats(),
            activeConnections: this.connections.size,
            slowConnections: [...this.connections.values()].filter(c => c.isSlow).length,
            uptimeMs: Date.now() - this.startedAt
        };
        this.history.push(snapshot);
        if (this.history.length > MetricsConfig.MAX_HISTORY_SIZE) {
            this.history.shift();
        }
        return snapshot;
    }

    /**
     * 获取慢连接列表
     */
    getSlowConnections() {
        return [...this.connections.values()]
            .filter(c => c.isSlow)
            .map(c => c.toStats());
    }

    /**
     * 获取异常流量连接
     */
    getAbnormalConnections() {
        return [...this.connections.values()]
            .filter(c => c.isAbnormalTraffic)
            .map(c => c.toStats());
    }

    /**
     * 获取全局统计
     */
    getStats() {
        return {
            traffic: this.traffic.getStats(),
            connections: {
                active: this.connections.size,
                slow: this.getSlowConnections().length,
                abnormal: this.getAbnormalConnections().length
            },
            historySize: this.history.length,
            uptimeMs: Date.now() - this.startedAt
        };
    }
}

// 全局指标收集器实例
const metricsCollector = new MetricsCollector();

// 兼容旧接口
const trafficStats = metricsCollector.traffic;

function recordInboundTraffic(bytes) {
    metricsCollector.recordInbound(bytes);
}

module.exports = {
    MetricsConfig,
    TrafficStats,
    ConnectionMetrics,
    MetricsCollector,
    metricsCollector,
    trafficStats,  // 兼容旧接口
    recordInboundTraffic  // 兼容旧接口
};
