// ====================================================================
// DNS 解析缓存服务
// 企业库存同步平台 - 节点地址解析与缓存
// 预解析、乐观刷新、并发查询，降低连接建立延迟
// ====================================================================

const dns = require('dns');
const logger = require('./logger');

/**
 * DNS 缓存条目
 */
class DnsCacheEntry {
    constructor(host, addresses, ttlMs) {
        this.host = host;
        this.addresses = addresses;
        this.expiresAt = Date.now() + ttlMs;
        this.lastRefreshed = Date.now();
        this.refreshInProgress = false;
    }

    get isExpired() {
        return Date.now() > this.expiresAt;
    }

    get shouldRefresh() {
        // 剩余时间不足20%时触发乐观刷新
        const remaining = this.expiresAt - Date.now();
        return remaining > 0 && remaining < (this.expiresAt - this.lastRefreshed) * 0.2;
    }

    get isStale() {
        // 过期后10秒内仍可使用（stale-while-revalidate）
        return Date.now() > this.expiresAt && Date.now() < this.expiresAt + 10000;
    }
}

/**
 * DNS 缓存服务
 */
class DnsCacheService {
    constructor(options = {}) {
        this.cache = new Map();
        this.successTtlMs = options.successTtlMs || 5 * 60 * 1000;  // 成功缓存5分钟
        this.failureTtlMs = options.failureTtlMs || 30 * 1000;       // 失败缓存30秒
        this.resolveTimeoutMs = options.resolveTimeoutMs || 5000;    // 解析超时5秒
        this.maxCacheSize = options.maxCacheSize || 500;             // 最大缓存条目数
        this.stats = {
            totalQueries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            resolveSuccess: 0,
            resolveFailed: 0,
            optimisticRefreshes: 0
        };
    }

    /**
     * 解析域名（带缓存）
     * @param {string} host - 域名或IP
     * @returns {Promise<string>} IP地址
     */
    async resolve(host) {
        this.stats.totalQueries++;

        // IP地址直接返回
        if (this._isIpAddress(host)) {
            this.stats.cacheHits++;
            return host;
        }

        const entry = this.cache.get(host);

        // 缓存命中且未过期
        if (entry && !entry.isExpired) {
            this.stats.cacheHits++;
            // 乐观刷新
            if (entry.shouldRefresh && !entry.refreshInProgress) {
                this._refreshEntry(host, entry);
            }
            return this._pickAddress(entry.addresses);
        }

        // stale-while-revalidate：过期但仍在宽限期内
        if (entry && entry.isStale) {
            this.stats.cacheHits++;
            if (!entry.refreshInProgress) {
                this._refreshEntry(host, entry);
            }
            return this._pickAddress(entry.addresses);
        }

        // 缓存未命中或已过期，执行解析
        this.stats.cacheMisses++;
        return this._resolveAndCache(host);
    }

    /**
     * 预解析多个域名（启动预热）
     * @param {string[]} hosts - 域名列表
     */
    async prefetch(hosts) {
        if (!hosts || hosts.length === 0) return;

        const tasks = hosts.map(host =>
            this.resolve(host).catch(() => null)
        );

        try {
            await Promise.allSettled(tasks);
            logger.info(`DNS prefetch completed: ${hosts.length} hosts`);
        } catch (e) {
            logger.warn(`DNS prefetch error: ${e.message}`);
        }
    }

    /**
     * 执行DNS解析并缓存
     */
    async _resolveAndCache(host) {
        try {
            const addresses = await this._resolveWithTimeout(host);
            this.stats.resolveSuccess++;

            const entry = new DnsCacheEntry(host, addresses, this.successTtlMs);
            this._setCache(host, entry);

            logger.debug(`DNS resolved: ${host} -> ${addresses[0]} (${addresses.length} addrs)`);
            return this._pickAddress(addresses);
        } catch (err) {
            this.stats.resolveFailed++;

            // 失败也缓存短时间，避免重复查询
            const existing = this.cache.get(host);
            if (existing && existing.isStale) {
                // 有stale缓存，继续使用
                return this._pickAddress(existing.addresses);
            }

            const entry = new DnsCacheEntry(host, [], this.failureTtlMs);
            this._setCache(host, entry);

            logger.debug(`DNS resolve failed: ${host} - ${err.message}`);
            throw err;
        }
    }

    /**
     * 带超时的DNS解析
     * 优先 dns.resolve4（c-ares），失败回退 dns.lookup（系统 resolver）。
     * 两个阶段各自受独立超时保护，避免 DNS 服务器无响应时永久挂起。
     */
    _resolveWithTimeout(host) {
        return new Promise((resolve, reject) => {
            let settled = false;
            let timer = null;

            // 统一收尾：防止重复 settle，并清理定时器
            const done = (fn, arg) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                fn(arg);
            };

            // 第一阶段：dns.resolve4 超时
            timer = setTimeout(() => {
                done(reject, new Error('DNS resolution timeout'));
            }, this.resolveTimeoutMs);

            // 优先使用 dns.resolve4（c-ares，绕过系统resolver，更快）
            dns.resolve4(host, (err, addresses) => {
                if (err) {
                    // 回退到 dns.lookup（系统resolver，更兼容）。
                    // 重新计时，给 lookup 分支独立的超时保护，
                    // 否则 DNS 服务器无响应时该分支会永久挂起。
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        done(reject, new Error('DNS lookup timeout'));
                    }, this.resolveTimeoutMs);

                    dns.lookup(host, (lookupErr, address) => {
                        if (lookupErr) {
                            done(reject, lookupErr);
                        } else {
                            done(resolve, [address]);
                        }
                    });
                } else {
                    done(resolve, addresses);
                }
            });
        });
    }

    /**
     * 乐观刷新缓存条目
     */
    _refreshEntry(host, entry) {
        entry.refreshInProgress = true;
        this.stats.optimisticRefreshes++;

        this._resolveWithTimeout(host)
            .then(addresses => {
                if (addresses.length > 0) {
                    entry.addresses = addresses;
                    entry.expiresAt = Date.now() + this.successTtlMs;
                    entry.lastRefreshed = Date.now();
                }
            })
            .catch(() => {
                // 刷新失败不影响现有缓存
            })
            .finally(() => {
                entry.refreshInProgress = false;
            });
    }

    /**
     * 从地址列表中选择一个（简单轮询）
     */
    _pickAddress(addresses) {
        if (!addresses || addresses.length === 0) return null;
        if (addresses.length === 1) return addresses[0];
        // 简单轮询
        const idx = Math.floor(Math.random() * addresses.length);
        return addresses[idx];
    }

    /**
     * 判断是否为IP地址
     */
    _isIpAddress(host) {
        const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6 = /^[0-9a-fA-F:]+$/;
        return ipv4.test(host) || (ipv6.test(host) && host.includes(':'));
    }

    /**
     * 设置缓存（带LRU淘汰）
     */
    _setCache(host, entry) {
        if (this.cache.size >= this.maxCacheSize && !this.cache.has(host)) {
            // 淘汰最旧的条目
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(host, entry);
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const hitRate = this.stats.totalQueries > 0
            ? ((this.stats.cacheHits / this.stats.totalQueries) * 100).toFixed(1)
            : '0.0';
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            hitRate: `${hitRate}%`
        };
    }

    /**
     * 清空缓存
     */
    clear() {
        this.cache.clear();
    }
}

// 全局单例
const dnsCache = new DnsCacheService();

module.exports = {
    DnsCacheService,
    DnsCacheEntry,
    dnsCache
};
