// ====================================================================
// 安全防护模块
// 包含：端点地址过滤、认证事件限流、地址解析缓存
// ====================================================================

const dns = require('dns');
const { CONFIG } = require('./config');
const logger = require('./logger');

// ====================================================================
// 保留地址检测（防止数据流向内部网段）
// ====================================================================
function isReservedAddress(ip) {
    if (!ip || typeof ip !== 'string') return true;

    const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
        const [, a, b] = v4.map(Number);
        if (a === 0) return true;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;
        if (a >= 224 && a <= 239) return true;
        if (a >= 240) return true;
        return false;
    }

    if (ip.includes(':')) {
        const lower = ip.toLowerCase();
        // IPv4 映射地址 ::ffff:x.x.x.x —— 递归检查 IPv4 部分
        const v4mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
        if (v4mapped) {
            return isReservedAddress(v4mapped[1]);
        }
        if (lower === '::1') return true;          // 回环
        if (lower.startsWith('fe80')) return true;  // 链路本地
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // 唯一本地
        if (lower.startsWith('ff')) return true;    // 组播
        if (lower === '::') return true;            // 未指定
    }

    return false;
}

// ====================================================================
// 安全地址解析（拦截解析到保留网段的主机名 + 结果缓存）
// ====================================================================
const endpointCache = new Map();
const ENDPOINT_CACHE_TTL = 300000;      // 成功解析缓存 5 分钟
const ENDPOINT_CACHE_ERROR_TTL = 30000; // 解析失败缓存 30 秒（避免重复查询失败域名）

// DNS 缓存统计
const dnsCacheStats = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    blockedQueries: 0,
    failedQueries: 0
};

function resolveEndpoint(hostname, options, callback) {
    dnsCacheStats.totalQueries++;
    const cached = endpointCache.get(hostname);
    if (cached) {
        const ttl = cached.error ? ENDPOINT_CACHE_ERROR_TTL : ENDPOINT_CACHE_TTL;
        if (Date.now() - cached.time < ttl) {
            dnsCacheStats.cacheHits++;
            if (cached.error) return callback(cached.error);
            return callback(null, cached.address, cached.family);
        }
        // 缓存过期，删除
        endpointCache.delete(hostname);
    }

    dnsCacheStats.cacheMisses++;
    dns.lookup(hostname, options, (err, address, family) => {
        if (err) {
            dnsCacheStats.failedQueries++;
            endpointCache.set(hostname, { error: err, time: Date.now() });
            return callback(err);
        }

        // dns.lookup 在 all:true 时返回数组格式 [{address, family}, ...]
        if (Array.isArray(address)) {
            for (const entry of address) {
                if (entry && isReservedAddress(entry.address)) {
                    dnsCacheStats.blockedQueries++;
                    const blockErr = new Error('Endpoint address not allowed');
                    endpointCache.set(hostname, { error: blockErr, time: Date.now() });
                    return callback(blockErr);
                }
            }
            endpointCache.set(hostname, { address, family, time: Date.now() });
            return callback(null, address, family);
        }

        // 单个地址格式
        if (isReservedAddress(address)) {
            dnsCacheStats.blockedQueries++;
            const blockErr = new Error('Endpoint address not allowed');
            endpointCache.set(hostname, { error: blockErr, time: Date.now() });
            return callback(blockErr);
        }
        endpointCache.set(hostname, { address, family, time: Date.now() });
        callback(null, address, family);
    });
}

// 获取 DNS 缓存统计信息
function getDnsCacheStats() {
    const hitRate = dnsCacheStats.totalQueries > 0
        ? Math.round(dnsCacheStats.cacheHits / dnsCacheStats.totalQueries * 10000) / 100
        : 0;
    return {
        totalQueries: dnsCacheStats.totalQueries,
        cacheHits: dnsCacheStats.cacheHits,
        cacheMisses: dnsCacheStats.cacheMisses,
        blockedQueries: dnsCacheStats.blockedQueries,
        failedQueries: dnsCacheStats.failedQueries,
        cacheSize: endpointCache.size,
        hitRatePercent: hitRate
    };
}

