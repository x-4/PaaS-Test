// ====================================================================
// 企业库存实时同步微服务 - 入口
// ====================================================================

// 进程名伪装（避免被平台识别为异常进程）
process.title = 'node inventory-sync-service';

const http = require('http');
const crypto = require('crypto');
const zlib = require('zlib');
const { CONFIG, validateConfig } = require('./config');
const logger = require('./logger');

/**
 * 发送 JSON 响应（API 错误处理用）
 */
function jsonResponse(res, data, statusCode = 200) {
    const body = JSON.stringify(data);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

const { handlePageRequest } = require('./pages');
const { generateDeviceProfile } = require('./device');
const { handleApiRequest, startDataSimulator, stopDataSimulator } = require('./api');
const UserBehaviorSimulator = require('./business/user-simulator');
let userSimulator = null;
const fingerprint = require('./system/fingerprint');
const environmentFingerprint = require('./system/environment-fingerprint');
const temporalEngine = require('./business/temporal-engine');
const correlationEngine = require('./business/correlation-engine');
const { SessionOrchestrator } = require('./business/session-orchestrator');
let sessionOrchestrator = null;
const { handleStaticRequest, sendNotFound } = require('./static');
const { createConnectionServer, getActiveConnectionCount, getConnectionStats, getCircuitBreakerStats, cleanupIdleConnections, healthCheckConnections, shutdownConnections } = require('./connection');
const { createEventStreamServer } = require('./event-stream');
const { handleRealtimeUpgrade } = require('./realtime-ws');
const { handleTraceRequest, startRequestTrace, endRequestTrace } = require('./tracing');
const { handleDocsRequest } = require('./swagger');
const {
    setupProcessErrorHandlers,
    setupMemoryMonitor,
    setupEventLoopMonitor,
    setupConnectionHealthCheck,
    setupFdMonitor,
    configureHttpServerTimeouts,
    getResilienceStats,
    onEventLoopStatusChange
} = require('./resilience');
const { detectPlatform, getPlatformConfig } = require('./platform');
const { destroyTenantKey } = require('./auth');
const { startTrafficSimulator, startScheduledJobSimulator } = require('./traffic-simulator');
const simulatorTrafficController = require('./system/simulator-traffic-controller');
const { getDnsCacheStats } = require('./security');
const { getRetryStats } = require('./circuit');
const { getSyncStats } = require('./sync-facade');
const { eventBus } = require('./event-bus');

// ---- 启动前配置校验 ----
try {
    validateConfig();
} catch (err) {
    console.error('[FATAL] Configuration validation failed:', err.message);
    process.exit(1);
}

// ---- 平台检测 ----
const platform = detectPlatform();
const platformConfig = getPlatformConfig();

// ---- 健康检查端点定义（覆盖主流 PaaS / K8s / 监控系统） ----
const LIVENESS_ENDPOINTS = ['/livez', '/live', '/ping'];
const READINESS_ENDPOINTS = ['/readyz', '/ready'];
const FULL_HEALTH_ENDPOINTS = [
    '/health', '/healthz', '/status', '/api/status', '/api/health',
    '/healthcheck', '/api/v1/health', '/api/v1/status',
    '/internal/health', '/_status', '/_health'
];
const INFO_ENDPOINTS = ['/version', '/info'];
const METRICS_ENDPOINTS = ['/metrics', '/prometheus', '/debug/vars', '/stats'];
const ALL_HEALTH_ENDPOINTS = [...LIVENESS_ENDPOINTS, ...READINESS_ENDPOINTS, ...FULL_HEALTH_ENDPOINTS, ...INFO_ENDPOINTS, ...METRICS_ENDPOINTS];

const SERVICE_VERSION = '1.0.0';
const SERVICE_NAME = 'inventory-sync-service';

// 管理员 Token（用于 /admin/log-level 等管理端点认证）
// 可通过环境变量 ADMIN_TOKEN 设置，未设置时自动生成且不会输出到日志
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || require('crypto').randomBytes(24).toString('hex');

// 恒定时间字符串比较，防止时序侧信道攻击
function safeCompare(a, b) {
    if (!a || !b) return false;
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(d + 'd');
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'm');
    parts.push(s + 's');
    return parts.join(' ');
}

function getHealthData() {
    const mem = process.memoryUsage();
    const connStats = getConnectionStats();
    const syncStats = getSyncStats(); // 通过门面获取同步统计
    return {
        status: 'UP',
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime()),
        activeConnections: getActiveConnectionCount(),
        maxConnections: platformConfig.maxConnections,
        connectionStats: {
            total: connStats.totalConnections,
            active: connStats.activeConnections,
            completed: connStats.completedConnections,
            avgDurationMs: connStats.avgDurationMs,
            maxDurationMs: connStats.maxDurationMs
        },
        syncService: syncStats, // 门面统计（业务视角）
        memory: {
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
            external: Math.round(mem.external / 1024 / 1024) + 'MB'
        },
        platform: platform,
        pid: process.pid,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
    };
}

