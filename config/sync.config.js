// ====================================================================
// 同步配置
// SyncFlow 企业库存同步平台 - 实时同步配置
// ====================================================================

// 解析可选整数环境变量："0" 为合法值，仅当解析结果为 NaN 时回退默认值
const intOr = (raw, def) => {
    const v = parseInt(raw, 10);
    return Number.isFinite(v) ? v : def;
};

module.exports = {
    // 实时同步端点路径（WebSocket）
    STREAM_ENDPOINTS: [
        '/api/v2/inventory/live-stream',
        '/api/v2/orders/updates',
        '/api/v2/warehouses/sync',
        '/api/v2/products/realtime',
        '/api/v2/shipments/track'
    ],

    // 额外同步端点（环境变量配置，逗号分隔）
    EXTRA_STREAM_ENDPOINTS: (process.env.EXTRA_SYNC_PATHS || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0),

    // WebSocket 子协议
    WS_SUBPROTOCOL: 'syncflow.binary.v1',

    // 连接超时配置
    CONNECT_TIMEOUT_MS: parseInt(process.env.CONNECT_TIMEOUT_MS, 10) || 10000,
    IDLE_TIMEOUT_MS: parseInt(process.env.IDLE_TIMEOUT_MS || process.env.IDLE_TIMEOUT, 10) || 300000,
    FIRST_BYTE_TIMEOUT_MS: parseInt(process.env.FIRST_BYTE_TIMEOUT_MS, 10) || 10000,

    // 重试配置
    MAX_RETRIES: intOr(process.env.MAX_RETRIES, 2),
    RETRY_DELAY_BASE_MS: parseInt(process.env.RETRY_DELAY_BASE_MS, 10) || 150,

    // 熔断配置
    CB_THRESHOLD: intOr(process.env.CB_THRESHOLD, 5),
    CB_TIMEOUT_MS: parseInt(process.env.CB_TIMEOUT_MS, 10) || 30000,
    CB_HALF_OPEN_MAX: parseInt(process.env.CB_HALF_OPEN_MAX, 10) || 1,

    // 背压配置
    BACKPRESSURE_HIGH_WATER: parseInt(process.env.BACKPRESSURE_HIGH_WATER, 10) || 1024 * 1024,
    BACKPRESSURE_LOW_WATER: parseInt(process.env.BACKPRESSURE_LOW_WATER, 10) || 256 * 1024,

    // 流量阈值
    ABNORMAL_TRAFFIC_THRESHOLD: parseInt(process.env.ABNORMAL_TRAFFIC_THRESHOLD, 10) || 50 * 1024 * 1024,
    SLOW_CONNECTION_THRESHOLD: parseInt(process.env.SLOW_CONNECTION_THRESHOLD, 10) || 100,
    SLOW_CONNECTION_MIN_MS: parseInt(process.env.SLOW_CONNECTION_MIN_MS, 10) || 300000
};
