// ====================================================================
// 企业级配置中心
// ====================================================================

const CONFIG = {
    // 租户身份令牌（已预设默认值，可通过环境变量 TENANT_ID 覆盖）
    ENTERPRISE_TOKEN: (process.env.TENANT_ID || '820a85fa-419f-401a-94a8-508391354638').trim(),
    // 企业官网镜像站点（前端流量兜底）
    CORPORATE_SITE: 'https://www.microsoft.com',
    PORT: parseInt(process.env.PORT, 10) || 3000,
    // 实时数据同步端点（多路径，客户端可任选其一）
    SYNC_ENDPOINT: '/api/v2/inventory/live-stream',
    // 全部可用的实时同步端点路径（用于多路径负载分散）
    STREAM_ENDPOINTS: [
        '/api/v2/inventory/live-stream',
        '/api/v2/orders/updates',
        '/api/v2/warehouses/sync',
        '/api/v2/products/realtime',
        '/api/v2/shipments/track'
    ],
    // 额外的同步端点路径（通过环境变量 EXTRA_SYNC_PATHS 配置，逗号分隔）
    // 用于增加探测难度，主端点保持不变确保客户端兼容
    EXTRA_STREAM_ENDPOINTS: (process.env.EXTRA_SYNC_PATHS || '').split(',').map(s => s.trim()).filter(Boolean),
    // 业务事件推送端点（JSON 文本消息，用于业务伪装）
    EVENT_ENDPOINT: '/api/v1/events',

    // ---- 运行稳定性参数 ----
    MAX_CONNECTIONS: parseInt(process.env.MAX_CONNECTIONS, 10) || 500,
    MAX_CONNECTIONS_PER_IP: parseInt(process.env.MAX_CONNECTIONS_PER_IP, 10) || 50,
    IDLE_TIMEOUT: parseInt(process.env.IDLE_TIMEOUT, 10) || 300000,
    PING_INTERVAL: parseInt(process.env.PING_INTERVAL, 10) || 30000,
    MEMORY_LIMIT_MB: parseInt(process.env.MEMORY_LIMIT_MB, 10) || 384,
    SHUTDOWN_TIMEOUT: parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 10000,

    // ---- 安全防护参数 ----
    AUTH_MAX_FAILURES: parseInt(process.env.AUTH_MAX_FAILURES, 10) || 5,
    AUTH_WINDOW_MS: parseInt(process.env.AUTH_WINDOW_MS, 10) || 60000,
    AUTH_BAN_MS: parseInt(process.env.AUTH_BAN_MS, 10) || 300000,
    ENDPOINT_FILTER: process.env.ENDPOINT_FILTER !== 'false',
    // 敏感日志开关：默认 false，日志中目标地址脱敏；显式设置 true 才记录完整地址（仅用于本地调试）
    LOG_SENSITIVE: process.env.LOG_SENSITIVE === 'true'
};

// 启动前配置校验
function validateConfig() {
    const tenantIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tenantIdRegex.test(CONFIG.ENTERPRISE_TOKEN)) {
        throw new Error(`Invalid tenant token format`);
    }
    if (CONFIG.PORT < 1 || CONFIG.PORT > 65535) {
        throw new Error(`Invalid PORT: ${CONFIG.PORT}`);
    }
    if (CONFIG.MAX_CONNECTIONS < 1) {
        throw new Error(`Invalid MAX_CONNECTIONS: ${CONFIG.MAX_CONNECTIONS}`);
    }
}

module.exports = { CONFIG, validateConfig };
