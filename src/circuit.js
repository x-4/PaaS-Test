// ====================================================================
// 智能重试 + 熔断机制（兼容层）
// 已迁移至 core/circuit-breaker.js
// 本文件保留向后兼容
// ====================================================================

const {
    isCircuitOpen,
    recordConnectionSuccess,
    recordConnectionFailure,
    getRetryDelay,
    shouldRetry,
    recordRetry,
    getCircuitBreakerStats,
    getRetryStats,
    MAX_RETRIES
} = require('./core/circuit-breaker');

module.exports = {
    isCircuitOpen,
    recordConnectionSuccess,
    recordConnectionFailure,
    getRetryDelay,
    shouldRetry,
    recordRetry,
    getCircuitBreakerStats,
    getRetryStats,
    MAX_RETRIES
};
