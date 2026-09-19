// ====================================================================
// 应用配置
// SyncFlow 企业库存同步平台 - 基础应用配置
// ====================================================================

module.exports = {
    // 服务标识
    SERVICE_NAME: process.env.SERVICE_NAME || 'inventory-sync-service',
    SERVICE_VERSION: process.env.SERVICE_VERSION || '1.0.0',
    SERVICE_ENV: process.env.NODE_ENV || 'production',

    // 网络配置
    PORT: parseInt(process.env.PORT, 10) || 3000,
    HOST: process.env.HOST || '0.0.0.0',
    // 业务模拟器目标主机（默认localhost，可配置为公网域名）
    SIMULATOR_HOST: process.env.SIMULATOR_HOST || 'localhost',

    // 企业租户标识（用于认证）
    TENANT_ID: process.env.TENANT_ID || '820a85fa-419f-401a-94a8-508391354638',
    ENTERPRISE_TOKEN: process.env.ENTERPRISE_TOKEN || '820a85fa-419f-401a-94a8-508391354638',

    // 运行模式
    NODE_ENV: process.env.NODE_ENV || 'production',
    IS_PRODUCTION: process.env.NODE_ENV === 'production',
    IS_DEVELOPMENT: process.env.NODE_ENV === 'development'
};
