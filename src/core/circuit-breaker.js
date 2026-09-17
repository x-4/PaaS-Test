// ====================================================================
// 弹性控制器（智能重试 + 熔断器）
// 企业库存同步平台 - 连接弹性与故障恢复
// 负责指数退避重试、熔断器状态机、故障统计
// ====================================================================

const logger = require('../logger');

/**
 * 熔断器配置
 */
const CircuitConfig = {
    FAILURE_THRESHOLD: 5,           // 连续失败阈值（触发熔断）
    RECOVERY_TIMEOUT_MS: 30000,     // 熔断恢复超时（30秒）
    HALF_OPEN_MAX_REQUESTS: 1,      // 半开状态最大请求数
    MAX_RETRIES: 2,                 // 最大重试次数
    RETRY_DELAY_BASE_MS: 150,       // 基础重试延迟（150ms）
    RETRY_DELAY_MAX_MS: 5000        // 最大重试延迟（5秒）
};

/**
 * 熔断器状态枚举
 */
const CircuitState = {
    CLOSED: 'closed',           // 关闭（正常）
    OPEN: 'open',               // 打开（熔断）
    HALF_OPEN: 'half_open'      // 半开（试探恢复）
};

/**
 * 熔断器记录类
 * 记录单个目标的熔断状态
 */
class CircuitRecord {
    constructor(target) {
        this.target = target;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureAt = null;
        this.lastSuccessAt = null;
        this.openedAt = null;
        this.halfOpenRequests = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
    }

    /**
     * 记录失败
     */
    recordFailure() {
        this.failureCount++;
        this.totalFailures++;
        this.lastFailureAt = Date.now();

        // 达到阈值，打开熔断器
        if (this.failureCount >= CircuitConfig.FAILURE_THRESHOLD &&
            this.state === CircuitState.CLOSED) {
            this.state = CircuitState.OPEN;
            this.openedAt = Date.now();
            logger.warn(`Circuit opened for ${this.target} after ${this.failureCount} failures`);
        }
    }

    /**
     * 记录成功
     */
    recordSuccess() {
        this.successCount++;
        this.totalSuccesses++;
        this.lastSuccessAt = Date.now();
        this.failureCount = 0;

        // 半开状态成功，关闭熔断器
        if (this.state === CircuitState.HALF_OPEN) {
            this.state = CircuitState.CLOSED;
            this.halfOpenRequests = 0;
            logger.info(`Circuit closed for ${this.target} after success`);
        }
    }

    /**
     * 检查是否允许请求（熔断器是否打开）
     */
    isOpen() {
        if (this.state === CircuitState.OPEN) {
            // 检查是否超时恢复
            if (Date.now() - this.openedAt >= CircuitConfig.RECOVERY_TIMEOUT_MS) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenRequests = 0;
                logger.info(`Circuit half-open for ${this.target}`);
                return false;
            }
            return true;
        }

        if (this.state === CircuitState.HALF_OPEN) {
            // 半开状态限制请求数
            return this.halfOpenRequests >= CircuitConfig.HALF_OPEN_MAX_REQUESTS;
        }

        return false;
    }

    /**
     * 记录半开请求
     */
    recordHalfOpenRequest() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.halfOpenRequests++;
        }
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
            lastFailureAt: this.lastFailureAt ? new Date(this.lastFailureAt).toISOString() : null,
            openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null
        };
    }
}

/**
 * 熔断器类
 * 管理所有目标的熔断状态
 */
class CircuitBreaker {
    constructor() {
        this.records = new Map();  // target -> CircuitRecord
        this.globalStats = {
            totalRetries: 0,
            totalCircuitOpens: 0
        };
    }

    /**
     * 获取或创建记录
     */
    _getRecord(target) {
        let record = this.records.get(target);
        if (!record) {
            record = new CircuitRecord(target);
            this.records.set(target, record);
        }
        return record;
    }

    /**
     * 检查目标是否熔断
     */
    isOpen(target) {
        const record = this._getRecord(target);
        const open = record.isOpen();
        if (!open && record.state === CircuitState.HALF_OPEN) {
            record.recordHalfOpenRequest();
        }
        return open;
    }

