// ====================================================================
// 企业级配置中心
// ====================================================================

const CONFIG = {
    // 租户身份令牌（已预设默认值，可通过环境变量 TENANT_ID 覆盖）
    ENTERPRISE_TOKEN: (process.env.TENANT_ID || process.env.UUID || '820a85fa-419f-401a-94a8-508391354638').trim(),
    // 企业官网镜像站点（前端流量兜底）
    CORPORATE_SITE: 'https://www.microsoft.com',
    PORT: parseInt(process.env.PORT, 10) || 3000,
    // 实时数据同步端点
    SYNC_ENDPOINT: '/api/v2/inventory/live-stream',

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

    // ---- 流量混淆参数（借鉴 AnyTLS PaddingScheme 思路） ----
    // 默认开启，通过随机拆分/合并/延迟破坏包长与时序特征
    OBFUSCATE_ENABLED: process.env.OBFUSCATE !== '0' && process.env.OBFUSCATE !== 'false',
    // 拆分策略：random(随机大小) / fixed(固定大小) / burst(突发模式) / none(透传)
    OBFUSCATE_MODE: (process.env.OBFUSCATE_MODE || 'random').toLowerCase(),
    OBFUSCATE_MIN: parseInt(process.env.OBFUSCATE_MIN, 10) || 1024,    // 最小帧 1KB
    OBFUSCATE_MAX: parseInt(process.env.OBFUSCATE_MAX, 10) || 16384,   // 最大帧 16KB
    OBFUSCATE_FIXED_SIZE: parseInt(process.env.OBFUSCATE_FIXED_SIZE, 10) || 4096, // fixed模式帧大小
    // 入站混淆：缓冲+合并+随机延迟（客户端→上游方向）
    // 默认关闭（PaaS容器环境下定时器可能有差异，确认连接稳定后通过 OBFUSCATE_INBOUND=1 开启）
    OBFUSCATE_INBOUND: process.env.OBFUSCATE_INBOUND === '1' || process.env.OBFUSCATE_INBOUND === 'true',
    OBFUSCATE_DELAY_MAX: parseInt(process.env.OBFUSCATE_DELAY_MAX, 10) || 5, // 随机延迟上限 ms（保守5ms）
    OBFUSCATE_FLUSH_INTERVAL: parseInt(process.env.OBFUSCATE_FLUSH_INTERVAL, 10) || 5, // 入站缓冲兜底刷新间隔 ms
    OBFUSCATE_BUFFER_MAX: parseInt(process.env.OBFUSCATE_BUFFER_MAX, 10) || 32768 // 入站缓冲上限 32KB
};

// 启动前配置校验
function validateConfig() {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(CONFIG.ENTERPRISE_TOKEN)) {
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