function handleHealthCheck(req, res) {
    const path = new URL(req.url, 'http://localhost').pathname;
    const method = req.method;

    if (!ALL_HEALTH_ENDPOINTS.includes(path)) return false;
    if (method !== 'GET' && method !== 'HEAD') return false;

    const data = getHealthData();

    // 存活探针：最简单，仅表示进程存活
    if (LIVENESS_ENDPOINTS.includes(path)) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        if (method === 'HEAD') { res.end(); return true; }
        res.end(JSON.stringify({ status: 'UP', timestamp: data.timestamp }));
        return true;
    }

    // 就绪探针：检查资源是否在安全范围内 + 依赖检查
    if (READINESS_ENDPOINTS.includes(path)) {
        const memMB = parseInt(data.memory.heapUsed);
        const memoryOk = memMB < CONFIG.MEMORY_LIMIT_MB;
        const connOk = data.activeConnections < data.maxConnections;
        const dnsOk = global.__dnsAvailable !== false; // DNS 预热状态
        const warmedUp = global.__warmedUp === true; // 启动预热完成状态
        const ready = memoryOk && connOk && warmedUp;

        res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        if (method === 'HEAD') { res.end(); return true; }
        res.end(JSON.stringify({
            status: ready ? 'READY' : 'NOT_READY',
            checks: {
                memory: memoryOk ? 'pass' : 'fail',
                connections: connOk ? 'pass' : 'fail',
                dns: dnsOk ? 'pass' : 'warn',
                warmedUp: warmedUp ? 'pass' : 'fail'
            },
            details: {
                memoryUsed: data.memory.heapUsed,
                memoryLimit: CONFIG.MEMORY_LIMIT_MB + 'MB',
                activeConnections: data.activeConnections,
                maxConnections: data.maxConnections,
                uptime: process.uptime().toFixed(1) + 's'
            }
        }));
        return true;
    }

    // Prometheus 指标格式
    if (METRICS_ENDPOINTS.includes(path)) {
        const mem = process.memoryUsage();
        const connStats = getConnectionStats();
        const dnsStats = getDnsCacheStats();
        const retryStats = getRetryStats();
        const cbStats = getCircuitBreakerStats();
        const resilienceStats = getResilienceStats();
        const openCircuits = cbStats.filter(c => c.state === 'open').length;
        const halfOpenCircuits = cbStats.filter(c => c.state === 'half-open').length;

        const metrics = [
            // ---- 服务状态 ----
            '# HELP inventory_sync_up Service is up',
            '# TYPE inventory_sync_up gauge',
            'inventory_sync_up 1',
            '# HELP inventory_sync_uptime_seconds Service uptime in seconds',
            '# TYPE inventory_sync_uptime_seconds gauge',
            `inventory_sync_uptime_seconds ${data.uptime}`,

            // ---- 连接统计 ----
            '# HELP inventory_sync_active_connections Active WebSocket connections',
            '# TYPE inventory_sync_active_connections gauge',
            `inventory_sync_active_connections ${data.activeConnections}`,
            '# HELP inventory_sync_total_connections Total WebSocket connections',
            '# TYPE inventory_sync_total_connections counter',
            `inventory_sync_total_connections ${connStats.totalConnections}`,
            '# HELP inventory_sync_completed_connections Completed WebSocket connections',
            '# TYPE inventory_sync_completed_connections counter',
            `inventory_sync_completed_connections ${connStats.completedConnections}`,
            '# HELP inventory_sync_avg_connection_duration_ms Average connection duration in milliseconds',
            '# TYPE inventory_sync_avg_connection_duration_ms gauge',
            `inventory_sync_avg_connection_duration_ms ${connStats.avgDurationMs}`,

            // ---- 内存统计 ----
            '# HELP inventory_sync_memory_heap_used_bytes Heap memory used in bytes',
            '# TYPE inventory_sync_memory_heap_used_bytes gauge',
            `inventory_sync_memory_heap_used_bytes ${mem.heapUsed}`,
            '# HELP inventory_sync_memory_heap_total_bytes Heap memory total in bytes',
            '# TYPE inventory_sync_memory_heap_total_bytes gauge',
            `inventory_sync_memory_heap_total_bytes ${mem.heapTotal}`,
            '# HELP inventory_sync_memory_rss_bytes Resident set size in bytes',
            '# TYPE inventory_sync_memory_rss_bytes gauge',
            `inventory_sync_memory_rss_bytes ${mem.rss}`,
            '# HELP inventory_sync_memory_usage_percent Memory usage percentage',
            '# TYPE inventory_sync_memory_usage_percent gauge',
            `inventory_sync_memory_usage_percent ${resilienceStats.memory.usagePercent}`,

            // ---- DNS 缓存统计 ----
            '# HELP inventory_sync_dns_queries_total Total DNS queries',
            '# TYPE inventory_sync_dns_queries_total counter',
            `inventory_sync_dns_queries_total ${dnsStats.totalQueries}`,
            '# HELP inventory_sync_dns_cache_hits_total DNS cache hits',
            '# TYPE inventory_sync_dns_cache_hits_total counter',
            `inventory_sync_dns_cache_hits_total ${dnsStats.cacheHits}`,
            '# HELP inventory_sync_dns_cache_misses_total DNS cache misses',
            '# TYPE inventory_sync_dns_cache_misses_total counter',
            `inventory_sync_dns_cache_misses_total ${dnsStats.cacheMisses}`,
            '# HELP inventory_sync_dns_cache_hit_rate_percent DNS cache hit rate percent',
            '# TYPE inventory_sync_dns_cache_hit_rate_percent gauge',
            `inventory_sync_dns_cache_hit_rate_percent ${dnsStats.hitRatePercent}`,
            '# HELP inventory_sync_dns_cache_size DNS cache entry count',
            '# TYPE inventory_sync_dns_cache_size gauge',
            `inventory_sync_dns_cache_size ${dnsStats.cacheSize}`,
            '# HELP inventory_sync_dns_blocked_queries_total DNS queries blocked by SSRF filter',
            '# TYPE inventory_sync_dns_blocked_queries_total counter',
            `inventory_sync_dns_blocked_queries_total ${dnsStats.blockedQueries}`,

            // ---- 重试与熔断统计 ----
            '# HELP inventory_sync_retries_total Total connection retries',
            '# TYPE inventory_sync_retries_total counter',
            `inventory_sync_retries_total ${retryStats.totalRetries}`,
            '# HELP inventory_sync_retry_successes_total Successful retries',
            '# TYPE inventory_sync_retry_successes_total counter',
            `inventory_sync_retry_successes_total ${retryStats.retrySuccesses}`,
            '# HELP inventory_sync_retry_failures_total Failed retries',
            '# TYPE inventory_sync_retry_failures_total counter',
            `inventory_sync_retry_failures_total ${retryStats.retryFailures}`,
            '# HELP inventory_sync_circuit_breakers_open Number of open circuit breakers',
            '# TYPE inventory_sync_circuit_breakers_open gauge',
            `inventory_sync_circuit_breakers_open ${openCircuits}`,
            '# HELP inventory_sync_circuit_breakers_half_open Number of half-open circuit breakers',
            '# TYPE inventory_sync_circuit_breakers_half_open gauge',
            `inventory_sync_circuit_breakers_half_open ${halfOpenCircuits}`,

            // ---- 性能统计 ----
            '# HELP inventory_sync_event_loop_delay_ms Event loop delay in milliseconds',
            '# TYPE inventory_sync_event_loop_delay_ms gauge',
            `inventory_sync_event_loop_delay_ms ${resilienceStats.eventLoop.delayMs}`,

            // ---- 错误统计 ----
            '# HELP inventory_sync_uncaught_exceptions_total Total uncaught exceptions',
            '# TYPE inventory_sync_uncaught_exceptions_total counter',
            `inventory_sync_uncaught_exceptions_total ${resilienceStats.errors.uncaughtExceptions}`,
            '# HELP inventory_sync_unhandled_rejections_total Total unhandled rejections',
            '# TYPE inventory_sync_unhandled_rejections_total counter',
            `inventory_sync_unhandled_rejections_total ${resilienceStats.errors.unhandledRejections}`,

            // ---- 版本信息 ----
            '# HELP inventory_sync_nodejs_version_info Node.js version info',
            '# TYPE inventory_sync_nodejs_version_info gauge',
            `inventory_sync_nodejs_version_info{version="${process.version}"} 1`
        ].join('\n') + '\n';

        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8', 'Cache-Control': 'no-store' });
        if (method === 'HEAD') { res.end(); return true; }
        res.end(metrics);
        return true;
    }

    // 版本/信息端点
    if (INFO_ENDPOINTS.includes(path)) {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        if (method === 'HEAD') { res.end(); return true; }
        res.end(JSON.stringify({
            name: SERVICE_NAME,
            version: SERVICE_VERSION,
            description: 'Enterprise Inventory Real-time Synchronization Microservice',
            platform: platform,
            nodeVersion: process.version,
            uptime: data.uptimeFormatted,
            startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString()
        }));
        return true;
    }

    // 完整健康检查
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    if (method === 'HEAD') { res.end(); return true; }
    res.end(JSON.stringify(data));
    return true;
}

