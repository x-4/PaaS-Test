// ====================================================================
// 企业库存实时同步微服务 - 入口
// ====================================================================

const http = require('http');
const { CONFIG, validateConfig } = require('./config');
const logger = require('./logger');
const { handlePageRequest } = require('./pages');
const { generateDeviceProfile } = require('./device');
const { handleApiRequest } = require('./api');
const { handleStaticRequest, sendNotFound } = require('./static');
const { createTransportServer, getActiveConnectionCount, shutdownTransport } = require('./transport');
const { detectPlatform, getPlatformConfig } = require('./platform');
const { destroyTenantKey } = require('./auth');

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
const FULL_HEALTH_ENDPOINTS = ['/health', '/healthz', '/status', '/api/status', '/api/health'];
const INFO_ENDPOINTS = ['/version', '/info'];
const METRICS_ENDPOINTS = ['/metrics', '/prometheus'];
const ALL_HEALTH_ENDPOINTS = [...LIVENESS_ENDPOINTS, ...READINESS_ENDPOINTS, ...FULL_HEALTH_ENDPOINTS, ...INFO_ENDPOINTS, ...METRICS_ENDPOINTS];

const SERVICE_VERSION = '1.0.0';
const SERVICE_NAME = 'inventory-sync-service';

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
    return {
        status: 'UP',
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime()),
        activeConnections: getActiveConnectionCount(),
        maxConnections: platformConfig.maxConnections,
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

    // 就绪探针：检查资源是否在安全范围内
    if (READINESS_ENDPOINTS.includes(path)) {
        const memMB = parseInt(data.memory.heapUsed);
        const memoryOk = memMB < CONFIG.MEMORY_LIMIT_MB;
        const connOk = data.activeConnections < data.maxConnections;
        const ready = memoryOk && connOk;

        res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        if (method === 'HEAD') { res.end(); return true; }
        res.end(JSON.stringify({
            status: ready ? 'READY' : 'NOT_READY',
            checks: {
                memory: memoryOk ? 'pass' : 'fail',
                connections: connOk ? 'pass' : 'fail'
            },
            details: {
                memoryUsed: data.memory.heapUsed,
                memoryLimit: CONFIG.MEMORY_LIMIT_MB + 'MB',
                activeConnections: data.activeConnections,
                maxConnections: data.maxConnections
            }
        }));
        return true;
    }

    // Prometheus 指标格式
    if (METRICS_ENDPOINTS.includes(path)) {
        const mem = process.memoryUsage();
        const metrics = [
            '# HELP inventory_sync_up Service is up',
            '# TYPE inventory_sync_up gauge',
            'inventory_sync_up 1',
            '# HELP inventory_sync_active_connections Active WebSocket connections',
            '# TYPE inventory_sync_active_connections gauge',
            `inventory_sync_active_connections ${data.activeConnections}`,
            '# HELP inventory_sync_uptime_seconds Service uptime in seconds',
            '# TYPE inventory_sync_uptime_seconds gauge',
            `inventory_sync_uptime_seconds ${data.uptime}`,
            '# HELP inventory_sync_memory_heap_used_bytes Heap memory used in bytes',
            '# TYPE inventory_sync_memory_heap_used_bytes gauge',
            `inventory_sync_memory_heap_used_bytes ${mem.heapUsed}`,
            '# HELP inventory_sync_memory_rss_bytes Resident set size in bytes',
            '# TYPE inventory_sync_memory_rss_bytes gauge',
            `inventory_sync_memory_rss_bytes ${mem.rss}`,
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
    // 响应头伪装：模拟常见企业 Web 服务器
    res.setHeader('X-Powered-By', 'Express');
    res.setHeader('Server', 'nginx');

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // 统一健康检查（覆盖所有常见 PaaS / K8s / 监控系统端点）
    if (handleHealthCheck(req, res)) return;

    // 静态资源（favicon / robots.txt / sitemap.xml）
    const staticResult = handleStaticRequest(req, res);
    if (staticResult === true) return;

    // 业务 API 端点
    const apiResult = handleApiRequest(req, res);
    if (apiResult !== null && apiResult !== undefined) return;

    // 边缘节点配置下发
    if (req.method === 'GET' && path === '/api/v1/auth/device/' + CONFIG.ENTERPRISE_TOKEN) {
        return generateDeviceProfile(req, res);
    }

    // 页面路由（仪表盘、登录、库存、仓库、同步、设置、文档、关于）
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
server.keepAliveTimeout = 120000;
server.requestTimeout = 30000;
server.headersTimeout = 30000;

// ---- WebSocket 升级处理 ----
const transportServer = createTransportServer();

server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    // 仅允许指定端点升级
    if (url.pathname !== CONFIG.SYNC_ENDPOINT) {
        socket.destroy();
        return;
    }

    // 来源校验：防止跨站连接劫持
    const origin = request.headers.origin;
    if (origin) {
        try {
            const originHost = new URL(origin).hostname.toLowerCase();
            const requestHost = (request.headers.host || '').split(':')[0].toLowerCase();
            if (originHost !== requestHost) {
                socket.destroy();
                return;
            }
        } catch (e) {
            socket.destroy();
            return;
        }
    }

    transportServer.handleUpgrade(request, socket, head, (ws) => {
        transportServer.emit('connection', ws, request);
    });
});

// ---- 内存监控 ----
setInterval(() => {
    const mem = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    if (heapMB > CONFIG.MEMORY_LIMIT_MB) {
        logger.warn(`Memory usage: ${heapMB}MB / ${CONFIG.MEMORY_LIMIT_MB}MB`);
    }
}, 30000);

// ---- 优雅关闭 ----
let isShuttingDown = false;

function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, shutting down...`);

    server.close(() => {
        logger.info('HTTP server closed');
    });

    shutdownTransport();

    // 安全销毁租户密钥
    destroyTenantKey();

    setTimeout(() => {
        logger.error('Shutdown timeout, forcing exit');
        process.exit(1);
    }, CONFIG.SHUTDOWN_TIMEOUT);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ---- 进程级错误处理 ----
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err.message);
    gracefulShutdown('uncaughtException');
    setTimeout(() => process.exit(1), 2000);
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
});

// ---- 启动 ----
server.listen(CONFIG.PORT, () => {
    logger.info(`Inventory Sync Service ONLINE | Port: ${CONFIG.PORT}`);
    logger.info(`Platform: ${platform} | Heartbeat: ${platformConfig.pingInterval}ms`);
    logger.info(`Max connections: ${platformConfig.maxConnections} | Idle timeout: ${platformConfig.idleTimeout}ms`);
    if (platformConfig.note) {
        logger.info(`Platform note: ${platformConfig.note}`);
    }
});