    /**
     * 记录连接成功
     */
    recordSuccess(target) {
        this._getRecord(target).recordSuccess();
    }

    /**
     * 记录连接失败
     */
    recordFailure(target) {
        const record = this._getRecord(target);
        const wasOpen = record.state === CircuitState.OPEN;
        record.recordFailure();
        if (!wasOpen && record.state === CircuitState.OPEN) {
            this.globalStats.totalCircuitOpens++;
        }
    }

    /**
     * 获取所有熔断统计
     */
    getAllStats() {
        const stats = {};
        for (const [target, record] of this.records) {
            stats[target] = record.getStats();
        }
        return {
            targets: stats,
            global: this.globalStats
        };
    }

    /**
     * 清理过期记录
     */
    cleanup(maxAgeMs = 10 * 60 * 1000) {
        const now = Date.now();
        let cleaned = 0;
        for (const [target, record] of this.records) {
            const lastActivity = Math.max(record.lastFailureAt || 0, record.lastSuccessAt || 0);
            if (now - lastActivity > maxAgeMs && record.state === CircuitState.CLOSED) {
                this.records.delete(target);
                cleaned++;
            }
        }
        return cleaned;
    }
}

// 全局熔断器实例
const circuitBreaker = new CircuitBreaker();

/**
 * 重试控制器
 * 管理指数退避重试逻辑
 */
class RetryController {
    /**
     * 计算重试延迟（指数退避）
     * @param {number} retryCount - 当前重试次数
     * @returns {number} 延迟毫秒数
     */
    static getDelay(retryCount) {
        const delay = CircuitConfig.RETRY_DELAY_BASE_MS * Math.pow(2, retryCount - 1);
        return Math.min(delay, CircuitConfig.RETRY_DELAY_MAX_MS);
    }

    /**
     * 判断是否应该重试
     * @param {string} target - 目标地址
     * @param {number} retryCount - 当前重试次数
     * @returns {boolean}
     */
    static shouldRetry(target, retryCount) {
        if (retryCount >= CircuitConfig.MAX_RETRIES) {
            return false;
        }
        return !circuitBreaker.isOpen(target);
    }

    /**
     * 记录重试
     */
    static recordRetry() {
        circuitBreaker.globalStats.totalRetries++;
    }
}

// 兼容旧接口
function isCircuitOpen(target) {
    return circuitBreaker.isOpen(target);
}

function recordConnectionSuccess(target) {
    circuitBreaker.recordSuccess(target);
}

function recordConnectionFailure(target) {
    circuitBreaker.recordFailure(target);
}

function getRetryDelay(retryCount) {
    return RetryController.getDelay(retryCount);
}

function shouldRetry(target, retryCount) {
    return RetryController.shouldRetry(target, retryCount);
}

function recordRetry() {
    RetryController.recordRetry();
}

function getCircuitBreakerStats() {
    // 兼容旧接口：返回数组，每个元素包含 state 属性
    return [...circuitBreaker.records.values()].map(record => ({
        target: record.target,
        state: record.state === 'half_open' ? 'half-open' : record.state,
        failureCount: record.failureCount,
        lastFailureAt: record.lastFailureAt
    }));
}

/**
 * 获取详细熔断统计（新接口）
 */
function getCircuitBreakerDetail() {
    return circuitBreaker.getAllStats();
}

/**
 * 获取重试统计（兼容旧接口）
 */
function getRetryStats() {
    return {
        totalRetries: circuitBreaker.globalStats.totalRetries,
        maxRetries: CircuitConfig.MAX_RETRIES,
        baseDelayMs: CircuitConfig.RETRY_DELAY_BASE_MS
    };
}

const MAX_RETRIES = CircuitConfig.MAX_RETRIES;

module.exports = {
    CircuitConfig,
    CircuitState,
    CircuitRecord,
    CircuitBreaker,
    RetryController,
    circuitBreaker,
    // 兼容旧接口
    isCircuitOpen,
    recordConnectionSuccess,
    recordConnectionFailure,
    getRetryDelay,
    shouldRetry,
    recordRetry,
    getCircuitBreakerStats,
    getCircuitBreakerDetail,
    getRetryStats,
    MAX_RETRIES
};