// ---- HTTP 服务 ----
// HTTP 请求方法分布统计（流量特征伪装）
const httpMethodStats = {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    HEAD: 0,
    OPTIONS: 0,
    PATCH: 0
};

const server = http.createServer((req, res) => {
    // 记录请求方法分布（流量特征伪装）
    if (httpMethodStats.hasOwnProperty(req.method)) {
        httpMethodStats[req.method]++;
    }

    // ---- HTTP 方法白名单：只允许常用方法，拒绝危险方法（TRACE/CONNECT等）----
    const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'];
    if (!ALLOWED_METHODS.includes(req.method)) {
        res.writeHead(405, { 'Content-Type': 'text/plain', 'Allow': ALLOWED_METHODS.join(', ') });
        res.end('Method Not Allowed');
        return;
    }

    // ---- 请求级上下文：请求 ID + 计时 + 客户端信息 ----
    const requestId = logger.generateRequestId();
    const reqStartTime = Date.now();
    const reqClientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '-';
    const reqUserAgent = req.headers['user-agent'] || '-';
    const reqReferer = req.headers['referer'] || '-';

    // 开始分布式追踪（APM 风格）
    const trace = startRequestTrace(req);

    // 在响应头中注入请求 ID 和追踪 ID（便于全链路追踪）
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Trace-ID', trace.traceId);
    res.setHeader('X-Span-ID', trace.spanId);

    // ---- gzip 压缩支持：对文本类型响应自动压缩 ----
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const supportsGzip = acceptEncoding.includes('gzip');
    const COMPRESSIBLE_TYPES = ['text/html', 'application/json', 'text/css', 'application/javascript', 'application/xml', 'text/plain', 'image/svg+xml'];
    const originalEnd = res.end.bind(res);
    const originalWriteHead = res.writeHead.bind(res);
    let compressionEnabled = false;
    let pendingStatus = 200;
    let pendingHeaders = null;
    let writeHeadDeferred = false;

    // 重写 writeHead：延迟发送响应头，等待压缩判断
    res.writeHead = function(statusCode, headers) {
        pendingStatus = statusCode;
        pendingHeaders = headers || {};
        writeHeadDeferred = true;

        // 检测 Content-Type，判断是否需要压缩
        if (supportsGzip) {
            for (const [name, value] of Object.entries(pendingHeaders)) {
                if (name.toLowerCase() === 'content-type') {
                    const contentType = String(value).toLowerCase();
                    if (COMPRESSIBLE_TYPES.some(type => contentType.includes(type))) {
                        compressionEnabled = true;
                    }
                }
            }
        }
        return res;
    };

    // 重写 end：压缩后发送响应头和数据
    res.end = function(chunk, encoding, callback) {
        // 如果有延迟的 writeHead，现在发送
        if (writeHeadDeferred) {
            if (compressionEnabled && chunk) {
                // 需要压缩：先压缩，再发送
                zlib.gzip(chunk, (err, compressed) => {
                    if (err) {
                        // 压缩失败，发送原始数据
                        originalWriteHead(pendingStatus, pendingHeaders);
                        originalEnd(chunk, encoding, callback);
                    } else {
                        pendingHeaders['Content-Encoding'] = 'gzip';
                        pendingHeaders['Content-Length'] = compressed.length;
                        originalWriteHead(pendingStatus, pendingHeaders);
                        originalEnd(compressed, encoding, callback);
                    }
                });
                return;
            } else {
                // 不需要压缩，直接发送
                originalWriteHead(pendingStatus, pendingHeaders);
            }
        }
        originalEnd(chunk, encoding, callback);
    };

    res.on('finish', () => {
        const contentLength = res.getHeader('Content-Length') || 0;
        const durationMs = Date.now() - reqStartTime;
        // 结构化访问日志（nginx combined 格式 + 请求 ID + 响应时间）
        logger.logAccess(requestId, req.method, req.url, res.statusCode, durationMs, contentLength, reqUserAgent, reqReferer, reqClientIp);
        // 慢请求记录（超过 1 秒自动告警）
        logger.logSlowRequest(requestId, req.method, req.url, durationMs, 1000);
        // 结束分布式追踪
        endRequestTrace(req, res);
    });

    // ---- 企业级安全响应头（模拟真实生产环境）----
    res.setHeader('X-Powered-By', 'Express');
    res.setHeader('Server', 'SyncFlow Enterprise Sync Gateway/2.4.1');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    // TLS / HSTS（模拟启用 HTTPS 的生产环境，由 PaaS 反向代理终止 TLS）
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    // Content-Security-Policy（现代企业应用标准）
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' wss: ws:; frame-ancestors 'self'");
    // HTTP/2 兼容提示（由 PaaS 平台升级，Node.js 服务声明支持）
    res.setHeader('Alt-Svc', 'h2=":443"; ma=86400, h3=":443"; ma=86400');
    res.setHeader('Accept-CH', 'Viewport-Width, Width, DPR, Device-Memory, RTT, Downlink, ECT');
    res.setHeader('Vary', 'Accept-Encoding, Accept-Language, Origin');

    // ---- 业务特征响应头（伪装为真实企业服务）----
    res.setHeader('X-Service-Name', 'inventory-sync-service');
    res.setHeader('X-Service-Version', '1.0.0');
    res.setHeader('X-Environment', process.env.NODE_ENV || 'production');
    res.setHeader('X-Region', process.env.NODE_REGION || 'us-east-1');
    res.setHeader('X-Instance-Id', 'inst-' + process.pid.toString(36));
    res.setHeader('X-Request-Start', Date.now().toString());
    res.setHeader('X-Upstream-Cache-Status', Math.random() > 0.3 ? 'MISS' : 'HIT');
    res.setHeader('X-CDN-Provider', 'cloudflare');
    res.setHeader('X-B3-TraceId', res.getHeader('X-Trace-ID') || 'unknown');
    res.setHeader('X-B3-SpanId', res.getHeader('X-Span-ID') || 'unknown');
    res.setHeader('X-B3-Sampled', '1');

    let url;
    try {
        url = new URL(req.url, `http://${req.headers.host}`);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request URL', code: 'BAD_REQUEST' }));
        return;
    }
    const path = url.pathname;

    // 统一健康检查（覆盖所有常见 PaaS / K8s / 监控系统端点）
    if (handleHealthCheck(req, res)) return;

    // 分布式追踪与诊断端点（APM 风格，需要调试 Token）
    if (handleTraceRequest(req, res)) return;

    // ---- 管理端点：日志级别动态调整（需要管理员 Token）----
    if (path === '/admin/log-level' || path === '/api/v1/admin/log-level') {
        const adminToken = req.headers['x-admin-token'];
        if (!safeCompare(adminToken, ADMIN_TOKEN)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid admin token' }));
            return;
        }
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ level: logger.getLevel(), available: ['error', 'warn', 'info', 'debug', 'trace'] }));
            return;
        }
        if (req.method === 'POST' || req.method === 'PUT') {
            const MAX_ADMIN_BODY_SIZE = 1 * 1024 * 1024; // 1MB 上限，防止大请求体耗尽内存
            let body = '';
            let bodyRejected = false;
            req.on('data', chunk => {
                if (bodyRejected) return;
                body += chunk;
                if (body.length > MAX_ADMIN_BODY_SIZE) {
                    bodyRejected = true;
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Request Entity Too Large', message: 'Request body exceeds 1MB limit' }));
                    req.destroy();
                }
            });
            req.on('end', () => {
                if (bodyRejected) return;
                try {
                    const { level } = JSON.parse(body || '{}');
                    if (logger.setLevel(level)) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, level: logger.getLevel() }));
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid level', available: ['error', 'warn', 'info', 'debug', 'trace'] }));
                    }
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }
        res.writeHead(405); res.end();
        return;
    }

    // 静态资源（favicon / robots.txt / sitemap.xml / manifest.json 等）
    const staticResult = handleStaticRequest(req, res);
    if (staticResult === true) return;

    // API 文档（Swagger UI 风格）
    if (path.startsWith('/api/docs')) {
        if (handleDocsRequest(req, res, path)) return;
    }

    // 业务 API 端点（添加随机处理延迟，模拟真实业务耗时）
    if (path.startsWith('/api/') && !path.startsWith('/api/v1/auth/device/')) {
        const apiDelay = 5 + Math.random() * 75; // 5-80ms 随机延迟
        setTimeout(() => {
            try {
                const apiResult = handleApiRequest(req, res);
                if (apiResult === null || apiResult === undefined) {
                    return sendNotFound(res);
                }
            } catch (err) {
                logger.error('API request handler error', err.message);
                if (!res.headersSent) {
                    return jsonResponse(res, { error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
                }
            }
        }, apiDelay);
        return;
    }

    // 边缘节点配置下发
    if (req.method === 'GET' && path === '/api/v1/auth/device/' + CONFIG.ENTERPRISE_TOKEN) {
        return generateDeviceProfile(req, res);
    }

    // 页面路由（仪表盘、登录、库存、仓库、同步、设置、文档、关于）
    // 页面访问设置会话 Cookie，模拟真实用户会话
    if (req.method === 'GET' && !path.startsWith('/api/') && !path.startsWith('/health') && !path.startsWith('/metrics')) {
        if (!req.headers.cookie || !req.headers.cookie.includes('syncflow_session')) {
            const sessionId = require('crypto').randomBytes(16).toString('hex');
            res.setHeader('Set-Cookie', `syncflow_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
        }
    }

    // 流量时序混淆：对页面请求添加随机延迟，模拟真实用户网络行为
    // 仅对页面请求生效，不影响 API、健康检查和 WebSocket
    const isPageRequest = req.method === 'GET' &&
                          !path.startsWith('/api/') &&
                          !path.startsWith('/health') &&
                          !path.startsWith('/ready') &&
                          !path.startsWith('/live') &&
                          !path.startsWith('/metrics') &&
                          !path.startsWith('/debug') &&
                          !path.startsWith('/cdn/') &&
                          path !== '/favicon.ico' &&
                          path !== '/robots.txt';

    if (isPageRequest) {
        // 5-30ms 随机延迟，模拟真实用户网络延迟和服务器处理时间
        const jitterDelay = Math.floor(Math.random() * 25) + 5;
        setTimeout(() => {
            _handleRequest(req, res, path, requestId, trace);
        }, jitterDelay);
        return;
    }

    _handleRequest(req, res, path, requestId, trace);
});

// 实际请求处理函数
function _handleRequest(req, res, path, requestId, trace) {
    // 结束分布式追踪（在响应结束时）
    const originalEnd = res.end.bind(res);
    res.end = function(...args) {
        endRequestTrace(trace, res.statusCode);
        originalEnd(...args);
    };

    if (handlePageRequest(req, res)) return;

    // 未知路径返回随机业务错误（伪装为正常业务系统的错误响应）
    return sendBusinessError(req, res, path);
}

// 随机业务错误生成器（伪装为企业库存系统的正常错误）
function sendBusinessError(req, res, path) {
    const errors = [
        { status: 404, code: 'WAREHOUSE_NOT_FOUND', message: 'Warehouse location not found', detail: `The requested warehouse path "${path}" does not exist in the inventory system.` },
        { status: 404, code: 'SKU_NOT_FOUND', message: 'SKU not found in catalog', detail: `The requested resource could not be located in the product catalog.` },
        { status: 410, code: 'SYNC_JOB_EXPIRED', message: 'Sync job has expired', detail: 'This synchronization job is no longer available. Please create a new sync task.' },
        { status: 422, code: 'INVENTORY_LOCKED', message: 'Inventory record is locked', detail: 'This inventory record is currently locked by another synchronization process.' },
        { status: 503, code: 'WAREHOUSE_MAINTENANCE', message: 'Warehouse node under maintenance', detail: 'The target warehouse node is currently undergoing scheduled maintenance.' },
        { status: 503, code: 'SYNC_QUEUE_FULL', message: 'Sync queue is at capacity', detail: 'The synchronization queue is currently full. Please retry your request later.' }
    ];
    const error = errors[Math.floor(Math.random() * errors.length)];
    const requestId = res.getHeader('X-Request-ID') || 'unknown';

    // 根据 Accept 头返回不同格式：浏览器请求返回 HTML 错误页，API 请求返回 JSON
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
        res.writeHead(error.status, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${error.code} - SyncFlow</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; min-height: 100vh; display: flex; flex-direction: column; }
        .header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-size: 20px; font-weight: 700; color: #2563eb; }
        .nav { display: flex; gap: 24px; }
        .nav a { color: #64748b; text-decoration: none; font-size: 14px; }
        .nav a:hover { color: #2563eb; }
        .container { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; }
        .error-card { background: #fff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 48px; max-width: 560px; width: 100%; text-align: center; }
        .error-code { font-size: 72px; font-weight: 800; color: #2563eb; margin-bottom: 8px; }
        .error-title { font-size: 24px; font-weight: 600; margin-bottom: 12px; }
        .error-detail { color: #64748b; margin-bottom: 24px; line-height: 1.6; }
        .search-box { display: flex; gap: 8px; margin-bottom: 24px; }
        .search-box input { flex: 1; padding: 10px 16px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
        .search-box button { padding: 10px 20px; background: #2563eb; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
        .actions { display: flex; gap: 12px; justify-content: center; }
        .btn { padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
        .btn-primary { background: #2563eb; color: #fff; }
        .btn-secondary { background: #f1f5f9; color: #475569; }
        .footer { background: #fff; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center; color: #94a3b8; font-size: 12px; }
        .error-meta { margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">SyncFlow</div>
        <div class="nav">
            <a href="/">Dashboard</a>
            <a href="/inventory">Inventory</a>
            <a href="/warehouses">Warehouses</a>
            <a href="/sync">Sync Jobs</a>
            <a href="/docs">API Docs</a>
        </div>
    </div>
    <div class="container">
        <div class="error-card">
            <div class="error-code">${error.status}</div>
            <div class="error-title">${error.message}</div>
            <div class="error-detail">${error.detail}</div>
            <div class="search-box">
                <input type="text" placeholder="Search inventory, warehouses, sync jobs..." />
                <button>Search</button>
            </div>
            <div class="actions">
                <a href="/" class="btn btn-primary">Back to Dashboard</a>
                <a href="/docs" class="btn btn-secondary">View Documentation</a>
            </div>
            <div class="error-meta">
                Error Code: ${error.code} | Request ID: ${requestId} | Service: inventory-sync-service v1.0.0
            </div>
        </div>
    </div>
    <div class="footer">
        © 2026 SyncFlow Enterprise. All rights reserved. | Inventory Sync Platform
    </div>
</body>
</html>`);
    } else {
        res.writeHead(error.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: {
                code: error.code,
                message: error.message,
                detail: error.detail,
                timestamp: new Date().toISOString(),
                requestId: requestId,
                service: 'inventory-sync-service',
                version: '1.0.0',
                documentation: `https://docs.syncflow.example.com/errors/${error.code.toLowerCase()}`
            }
        }));
    }
}