setInterval(() => {
    const now = Date.now();
    for (const [key, val] of endpointCache) {
        if (now - val.time > ENDPOINT_CACHE_TTL) endpointCache.delete(key);
    }
}, 60000);

// ====================================================================
// 认证事件限流（防止令牌被暴力尝试）
// ====================================================================
const authEvents = new Map();

function isClientBlocked(ip) {
    const record = authEvents.get(ip);
    if (!record) return false;
    if (record.restrictedUntil && Date.now() < record.restrictedUntil) return true;
    return false;
}

function recordAuthEvent(ip) {
    let record = authEvents.get(ip);
    if (!record) {
        record = { count: 0, firstEvent: Date.now() };
        authEvents.set(ip, record);
    }
    if (Date.now() - record.firstEvent > CONFIG.AUTH_WINDOW_MS) {
        record.count = 0;
        record.firstEvent = Date.now();
    }
    record.count++;
    if (record.count >= CONFIG.AUTH_MAX_FAILURES) {
        record.restrictedUntil = Date.now() + CONFIG.AUTH_BAN_MS;
        record.count = 0;
        logger.warn(`Access restricted for ${Math.round(CONFIG.AUTH_BAN_MS / 1000)}s`);
    }
}

function clearAuthEvents(ip) {
    authEvents.delete(ip);
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of authEvents) {
        const expired = record.restrictedUntil
            ? now > record.restrictedUntil && now - record.firstEvent > CONFIG.AUTH_WINDOW_MS * 2
            : now - record.firstEvent > CONFIG.AUTH_WINDOW_MS * 2;
        if (expired) authEvents.delete(ip);
    }
}, 60000);

// ====================================================================
// 基于 IP 的并发连接数限制（防止单 IP 耗尽资源）
// ====================================================================
const ipConnectionCount = new Map();

function getConnectionCount(ip) {
    return ipConnectionCount.get(ip) || 0;
}

function incrementConnection(ip) {
    const count = (ipConnectionCount.get(ip) || 0) + 1;
    ipConnectionCount.set(ip, count);
    return count;
}

function decrementConnection(ip) {
    const count = (ipConnectionCount.get(ip) || 0) - 1;
    if (count <= 0) {
        ipConnectionCount.delete(ip);
    } else {
        ipConnectionCount.set(ip, count);
    }
    return count;
}

function isIpConnectionLimitReached(ip) {
    return getConnectionCount(ip) >= CONFIG.MAX_CONNECTIONS_PER_IP;
}

function getTotalTrackedIps() {
    return ipConnectionCount.size;
}

// ====================================================================
// 工具：提取客户端地址
// ====================================================================
// 验证 IP 地址格式（IPv4 或 IPv6）
function isValidIp(ip) {
    if (!ip || typeof ip !== 'string') return false;
    // IPv4
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6（简化验证）
    const ipv6 = /^[0-9a-fA-F:]+$/;
    return ipv4.test(ip) || ipv6.test(ip);
}

function getClientAddress(req) {
    // PaaS 平台通常有反向代理，X-Forwarded-For 可信
    // 但需验证格式，防止恶意输入绕过 IP 封禁
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const firstIp = forwarded.split(',')[0].trim();
        if (isValidIp(firstIp)) {
            return firstIp;
        }
        // 格式不合法时回退到 socket 地址，避免被伪造
    }
    return req.socket.remoteAddress || 'unknown';
}

module.exports = {
    isReservedAddress,
    resolveEndpoint,
    getDnsCacheStats,
    isClientBlocked,
    recordAuthEvent,
    clearAuthEvents,
    getClientAddress,
    getConnectionCount,
    incrementConnection,
    decrementConnection,
    isIpConnectionLimitReached,
    getTotalTrackedIps
};
