// ====================================================================
// 企业库存实时同步微服务 - 入口
// ====================================================================

const http = require('http');
const zlib = require('zlib');
const { CONFIG, validateConfig } = require('./config');
const logger = require('./logger');
const { handlePageRequest } = require('./pages');
const { generateDeviceProfile } = require('./device');
const { handleApiRequest } = require('./api');
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
// 可通过环境变量 ADMIN_TOKEN 设置，未设置时自动生成并在启动日志中输出
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || require('crypto').randomBytes(24).toString('hex');

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
const server = http.createServer((req, res) => {
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
    res.setHeader('Server', 'nginx');
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
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net; connect-src 'self' wss: ws:; frame-ancestors 'self'");
    // HTTP/2 兼容提示（由 PaaS 平台升级，Node.js 服务声明支持）
    res.setHeader('Alt-Svc', 'h2=":443"; ma=86400, h3=":443"; ma=86400');
    res.setHeader('Accept-CH', 'Viewport-Width, Width, DPR, Device-Memory, RTT, Downlink, ECT');
    res.setHeader('Vary', 'Accept-Encoding, Accept-Language, Origin');

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // 统一健康检查（覆盖所有常见 PaaS / K8s / 监控系统端点）
    if (handleHealthCheck(req, res)) return;

    // 分布式追踪与诊断端点（APM 风格，需要调试 Token）
    if (handleTraceRequest(req, res)) return;

    // ---- 管理端点：日志级别动态调整（需要管理员 Token）----
    if (path === '/admin/log-level' || path === '/api/v1/admin/log-level') {
        const adminToken = req.headers['x-admin-token'];
        if (adminToken !== ADMIN_TOKEN) {
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
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
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
            const apiResult = handleApiRequest(req, res);
            if (apiResult === null || apiResult === undefined) {
                return sendNotFound(res);
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

    if (handlePageRequest(req, res)) return;

    // API 限流模拟
    const riskFactor = Math.random();
    if (riskFactor < 0.03) { res.writeHead(429); return res.end('Too Many Requests'); }
    if (riskFactor < 0.06) { res.writeHead(401); return res.end('Unauthorized Token'); }

    // 未知路径返回自定义 404 页面
    return sendNotFound(res);
});

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
        socket.write(`Server: nginx\r\n`);
        socket.write(`X-Powered-By: Express\r\n`);
        socket.write(`Connection: close\r\n`);
        socket.write(`\r\n`);
        socket.write(body);
        socket.destroy();
    }

    // 业务事件推送端点（JSON 文本消息，用于业务伪装）
    if (url.pathname === CONFIG.EVENT_ENDPOINT) {
        logger.debug(`Event stream upgrade accepted: ${url.pathname} from ${clientIp}`);
        eventStreamServer.handleUpgrade(request, socket, head, (ws) => {
            eventStreamServer.emit('connection', ws, request);
        });
        return;
    }

    // 实时业务消息端点（双向业务消息，用于业务伪装）
    if (url.pathname === '/api/v1/realtime') {
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

    // Origin 校验（三档模式，兼顾伪装与兼容性）
    // off:    完全不校验（最兼容，伪装最弱）
    // loose:  只校验 Origin 格式是否为合法 URL（默认，兼容 PaaS 反代场景）
    // strict: 强制 Origin 与 Host 同源（适合 VPS/自托管，伪装最强）
    const originCheckMode = (process.env.ORIGIN_CHECK || 'loose').toLowerCase();
    if (originCheckMode !== 'off') {
        const origin = request.headers.origin;
        if (origin) {
            try {
                const originUrl = new URL(origin);
                if (originCheckMode === 'strict') {
                    const originHost = originUrl.hostname.toLowerCase();
                    const requestHost = (request.headers.host || '').split(':')[0].toLowerCase();
                    if (originHost !== requestHost) {
                        logger.debug(`Sync endpoint upgrade rejected: strict Origin mismatch (${originHost} != ${requestHost}) from ${clientIp}`);
                        sendUpgradeError(403, 'Forbidden', 'Origin header does not match the request host. Cross-origin sync requests are not allowed.');
                        return;
                    }
                }
                // loose 模式：URL 解析成功即通过，不强制同源
            } catch (e) {
                // Origin 格式非法，拒绝（防止异常探测）
                logger.debug(`Sync endpoint upgrade rejected: invalid Origin format (${origin}) from ${clientIp}`);
                sendUpgradeError(400, 'Bad Request', 'Invalid Origin header format. Please provide a valid URL.');
                return;
            }
        }
    }

    logger.debug(`Sync endpoint upgrade accepted: ${url.pathname} from ${clientIp} origin=${request.headers.origin || '(none)'}`);

    connectionServer.handleUpgrade(request, socket, head, (ws) => {
        connectionServer.emit('connection', ws, request);
    });
});

// ---- 运行时状态持久化 ----
const fs = require('fs');
const path = require('path');
const RUNTIME_STATE_FILE = path.join(require('os').tmpdir(), 'inventory-sync-state.json');
const RUNTIME_STATE_SAVE_INTERVAL = 5 * 60 * 1000; // 每 5 分钟保存一次

function saveRuntimeState() {
    try {
        const state = {
            timestamp: Date.now(),
            version: SERVICE_VERSION,
            circuitBreakers: getCircuitBreakerStats(),
            connectionStats: getConnectionStats(),
            savedAt: new Date().toISOString()
        };
        fs.writeFileSync(RUNTIME_STATE_FILE, JSON.stringify(state, null, 2));
        return true;
    } catch (err) {
        logger.warn(`Failed to save runtime state: ${err.message}`);
        return false;
    }
}

function loadRuntimeState() {
    try {
        if (fs.existsSync(RUNTIME_STATE_FILE)) {
            const state = JSON.parse(fs.readFileSync(RUNTIME_STATE_FILE, 'utf8'));
            logger.info(`Runtime state loaded (saved at ${state.savedAt || 'unknown'})`);
            return state;
        }
    } catch (err) {
        logger.warn(`Failed to load runtime state: ${err.message}`);
    }
    return null;
}

// 启动时恢复运行时状态
const runtimeState = loadRuntimeState();

// 定时保存运行时状态
setInterval(() => {
    if (!isShuttingDown) {
        saveRuntimeState();
    }
}, RUNTIME_STATE_SAVE_INTERVAL);

// ---- 优雅关闭 ----
let isShuttingDown = false;
let trafficSimulator = null;
let scheduledJobSimulator = null;
const GRACEFUL_SHUTDOWN_MAX_WAIT = 30000; // 优雅关闭最大等待时间（30秒）

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
    setTimeout(() => {
        logger.error('Shutdown timeout, forcing exit');
        process.exit(1);
    }, CONFIG.SHUTDOWN_TIMEOUT);
}