// ---- TCP 层优化 ----
server.on('connection', (socket) => {
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 60000);
});

// 配置 HTTP 服务器超时（请求超时、Keep-Alive 超时、请求头超时等）
configureHttpServerTimeouts(server);

// ---- WebSocket 升级处理 ----
const connectionServer = createConnectionServer();
const eventStreamServer = createEventStreamServer();

server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const clientIp = request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.socket.remoteAddress;

    // 发送业务风格的 WebSocket 升级失败响应（伪装为企业服务错误页面）
    function sendUpgradeError(statusCode, message, detail) {
        const body = JSON.stringify({
            error: message,
            detail: detail,
            service: 'inventory-sync-service',
            timestamp: new Date().toISOString(),
            support: 'https://docs.syncflow.example.com/errors'
        });
        socket.write(`HTTP/1.1 ${statusCode} ${message}\r\n`);
        socket.write(`Content-Type: application/json; charset=utf-8\r\n`);
        socket.write(`Content-Length: ${Buffer.byteLength(body)}\r\n`);
        socket.write(`Server: SyncFlow Enterprise Sync Gateway/2.4.1\r\n`);
        socket.write(`X-Powered-By: Express\r\n`);
        socket.write(`Connection: close\r\n`);
        socket.write(`\r\n`);
        socket.write(body);
        socket.destroy();
    }

    // Origin 校验（三档模式，兼顾伪装与兼容性）
    // off:    完全不校验（最兼容，伪装最弱）
    // loose:  只校验 Origin 格式是否为合法 URL（默认，兼容 PaaS 反代场景）
    // strict: 强制 Origin 与 Host 同源（适合 VPS/自托管，伪装最强）
    // 返回 true 表示通过，false 表示已拒绝（已发送错误响应并销毁 socket）
    function checkOrigin(endpointLabel) {
        const originCheckMode = (process.env.ORIGIN_CHECK || 'loose').toLowerCase();
        if (originCheckMode === 'off') return true;
        const origin = request.headers.origin;
        if (!origin) return true; // 无 Origin 头（如 Node 客户端），放行
        try {
            const originUrl = new URL(origin);
            if (originCheckMode === 'strict') {
                const originHost = originUrl.hostname.toLowerCase();
                const requestHost = (request.headers.host || '').split(':')[0].toLowerCase();
                if (originHost !== requestHost) {
                    logger.debug(`${endpointLabel} upgrade rejected: strict Origin mismatch (${originHost} != ${requestHost}) from ${clientIp}`);
                    sendUpgradeError(403, 'Forbidden', 'Origin header does not match the request host. Cross-origin requests are not allowed.');
                    return false;
                }
            }
            // loose 模式：URL 解析成功即通过，不强制同源
            return true;
        } catch (e) {
            logger.debug(`${endpointLabel} upgrade rejected: invalid Origin format (${origin}) from ${clientIp}`);
            sendUpgradeError(400, 'Bad Request', 'Invalid Origin header format. Please provide a valid URL.');
            return false;
        }
    }

    // 业务事件推送端点（JSON 文本消息，用于业务伪装）
    if (url.pathname === CONFIG.EVENT_ENDPOINT) {
        // 连接上限：单端点最多 100 个并发连接（防止内存耗尽）
        if (eventStreamServer.clients && eventStreamServer.clients.size >= 100) {
            socket.destroy();
            return;
        }
        logger.debug(`Event stream upgrade accepted: ${url.pathname} from ${clientIp}`);
        eventStreamServer.handleUpgrade(request, socket, head, (ws) => {
            eventStreamServer.emit('connection', ws, request);
        });
        return;
    }

    // 实时业务消息端点（双向业务消息，用于业务伪装）
    if (url.pathname === '/api/v1/realtime') {
        // Origin 校验（复用与同步端点相同的三档校验逻辑）
        if (!checkOrigin('Realtime')) return;
        // 连接上限在 handleRealtimeUpgrade 内部检查
        logger.debug(`Realtime WS upgrade accepted: ${url.pathname} from ${clientIp}`);
        handleRealtimeUpgrade(request, socket, head);
        return;
    }

    // 实时数据同步端点（多路径，客户端可任选其一，含额外配置的端点）
    const allStreamEndpoints = [...CONFIG.STREAM_ENDPOINTS, ...CONFIG.EXTRA_STREAM_ENDPOINTS];
    if (!allStreamEndpoints.includes(url.pathname)) {
        logger.debug(`Sync endpoint upgrade rejected: invalid endpoint (${url.pathname}) from ${clientIp}`);
        sendUpgradeError(404, 'Not Found', `The sync endpoint '${url.pathname}' does not exist. Valid endpoints: ${CONFIG.STREAM_ENDPOINTS.join(', ')}`);
        return;
    }

    // Origin 校验（复用 checkOrigin，与 realtime 端点一致的三档校验逻辑）
    if (!checkOrigin('Sync endpoint')) return;

    logger.debug(`Sync endpoint upgrade accepted: ${url.pathname} from ${clientIp} origin=${request.headers.origin || '(none)'}`);

    connectionServer.handleUpgrade(request, socket, head, (ws) => {
        connectionServer.emit('connection', ws, request);
    });
});

