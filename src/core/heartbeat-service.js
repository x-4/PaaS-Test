// ====================================================================
// 心跳服务
// 企业库存同步平台 - 节点心跳与健康状态上报
// 负责生成业务心跳数据、维护节点状态、健康检查
// ====================================================================

const logger = require('../logger');

/**
 * 心跳配置
 */
const HeartbeatConfig = {
    INTERVAL_MS: 30000,           // 心跳间隔（30秒）
    TIMEOUT_MS: 90000,            // 心跳超时（90秒）
    MAX_MISSED_HEARTBEATS: 3      // 最大错过心跳次数
};

/**
 * 节点状态枚举
 */
const NodeStatus = {
    ACTIVE: 'active',
    DEGRADED: 'degraded',
    MAINTENANCE: 'maintenance',
    OFFLINE: 'offline'
};

/**
 * 节点信息类
 * 封装节点元信息
 */
class NodeInfo {
    constructor() {
        this.nodeId = 'node-' + Math.random().toString(36).substring(2, 10);
        this.region = process.env.NODE_REGION || 'us-east-1';
        this.protocolVersion = '2.4.1';
        this.serviceName = 'inventory-sync-service';
        this.startedAt = Date.now();
        this.status = NodeStatus.ACTIVE;
    }

    /**
     * 获取运行时长（毫秒）
     */
    get uptimeMs() {
        return Date.now() - this.startedAt;
    }

    /**
     * 获取运行时长（人类可读）
     */
    get uptimeFormatted() {
        const seconds = Math.floor(this.uptimeMs / 1000);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            nodeId: this.nodeId,
            region: this.region,
            protocolVersion: this.protocolVersion,
            serviceName: this.serviceName,
            status: this.status,
            uptime: this.uptimeFormatted,
            startedAt: new Date(this.startedAt).toISOString()
        };
    }
}

// 全局节点信息
const nodeInfo = new NodeInfo();

/**
 * 心跳载荷类
 * 封装一次心跳的数据
 */
class HeartbeatPayload {
    constructor(metrics = {}) {
        this.type = 'heartbeat';
        this.service = nodeInfo.serviceName;
        this.nodeId = nodeInfo.nodeId;
        this.region = nodeInfo.region;
        this.timestamp = Date.now();
        this.sequence = HeartbeatPayload._nextSequence++;
        this.status = nodeInfo.status;
        this.uptimeMs = nodeInfo.uptimeMs;
        this.metrics = metrics;
    }

    /**
     * 编码为 Buffer（JSON）
     */
    encode() {
        return Buffer.from(JSON.stringify(this));
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            type: this.type,
            service: this.service,
            nodeId: this.nodeId,
            region: this.region,
            timestamp: new Date(this.timestamp).toISOString(),
            sequence: this.sequence,
            status: this.status,
            uptime: this.uptimeMs,
            metrics: this.metrics
        };
    }
}
HeartbeatPayload._nextSequence = 1;

/**
 * 心跳服务类
 * 管理心跳生成和发送
 */
class HeartbeatService {
    constructor() {
        this.timer = null;
        this.listeners = new Set();
        this.heartbeatCount = 0;
        this.lastHeartbeatAt = null;
        this.missedCount = 0;
    }

    /**
     * 启动心跳服务
     */
    start() {
        if (this.timer) return;
        this.timer = setInterval(() => {
            this._tick();
        }, HeartbeatConfig.INTERVAL_MS);
        if (this.timer.unref) this.timer.unref();
        logger.info(`Heartbeat service started (interval=${HeartbeatConfig.INTERVAL_MS}ms)`);
    }

    /**
     * 停止心跳服务
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * 心跳触发
     */
    _tick() {
        const payload = new HeartbeatPayload(this._collectMetrics());
        this.heartbeatCount++;
        this.lastHeartbeatAt = Date.now();

        // 通知所有监听器
        for (const listener of this.listeners) {
            try {
                listener(payload);
            } catch (err) {
                logger.debug(`Heartbeat listener error: ${err.message}`);
            }
        }
    }

    /**
     * 收集当前指标
     */
    _collectMetrics() {
        return {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            activeConnections: 0  // 由外部更新
        };
    }

    /**
     * 注册心跳监听器
     */
    onHeartbeat(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * 手动触发一次心跳
     */
    trigger() {
        this._tick();
    }

    /**
     * 获取心跳统计
     */
    getStats() {
        return {
            count: this.heartbeatCount,
            lastAt: this.lastHeartbeatAt ? new Date(this.lastHeartbeatAt).toISOString() : null,
            intervalMs: HeartbeatConfig.INTERVAL_MS,
            listeners: this.listeners.size,
            node: nodeInfo.toJSON()
        };
    }
}

// 全局心跳服务实例
const heartbeatService = new HeartbeatService();

/**
 * 生成心跳业务数据（兼容旧接口）
 * 伪装为企业库存同步心跳
 */
function generateHeartbeatPayload() {
    const payload = new HeartbeatPayload();
    return payload.encode();
}

module.exports = {
    HeartbeatConfig,
    NodeStatus,
    NodeInfo,
    HeartbeatPayload,
    HeartbeatService,
    heartbeatService,
    nodeInfo,
    generateHeartbeatPayload  // 兼容旧接口
};
