// ====================================================================
// 安全配置
// SyncFlow 企业库存同步平台 - 安全防护配置
// ====================================================================

module.exports = {
    // 端点过滤（防止 SSRF），默认关闭以兼容所有 PaaS 平台的 DNS 解析
    // 如需启用请设置环境变量 ENDPOINT_FILTER=true
    ENDPOINT_FILTER: process.env.ENDPOINT_FILTER === 'true',

    // 认证限流
    AUTH_RATE_LIMIT: parseInt(process.env.AUTH_RATE_LIMIT, 10) || 10,
    AUTH_RATE_WINDOW_MS: parseInt(process.env.AUTH_RATE_WINDOW_MS, 10) || 60000,

    // IP 封禁
    IP_BAN_THRESHOLD: parseInt(process.env.IP_BAN_THRESHOLD, 10) || 5,
    IP_BAN_DURATION_MS: parseInt(process.env.IP_BAN_DURATION_MS, 10) || 300000,

    // 连接数限制
    MAX_CONNECTIONS: parseInt(process.env.MAX_CONNECTIONS, 10) || 1000,
    MAX_CONNECTIONS_PER_IP: parseInt(process.env.MAX_CONNECTIONS_PER_IP, 10) || 50,

    // 管理令牌（用于日志级别管理等敏感端点）
    ADMIN_TOKEN: process.env.ADMIN_TOKEN || process.env.DEBUG_TOKEN || null,

    // HTTP 安全头
    ENABLE_HSTS: process.env.ENABLE_HSTS !== 'false',
    ENABLE_CSP: process.env.ENABLE_CSP !== 'false',

    // 日志脱敏
    LOG_SENSITIVE: process.env.LOG_SENSITIVE === 'true'
};
