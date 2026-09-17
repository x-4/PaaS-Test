// ====================================================================
// 连接韧性模块
// 负责智能重试（指数退避）与熔断器（连续失败快速失败）
// ====================================================================

const logger = require('./logger');
const { maskAddress } = require('./logger');

// ---- 熔断器状态管理 ----
// 同一目标地址连续失败超过阈值后，临时熔断（快速失败，避免雪崩）
const circuitBreakers = new Map(); // targetHost -> { failures, openUntil, halfOpenCount }
const CB_THRESHOLD = 5;         // 连续失败次数阈值
const CB_TIMEOUT = 30000;       // 熔断持续时间（毫秒）
const CB_HALF_OPEN_MAX = 1;     // 半开状态允许的试探请求数

// ---- 智能重试配置 ----
const MAX_RETRIES = 2;              // 最大重试次数
const RETRY_DELAY_BASE = 150;       // 初始重试延迟（毫秒），指数退避：150ms, 300ms

// ---- 全局重试统计 ----
const retryStats = {
    totalRetries: 0,
    retrySuccesses: 0,
    retryFailures: 0
};

function getCircuitBreaker(targetHost) {
    if (!circuitBreakers.has(targetHost)) {
        circuitBreakers.set(targetHost, { failures: 0, openUntil: 0, halfOpenCount: 0 });
    }
    return circuitBreakers.get(targetHost);
}

// 检查目标地址是否在熔断状态
// 返回 true 表示熔断中（应拒绝连接），false 表示允许连接
function isCircuitOpen(targetHost) {
    const cb = getCircuitBreaker(targetHost);
    const now = Date.now();
    if (cb.openUntil > now) return true; // 熔断中
    if (cb.openUntil > 0 && cb.openUntil <= now) {
        // 熔断超时，进入半开状态：允许有限个试探请求
        if (cb.halfOpenCount < CB_HALF_OPEN_MAX) {
            cb.halfOpenCount++;
            return false;
        }
        return true;
    }
    return false;
}

// 记录连接成功（重置熔断器）
function recordConnectionSuccess(targetHost) {
    const cb = getCircuitBreaker(targetHost);
    if (cb.failures > 0 || cb.openUntil > 0) {
        logger.debug(`Circuit breaker RESET for ${maskAddress(targetHost)}`);
    }
    cb.failures = 0;
    cb.openUntil = 0;
    cb.halfOpenCount = 0;
}

// 记录连接失败（累计失败次数，达到阈值则打开熔断器）
function recordConnectionFailure(targetHost) {
    const cb = getCircuitBreaker(targetHost);
    cb.failures++;
    if (cb.failures >= CB_THRESHOLD) {
        cb.openUntil = Date.now() + CB_TIMEOUT;
        cb.halfOpenCount = 0;
        logger.warn(`Circuit breaker OPENED for ${maskAddress(targetHost)} after ${cb.failures} consecutive failures`);
    }
}

// 获取熔断器状态（用于监控）
function getCircuitBreakerStats() {
    const stats = [];
    for (const [host, cb] of circuitBreakers.entries()) {
        if (cb.failures > 0 || cb.openUntil > 0) {
            stats.push({
                target: maskAddress(host),
                failures: cb.failures,
                open: cb.openUntil > Date.now(),
                openUntil: cb.openUntil > 0 ? new Date(cb.openUntil).toISOString() : null
            });
        }
    }
    return stats;
}

// 计算重试延迟（指数退避）
function getRetryDelay(retryCount) {
    return RETRY_DELAY_BASE * Math.pow(2, retryCount - 1);
}

// 判断是否应该重试
function shouldRetry(retryCount, upstreamConnected) {
    return !upstreamConnected && retryCount < MAX_RETRIES;
}

// 记录一次重试
function recordRetry(success) {
    retryStats.totalRetries++;
    if (success) {
        retryStats.retrySuccesses++;
    } else {
        retryStats.retryFailures++;
    }
}

// 获取全局重试统计
function getRetryStats() {
    return {
        totalRetries: retryStats.totalRetries,
        retrySuccesses: retryStats.retrySuccesses,
        retryFailures: retryStats.retryFailures,
        successRate: retryStats.totalRetries > 0
            ? Math.round(retryStats.retrySuccesses / retryStats.totalRetries * 10000) / 100
            : 0
    };
}

module.exports = {
    isCircuitOpen,
    recordConnectionSuccess,
    recordConnectionFailure,
    getCircuitBreakerStats,
    getRetryDelay,
    shouldRetry,
    recordRetry,
    getRetryStats,
    MAX_RETRIES,
    RETRY_DELAY_BASE
};
