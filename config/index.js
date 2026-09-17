// ====================================================================
// 配置中心
// SyncFlow 企业库存同步平台 - 统一配置入口
//
// 从多个配置文件加载并合并配置，支持环境变量覆盖
// ====================================================================

const appConfig = require('./app.config');
const securityConfig = require('./security.config');
const syncConfig = require('./sync.config');
const loggingConfig = require('./logging.config');

// 合并所有配置
const CONFIG = {
    ...appConfig,
    ...securityConfig,
    ...syncConfig,
    ...loggingConfig
};

// 配置验证
function validateConfig() {
    const errors = [];

    if (!CONFIG.TENANT_ID) {
        errors.push('TENANT_ID is required');
    }

    if (CONFIG.PORT < 1 || CONFIG.PORT > 65535) {
        errors.push(`Invalid PORT: ${CONFIG.PORT}`);
    }

    if (CONFIG.MAX_RETRIES < 0 || CONFIG.MAX_RETRIES > 10) {
        errors.push(`MAX_RETRIES must be between 0 and 10, got ${CONFIG.MAX_RETRIES}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    CONFIG,
    validateConfig,
    // 单独导出各配置模块，便于按需引用
    appConfig,
    securityConfig,
    syncConfig,
    loggingConfig
};
