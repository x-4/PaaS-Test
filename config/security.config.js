// ====================================================================
// 安全配置
// SyncFlow 企业库存同步平台 - 安全防护配置
// ====================================================================

// --------------------------------------------------------------------
// 【重要】历史限流/封禁/安全头配置项说明（M-6 方案 B）
// --------------------------------------------------------------------
// 下列配置项曾在本文件中定义，但从未被运行时代码读取，属于"死配置"：
//   - AUTH_RATE_LIMIT / AUTH_RATE_WINDOW_MS（认证限流）
//   - IP_BAN_THRESHOLD / IP_BAN_DURATION_MS（IP 封禁）
//   - ENABLE_HSTS / ENABLE_CSP（HTTP 安全头开关）
//
// 实际生效的限流参数当前由 src/security.js 中的硬编码默认值控制，
// 其数值来自 src/config.js（CONFIG.AUTH_MAX_FAILURES=5、
// CONFIG.AUTH_WINDOW_MS=60000、CONFIG.AUTH_BAN_MS=300000，
// 均支持同名环境变量覆盖）；HSTS/CSP 响应头则由 src/index.js 无条件写入，
// 不读取任何开关。
//
// 因此这里已清理上述从未生效的项，避免运维误改环境变量却不生效。
// 未来若要让本文件的限流/安全头开关真正生效，需要同步修改
// src/security.js 与 src/index.js 读取本配置后再恢复这些字段。
// --------------------------------------------------------------------

module.exports = {
    // 端点过滤（防止 SSRF），默认开启保护内网安全
    // 如平台 DNS 解析有问题，可设置 ENDPOINT_FILTER=false 关闭
    ENDPOINT_FILTER: process.env.ENDPOINT_FILTER !== 'false',

    // 连接数限制
    MAX_CONNECTIONS: parseInt(process.env.MAX_CONNECTIONS, 10) || 1000,
    MAX_CONNECTIONS_PER_IP: parseInt(process.env.MAX_CONNECTIONS_PER_IP, 10) || 50,

    // 管理令牌（用于日志级别管理等敏感端点）
    ADMIN_TOKEN: process.env.ADMIN_TOKEN || process.env.DEBUG_TOKEN || null,

    // 日志脱敏
    LOG_SENSITIVE: process.env.LOG_SENSITIVE === 'true'
};
