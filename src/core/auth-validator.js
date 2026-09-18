// ====================================================================
// 租户认证验证器
// 企业库存同步平台 - 租户身份验证与访问控制
// 负责验证租户签名、记录认证事件、限流控制
// ====================================================================

const logger = require('../logger');
const { CONFIG } = require('../config');

/**
 * 认证结果类
 * 封装认证验证结果
 */
class AuthResult {
    constructor(success, options = {}) {
        this.success = success;
        this.tenantId = options.tenantId || null;
        this.reason = options.reason || null;
        this.clientAddress = options.clientAddress || null;
        this.authenticatedAt = Date.now();
    }

    /**
     * 是否认证成功
     */
    get isAuthenticated() {
        return this.success;
    }

    /**
     * 是否认证失败
     */
    get isFailed() {
        return !this.success;
    }

    /**
     * 转换为日志格式
     */
    toLogFormat() {
        return {
            success: this.success,
            tenant: this.tenantId ? '***' : null,
            reason: this.reason,
            client: this.clientAddress,
            at: new Date(this.authenticatedAt).toISOString()
        };
    }
}

/**
 * 认证事件记录器
 * 记录客户端认证事件，用于限流和异常检测
 */
class AuthEventLogger {
    constructor() {
        this.events = new Map();  // clientAddr -> { count, firstAt, lastAt }
        this.maxEvents = 1000;
    }

    /**
     * 记录一次认证事件
     */
    record(clientAddress) {
        if (!clientAddress) return;

        let event = this.events.get(clientAddress);
        if (!event) {
            event = { count: 0, firstAt: Date.now(), lastAt: Date.now() };
            this.events.set(clientAddress, event);
        }
        event.count++;
        event.lastAt = Date.now();

        // 清理过期事件（超过1小时）
        this._cleanup();
    }

    /**
     * 清除客户端的认证事件
     */
    clear(clientAddress) {
        if (clientAddress) {
            this.events.delete(clientAddress);
        }
    }

    /**
     * 获取客户端认证失败次数
     */
    getFailureCount(clientAddress) {
        const event = this.events.get(clientAddress);
        return event ? event.count : 0;
    }

    /**
     * 检查客户端是否被限流
     */
    isRateLimited(clientAddress) {
        const count = this.getFailureCount(clientAddress);
        return count >= CONFIG.AUTH_MAX_FAILURES;
    }

    /**
     * 清理过期事件
     */
    _cleanup() {
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;
        for (const [addr, event] of this.events) {
            if (now - event.lastAt > ONE_HOUR) {
                this.events.delete(addr);
            }
        }
        // 限制最大记录数
        if (this.events.size > this.maxEvents) {
            const oldest = [...this.events.entries()]
                .sort((a, b) => a[1].lastAt - b[1].lastAt)
                .slice(0, this.events.size - this.maxEvents);
            oldest.forEach(([addr]) => this.events.delete(addr));
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            trackedClients: this.events.size,
            totalFailures: [...this.events.values()].reduce((sum, e) => sum + e.count, 0)
        };
    }
}

// 全局认证事件记录器实例
const authEventLogger = new AuthEventLogger();

/**
 * 租户认证验证器
 * 验证租户签名并处理认证流程
 */
class TenantAuthenticator {
    constructor() {
        this.eventLogger = authEventLogger;
    }

    /**
     * 验证批次数据中的租户签名
     * @param {Buffer} batchData - 批次数据
     * @param {string} clientAddress - 客户端地址
     * @returns {AuthResult} 认证结果
     */
    authenticate(batchData, clientAddress) {
        const { verifyTenantSignature } = require('../auth');

        // 检查限流
        if (this.eventLogger.isRateLimited(clientAddress)) {
            logger.warn(`Auth rate limited: ${clientAddress}`);
            return new AuthResult(false, {
                reason: 'rate_limited',
                clientAddress
            });
        }

        // 验证租户签名
        const isValid = verifyTenantSignature(batchData);

        // 安全清零：认证完成后立即清零缓冲区中的敏感数据（UUID区域）
        const { zeroizeSensitiveBuffer } = require('../auth');
        zeroizeSensitiveBuffer(batchData, 1, 16);

        if (!isValid) {
            this.eventLogger.record(clientAddress);
            logger.debug(`Auth failed: invalid signature from ${clientAddress}`);
            return new AuthResult(false, {
                reason: 'invalid_signature',
                clientAddress
            });
        }

        // 认证成功，清除失败记录
        this.eventLogger.clear(clientAddress);

        return new AuthResult(true, {
            tenantId: CONFIG.TENANT_ID,
            clientAddress
        });
    }

    /**
     * 记录认证失败事件（外部调用）
     */
    recordFailure(clientAddress) {
        this.eventLogger.record(clientAddress);
    }

    /**
     * 清除认证事件（外部调用）
     */
    clearEvents(clientAddress) {
        this.eventLogger.clear(clientAddress);
    }

    /**
     * 获取认证统计
     */
    getStats() {
        return this.eventLogger.getStats();
    }
}

// 全局认证器实例
const authenticator = new TenantAuthenticator();

/**
 * 兼容旧接口：记录认证事件
 */
function recordAuthEvent(clientAddress) {
    authEventLogger.record(clientAddress);
}

/**
 * 兼容旧接口：清除认证事件
 */
function clearAuthEvents(clientAddress) {
    authEventLogger.clear(clientAddress);
}

module.exports = {
    AuthResult,
    AuthEventLogger,
    TenantAuthenticator,
    authenticator,
    recordAuthEvent,
    clearAuthEvents
};