// 最终关闭步骤
function finalizeShutdown() {
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
        tenantId: CONFIG.ENTERPRISE_TOKEN
    });

    logger.info(`Inventory Sync Service ONLINE | Port: ${CONFIG.PORT}`);
    logger.info(`Platform: ${platform} | Heartbeat: ${platformConfig.pingInterval}ms`);
    logger.info(`Max connections: ${platformConfig.maxConnections} | Idle timeout: ${platformConfig.idleTimeout}ms`);
    if (platformConfig.note) {
        logger.info(`Platform note: ${platformConfig.note}`);
    }
    // 仅在自动生成时输出管理员 Token（环境变量设置的不输出，避免泄露）
    if (!process.env.ADMIN_TOKEN) {
        logger.info(`Admin token (for /admin/log-level): ${ADMIN_TOKEN}`);
    }

    // ---- 优雅启动预热（避免首请求慢）----
    global.__warmedUp = false;
    const dns = require('dns');
    const warmupHosts = ['www.google.com', 'www.gstatic.com', 'example.com', '8.8.8.8'];
    let warmupCompleted = 0;
    warmupHosts.forEach(host => {
        dns.lookup(host, (err) => {
            warmupCompleted++;
            if (err) {
                logger.debug(`DNS warmup: ${host} failed (${err.message})`);
            } else {
                logger.debug(`DNS warmup: ${host} resolved`);
            }
            if (warmupCompleted === warmupHosts.length) {
                global.__warmedUp = true;
                global.__dnsAvailable = warmupHosts.some((h, i) => i < warmupCompleted);
                logger.info(`Startup warmup completed (DNS cache primed, ${warmupHosts.length} hosts)`);
            }
        });
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

    // 事件循环自适应：高延迟时暂停流量模拟器，优先保证代理流量
    onEventLoopStatusChange((status, delayMs) => {
        if (status === 'critical' || status === 'degraded') {
            logger.warn(`Event loop ${status} (${delayMs}ms), pausing traffic simulator to prioritize proxy traffic`);
            if (trafficSimulator) {
                trafficSimulator.stop();
            }
            if (scheduledJobSimulator) {
                scheduledJobSimulator.stop();
            }
        } else if (status === 'healthy') {
            logger.info('Event loop recovered, resuming traffic simulator');
            if (!trafficSimulator) {
                trafficSimulator = startTrafficSimulator(PORT);
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
