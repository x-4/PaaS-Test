// ====================================================================
// 日志配置
// SyncFlow 企业库存同步平台 - 日志系统配置
// ====================================================================

module.exports = {
    // 日志级别：error, warn, info, debug, trace
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',

    // 日志格式：text, json
    LOG_FORMAT: process.env.LOG_FORMAT || 'text',

    // 是否输出到文件
    LOG_TO_FILE: process.env.LOG_TO_FILE === 'true',
    LOG_FILE_PATH: process.env.LOG_FILE_PATH || './logs/syncflow.log',

    // 日志轮转
    LOG_MAX_SIZE: process.env.LOG_MAX_SIZE || '10m',
    LOG_MAX_FILES: process.env.LOG_MAX_FILES || '7',

    // 慢请求阈值（毫秒）
    SLOW_REQUEST_THRESHOLD_MS: parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10) || 1000,

    // 请求日志
    ENABLE_ACCESS_LOG: process.env.ENABLE_ACCESS_LOG !== 'false',
    ACCESS_LOG_FORMAT: process.env.ACCESS_LOG_FORMAT || 'combined',

    // 敏感信息脱敏
    MASK_SENSITIVE_DATA: process.env.MASK_SENSITIVE_DATA !== 'false',
    MASK_ADDRESS_PREFIX: parseInt(process.env.MASK_ADDRESS_PREFIX, 10) || 3
};