// ---- 优雅关闭 ----
let isShuttingDown = false;
let trafficSimulator = null;
let scheduledJobSimulator = null;
const GRACEFUL_SHUTDOWN_MAX_WAIT = 30000; // 优雅关闭最大等待时间（30秒）

// 运行时状态保存（内存存储模式下为空操作，保留接口供未来扩展）
function saveRuntimeState() {
    // 运行时状态存储在内存中，进程退出后自然清除
    // 此函数保留为扩展点，如需持久化可在此实现
}

let shutdownWatchdog = null;

function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    const startTime = Date.now();
    const activeCount = getActiveConnectionCount();
    logger.info(`Received ${signal}, initiating graceful shutdown... (active sessions: ${activeCount})`);

    // 1. 停止流量模拟器和定时任务
    if (trafficSimulator) {
        trafficSimulator.stop();
        trafficSimulator = null;
    }
    if (scheduledJobSimulator) {
        scheduledJobSimulator.stop();
        scheduledJobSimulator = null;
    }

    // 2. 停止接受新 HTTP 连接
    server.close(() => {
        logger.info('HTTP server closed (no new connections accepted)');
    });

    // 3. 关闭业务事件推送流
    if (eventStreamServer) {
        eventStreamServer.close();
    }

    // 4. 保存运行时状态（熔断状态等）
    try {
        saveRuntimeState();
        logger.info('Runtime state saved');
    } catch (err) {
        logger.warn(`Failed to save runtime state: ${err.message}`);
    }

    // 5. 等待已有连接完成（最多 30 秒）
    if (activeCount > 0) {
        logger.info(`Waiting for ${activeCount} active session(s) to complete (max ${GRACEFUL_SHUTDOWN_MAX_WAIT / 1000}s)...`);
        const waitInterval = setInterval(() => {
            const remaining = getActiveConnectionCount();
            const elapsed = Date.now() - startTime;
            if (remaining === 0) {
                clearInterval(waitInterval);
                logger.info(`All sessions completed gracefully (${elapsed}ms)`);
                finalizeShutdown();
            } else if (elapsed >= GRACEFUL_SHUTDOWN_MAX_WAIT) {
                clearInterval(waitInterval);
                logger.warn(`Graceful shutdown timeout (${GRACEFUL_SHUTDOWN_MAX_WAIT / 1000}s), forcing ${remaining} session(s) to close`);
                shutdownConnections();
                setTimeout(finalizeShutdown, 1000);
            }
        }, 500);
    } else {
        // 没有活跃连接，直接关闭
        shutdownConnections();
        setTimeout(finalizeShutdown, 500);
    }

    // 最终关闭兜底（防止卡住）
    shutdownWatchdog = setTimeout(() => {
        logger.error('Shutdown timeout, forcing exit');
        process.exit(1);
    }, CONFIG.SHUTDOWN_TIMEOUT);
}

