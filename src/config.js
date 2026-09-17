// ====================================================================
// 企业级配置中心
// 从 config/ 目录加载分散的配置文件，合并为统一配置对象
// ====================================================================

const { CONFIG: baseConfig, validateConfig: baseValidate } = require('./config/index');

// 补充业务特定配置（不在通用配置文件中的项）
const CONFIG = {
    ...baseConfig,

    // 企业官网镜像站点（前端流量兜底）
    CORPORATE_SITE: 'https://www.microsoft.com',

    // 实时数据同步端点（默认路径）
    SYNC_ENDPOINT: '/api/v2/inventory/live-stream',

    // 业务事件推送端点（JSON 文本消息，用于业务伪装）
    EVENT_ENDPOINT: '/api/v1/events',

    // 实时业务消息端点
    REALTIME_ENDPOINT: '/api/v1/realtime',

    // ---- 运行稳定性参数 ----
    PING_INTERVAL: parseInt(process.env.PING_INTERVAL, 10) || 30000,
    MEMORY_LIMIT_MB: parseInt(process.env.MEMORY_LIMIT_MB, 10) || 384,
    SHUTDOWN_TIMEOUT: parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 10000,

    // ---- 安全防护参数 ----
    AUTH_MAX_FAILURES: parseInt(process.env.AUTH_MAX_FAILURES, 10) || 5,
    AUTH_WINDOW_MS: parseInt(process.env.AUTH_WINDOW_MS, 10) || 60000,
    AUTH_BAN_MS: parseInt(process.env.AUTH_BAN_MS, 10) || 300000
};

// 启动前配置校验
function validateConfig() {
    // 先执行基础校验
    const baseResult = baseValidate();
    if (!baseResult.valid) {
        throw new Error(`Config validation failed: ${baseResult.errors.join(', ')}`);
    }

    // 业务特定校验
    const tenantIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!tenantIdRegex.test(CONFIG.ENTERPRISE_TOKEN)) {
        throw new Error(`Invalid tenant token format`);
    }
    if (CONFIG.MAX_CONNECTIONS < 1) {
        throw new Error(`Invalid MAX_CONNECTIONS: ${CONFIG.MAX_CONNECTIONS}`);
    }
}

module.exports = { CONFIG, validateConfig };
