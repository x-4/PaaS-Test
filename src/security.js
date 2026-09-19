// ====================================================================
// 安全防护模块
// 包含：端点地址过滤、认证事件限流、地址解析缓存
// ====================================================================

const dns = require('dns');
const net = require('net');
const { CONFIG } = require('./config');
const logger = require('./logger');

// ====================================================================
// IPv6 地址解析为 8 组 16 位数值（支持压缩、展开、IPv4映射、IPv4兼容）
// 返回 null 表示无效地址
// ====================================================================
function parseIPv6Groups(ip) {
    if (!ip || typeof ip !== 'string' || !ip.includes(':')) return null;
    const lower = ip.toLowerCase().trim();

    // 处理 IPv4 映射/兼容形式（末尾是 x.x.x.x）
    let v4Suffix = null;
    let v6Part = lower;
    const v4Match = lower.match(/^(.+):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (v4Match) {
        v6Part = v4Match[1];
        const v4Bytes = v4Match[2].split('.').map(Number);
        if (v4Bytes.some(b => b < 0 || b > 255)) return null;
        // 将 IPv4 转为两组 16 位
        v4Suffix = [(v4Bytes[0] << 8) | v4Bytes[1], (v4Bytes[2] << 8) | v4Bytes[3]];
    }

    // 处理 :: 压缩
    let groups;
    if (v6Part.includes('::')) {
        const parts = v6Part.split('::');
        if (parts.length > 2) return null;
        const left = parts[0] ? parts[0].split(':') : [];
        const right = parts[1] ? parts[1].split(':') : [];
        const missing = 8 - left.length - right.length - (v4Suffix ? 2 : 0);
        if (missing < 0) return null;
        groups = [...left, ...Array(missing).fill('0'), ...right];
    } else {
        groups = v6Part.split(':');
    }

    if (v4Suffix) {
        if (groups.length !== 6) return null;
        groups = [...groups, v4Suffix[0].toString(16), v4Suffix[1].toString(16)];
    }

    if (groups.length !== 8) return null;

    // 解析每组为数值
    const result = [];
    for (const g of groups) {
        if (g === '') return null;
        const val = parseInt(g, 16);
        if (isNaN(val) || val < 0 || val > 0xffff) return null;
        result.push(val);
    }
    return result;
}

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
        const groups = parseIPv6Groups(ip);
        if (!groups) return true; // 无法解析的地址视为不安全

        // 全零地址 ::
        if (groups.every(g => g === 0)) return true;

        // 回环 ::1
        if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
            groups[3] === 0 && groups[4] === 0 && groups[5] === 0 &&
            groups[6] === 0 && groups[7] === 1) return true;

        // IPv4 映射地址 ::ffff:x.x.x.x（groups[0..4]=0, groups[5]=0xffff）
        if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
            groups[3] === 0 && groups[4] === 0 && groups[5] === 0xffff) {
            // 还原 IPv4 地址并递归判定
            const v4a = (groups[6] >> 8) & 0xff;
            const v4b = groups[6] & 0xff;
            const v4c = (groups[7] >> 8) & 0xff;
            const v4d = groups[7] & 0xff;
            return isReservedAddress(`${v4a}.${v4b}.${v4c}.${v4d}`);
        }

        // IPv4 兼容地址 ::x.x.x.x（groups[0..5]=0, groups[6..7] 非零）
        if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
            groups[3] === 0 && groups[4] === 0 && groups[5] === 0 &&
            (groups[6] !== 0 || groups[7] !== 0)) {
            const v4a = (groups[6] >> 8) & 0xff;
            const v4b = groups[6] & 0xff;
            const v4c = (groups[7] >> 8) & 0xff;
            const v4d = groups[7] & 0xff;
            return isReservedAddress(`${v4a}.${v4b}.${v4c}.${v4d}`);
        }

        // 链路本地 fe80::/10（groups[0] & 0xffc0 === 0xfe80，覆盖 fe80-febf）
        if ((groups[0] & 0xffc0) === 0xfe80) return true;

        // 唯一本地 fc00::/7（groups[0] & 0xfe00 === 0xfc00，覆盖 fc00-fdff）
        if ((groups[0] & 0xfe00) === 0xfc00) return true;

        // 组播 ff00::/8
        if ((groups[0] & 0xff00) === 0xff00) return true;

        // 6to4 2002::/16（保留段，部分平台视为内网）
        if (groups[0] === 0x2002) return true;

        // NAT64 64:ff9b::/96（用于 IPv4 转换，可能指向内网）
        if (groups[0] === 0x0064 && groups[1] === 0xff9b) return true;
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

const _endpointCacheTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of endpointCache) {
        if (now - val.time > ENDPOINT_CACHE_TTL) endpointCache.delete(key);
    }
}, 60000);
if (_endpointCacheTimer.unref) _endpointCacheTimer.unref();

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

const _authEventsTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of authEvents) {
        const expired = record.restrictedUntil
            ? now > record.restrictedUntil && now - record.firstEvent > CONFIG.AUTH_WINDOW_MS * 2
            : now - record.firstEvent > CONFIG.AUTH_WINDOW_MS * 2;
        if (expired) authEvents.delete(ip);
    }
}, 60000);
if (_authEventsTimer.unref) _authEventsTimer.unref();

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
// 使用 net.isIP 严格校验，防止恶意输入绕过 IP 封禁
function isValidIp(ip) {
    if (!ip || typeof ip !== 'string') return false;
    return net.isIP(ip) !== 0;
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