// 最终关闭步骤
function finalizeShutdown() {
    // 清除兜底看门狗，正常关闭不应触发强制退出
    if (shutdownWatchdog) {
        clearTimeout(shutdownWatchdog);
        shutdownWatchdog = null;
    }
    // 停止三个模拟器（方案一/二/三）
    try { stopDataSimulator(); } catch (e) { logger.error('Failed to stop data simulator', e.message); }
    try { if (userSimulator) userSimulator.stop(); } catch (e) { logger.error('Failed to stop user simulator', e.message); }
    try { environmentFingerprint.stop(); } catch (e) { logger.error('Failed to stop environment fingerprint', e.message); }
    try { temporalEngine.stop(); } catch (e) { logger.error('Failed to stop temporal engine', e.message); }
    try { correlationEngine.stop(); } catch (e) { logger.error('Failed to stop correlation engine', e.message); }
    try { if (sessionOrchestrator) sessionOrchestrator.stop(); } catch (e) { logger.error('Failed to stop session orchestrator', e.message); }
    try { fingerprint.stop(); } catch (e) { logger.error('Failed to stop fingerprint simulator', e.message); }
    // 安全销毁租户密钥
    destroyTenantKey();
    logger.info('Graceful shutdown completed');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ---- 进程级错误处理（分级处理，非致命异常不崩溃）----
setupProcessErrorHandlers(gracefulShutdown);

// ---- 启动 ----
server.listen(CONFIG.PORT, () => {
    // 输出完整的启动环境信息（企业级服务标准）
    logger.logStartupInfo({
        serviceName: SERVICE_NAME,
        version: SERVICE_VERSION,
        port: CONFIG.PORT,
        platform: platform,
        maxConnections: platformConfig.maxConnections,
        idleTimeout: platformConfig.idleTimeout,
        memoryLimitMB: CONFIG.MEMORY_LIMIT_MB,
        tenantConfigured: true
    });

    logger.info(`Inventory Sync Service ONLINE | Port: ${CONFIG.PORT}`);
    logger.info(`Platform: ${platform} | Heartbeat: ${platformConfig.pingInterval}ms`);
    logger.info(`Max connections: ${platformConfig.maxConnections} | Idle timeout: ${platformConfig.idleTimeout}ms`);
    if (platformConfig.note) {
        logger.info(`Platform note: ${platformConfig.note}`);
    }
    // 管理员 Token 已就绪（不输出到日志，避免泄露到平台日志）
    // 如需查看，请通过环境变量 ADMIN_TOKEN 显式设置
    if (!process.env.ADMIN_TOKEN) {
        logger.info('Admin token auto-generated (set ADMIN_TOKEN env to override)');
    } else {
        logger.info('Admin token loaded from environment');
    }

    // ---- 启动业务数据生命周期引擎（方案一：库存波动、任务流转、仓库负载）----
    try {
        startDataSimulator();
    } catch (e) {
        logger.error('Failed to start data lifecycle engine', e.message);
    }

    // ---- 启动真实用户行为轨迹模拟器（方案二：多用户、真实UA、正确Referer、会话持续）----
    try {
        // 启动流量控制器（配额管控+智能降频）
        simulatorTrafficController.start();
        userSimulator = new UserBehaviorSimulator(CONFIG.PORT, CONFIG.SIMULATOR_HOST);
        userSimulator.start();
    } catch (e) {
        logger.error('Failed to start user behavior simulator', e.message);
    }

    // ---- 启动系统运行指纹模拟器（方案三：数据库连接池、缓存、消息队列、GC、定时任务）----
    try {
        fingerprint.start();
        environmentFingerprint.start();
        temporalEngine.start();
        correlationEngine.start();
        sessionOrchestrator = new SessionOrchestrator(CONFIG.PORT, CONFIG.SIMULATOR_HOST);
        sessionOrchestrator.start();
    } catch (e) {
        logger.error('Failed to start system fingerprint simulator', e.message);
    }

    // ---- 优雅启动预热（避免首请求慢）----
    global.__warmedUp = false;
    const { dnsCache } = require('./dns-cache');
    const warmupHosts = [
        'www.google.com', 'www.gstatic.com', 'example.com', '8.8.8.8',
        'mail.google.com', 'github.com', 'api.github.com', 'cdnjs.cloudflare.com'
    ];
    dnsCache.prefetch(warmupHosts).then(() => {
        global.__warmedUp = true;
        global.__dnsAvailable = true;
        const stats = dnsCache.getStats();
        logger.info(`Startup warmup completed (DNS cache primed, ${stats.cacheSize} hosts, hitRate=${stats.hitRate})`);
    }).catch(() => {
        global.__warmedUp = true;
        logger.info('Startup warmup: DNS prefetch completed with some failures');
    });
        // 预热超时保护：3秒后强制标记为已预热
    setTimeout(() => {
        if (!global.__warmedUp) {
            global.__warmedUp = true;
            logger.info('Startup warmup: timeout reached, marking as ready');
        }
    }, 3000);

    // 启动业务流量模拟器（产生正常 HTTP 请求，避免只有 WebSocket 的异常流量特征）
    const simulateTraffic = process.env.SIMULATE_TRAFFIC !== 'false';
    trafficSimulator = startTrafficSimulator(CONFIG.PORT, simulateTraffic);

    // 启动定时任务模拟器（产生同步任务日志，模拟真实业务运行）
    scheduledJobSimulator = startScheduledJobSimulator();

    // ---- 启动稳定性监控模块 ----
    setupMemoryMonitor(getActiveConnectionCount, cleanupIdleConnections);
    setupEventLoopMonitor();
    setupConnectionHealthCheck(getActiveConnectionCount, getConnectionStats);
    setupFdMonitor(cleanupIdleConnections); // 文件描述符监控

    // 事件循环自适应：高延迟时暂停流量模拟器，优先保证同步流量
    onEventLoopStatusChange((status, delayMs) => {
        if (status === 'critical' || status === 'degraded') {
            logger.warn(`Event loop ${status} (${delayMs}ms), pausing traffic simulator to prioritize sync traffic`);
            if (trafficSimulator) {
                trafficSimulator.stop();
                trafficSimulator = null;
            }
            if (scheduledJobSimulator) {
                scheduledJobSimulator.stop();
                scheduledJobSimulator = null;
            }
        } else if (status === 'healthy') {
            logger.info('Event loop recovered, resuming traffic simulator');
            if (!trafficSimulator) {
                trafficSimulator = startTrafficSimulator(CONFIG.PORT, process.env.SIMULATE_TRAFFIC !== 'false');
            }
            if (!scheduledJobSimulator) {
                scheduledJobSimulator = startScheduledJobSimulator();
            }
        }
    });

    // 连接健康巡检：每分钟检测假活连接并自动清理
    setInterval(() => {
        try {
            healthCheckConnections();
        } catch (err) {
            logger.warn(`Connection health check error: ${err.message}`);
        }
    }, 60000);

    logger.info('Resilience modules: all started (memory/event-loop/connection-health)');
});
