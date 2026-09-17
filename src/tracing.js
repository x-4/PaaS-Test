// ====================================================================
// 分布式追踪与诊断模块
// 提供请求追踪、连接追踪、性能剖析、运行时诊断等功能
// 用于企业级可观测性，模拟真实生产环境的 APM 系统
// ====================================================================

const os = require('os');
const v8 = require('v8');
const logger = require('./logger');

// 追踪请求存储（环形缓冲区，最多保留 1000 条）
const MAX_TRACES = 1000;
const requestTraces = [];

// 连接追踪存储
const connectionTraces = new Map();

// 慢请求阈值（毫秒）
const SLOW_REQUEST_THRESHOLD = 1000;

// 生成追踪 ID
function generateTraceId() {
    return 'trace_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
}

// 生成跨度 ID
function generateSpanId() {
    return 'span_' + Math.random().toString(36).substring(2, 10);
}

// 开始请求追踪
function startRequestTrace(req) {
    const traceId = req.headers['x-trace-id'] || generateTraceId();
    const spanId = generateSpanId();
    const startTime = process.hrtime.bigint();

    const trace = {
        traceId,
        spanId,
        parentSpanId: req.headers['x-span-id'] || null,
        method: req.method,
        path: new URL(req.url, 'http://localhost').pathname,
        startTime: new Date().toISOString(),
        startTimeNs: startTime.toString(),
        statusCode: null,
        durationMs: null,
        clientIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        bytesSent: 0,
        error: null
    };

    // 设置响应头，传递追踪信息
    req.trace = trace;
    return trace;
}

// 结束请求追踪
function endRequestTrace(req, res) {
    if (!req.trace) return;

    const endTime = process.hrtime.bigint();
    const durationNs = Number(endTime - BigInt(req.trace.startTimeNs));
    const durationMs = durationNs / 1e6;

    req.trace.statusCode = res.statusCode;
    req.trace.durationMs = Math.round(durationMs * 100) / 100;
    req.trace.bytesSent = res.getHeader('content-length') ? parseInt(res.getHeader('content-length')) : 0;

    // 慢请求记录
    if (durationMs > SLOW_REQUEST_THRESHOLD) {
        logger.warn(`Slow request: ${req.trace.method} ${req.trace.path} took ${durationMs.toFixed(2)}ms (traceId: ${req.trace.traceId})`);
        req.trace.slow = true;
    }

    // 存储追踪（环形缓冲区）
    requestTraces.push(req.trace);
    if (requestTraces.length > MAX_TRACES) {
        requestTraces.shift();
    }

    return req.trace;
}

// 记录连接追踪
function recordConnectionTrace(ws, event, data = {}) {
    const sessionId = ws.syncSessionId || 'unknown';
    if (!connectionTraces.has(sessionId)) {
        connectionTraces.set(sessionId, {
            sessionId,
            clientIp: ws.clientAddr || 'unknown',
            connectedAt: new Date().toISOString(),
            events: [],
            bytesIn: 0,
            bytesOut: 0,
            status: 'active'
        });
    }

    const trace = connectionTraces.get(sessionId);
    trace.events.push({
        event,
        timestamp: new Date().toISOString(),
        ...data
    });

    // 限制事件数量
    if (trace.events.length > 100) {
        trace.events = trace.events.slice(-50);
    }

    // 更新字节数
    if (data.bytesIn) trace.bytesIn += data.bytesIn;
    if (data.bytesOut) trace.bytesOut += data.bytesOut;

    // 连接关闭时清理（保留 5 分钟用于诊断）
    if (event === 'close') {
        trace.status = 'closed';
        trace.closedAt = new Date().toISOString();
        setTimeout(() => {
            connectionTraces.delete(sessionId);
        }, 5 * 60 * 1000);
    }
}

// 获取 V8 堆统计
function getHeapStats() {
    const stats = v8.getHeapStatistics();
    return {
        totalHeapSize: stats.total_heap_size,
        totalHeapSizeExecutable: stats.total_heap_size_executable,
        totalPhysicalSize: stats.total_physical_size,
        totalAvailableSize: stats.total_available_size,
        usedHeapSize: stats.used_heap_size,
        heapSizeLimit: stats.heap_size_limit,
        mallocedMemory: stats.malloced_memory,
        peakMallocedMemory: stats.peak_malloced_memory,
        doesZapGarbage: stats.does_zap_garbage
    };
}

// 获取事件循环延迟（通过采样）
function getEventLoopDelay() {
    return new Promise((resolve) => {
        const start = process.hrtime.bigint();
        setImmediate(() => {
            const delay = Number(process.hrtime.bigint() - start) / 1e6;
            resolve({
                delayMs: Math.round(delay * 100) / 100,
                timestamp: new Date().toISOString()
            });
        });
    });
}

// 获取系统资源使用
function getSystemStats() {
    return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'unknown',
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        memoryUsagePercent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
        loadAvg: os.loadavg(),
        uptime: os.uptime(),
        processUptime: process.uptime(),
        pid: process.pid
    };
}

// 获取进程资源使用
function getProcessStats() {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    return {
        memory: {
            rss: mem.rss,
            heapTotal: mem.heapTotal,
            heapUsed: mem.heapUsed,
            external: mem.external,
            arrayBuffers: mem.arrayBuffers
        },
        cpu: {
            user: cpu.user,
            system: cpu.system
        },
        activeRequests: process._getActiveRequests?.()?.length || 0,
        activeHandles: process._getActiveHandles?.()?.length || 0
    };
}

// 生成完整的追踪报告
async function getTraceReport(options = {}) {
    const { limit = 50, includeConnections = true, includeSystem = true } = options;

    const report = {
        traceId: generateTraceId(),
        generatedAt: new Date().toISOString(),
        service: 'inventory-sync-service',
        version: process.env.npm_package_version || '1.0.0',
        summary: {
            totalTraces: requestTraces.length,
            slowRequests: requestTraces.filter(t => t.slow).length,
            errorRequests: requestTraces.filter(t => t.statusCode >= 400).length,
            activeConnections: connectionTraces.size,
            avgDurationMs: requestTraces.length > 0
                ? Math.round(requestTraces.reduce((sum, t) => sum + (t.durationMs || 0), 0) / requestTraces.length * 100) / 100
                : 0
        },
        recentRequests: requestTraces.slice(-limit).reverse()
    };

    if (includeConnections) {
        report.connections = Array.from(connectionTraces.values()).slice(-20);
    }

    if (includeSystem) {
        report.system = getSystemStats();
        report.process = getProcessStats();
        report.heap = getHeapStats();
        report.eventLoop = await getEventLoopDelay();
    }

    return report;
}

// 处理追踪 HTTP 请求（同步判断端点，异步生成报告）
// 注意：必须同步返回 true/false，否则 async 函数返回的 Promise 在 if 条件中总是 truthy
function handleTraceRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    // 追踪端点列表
    const traceEndpoints = [
        '/debug/trace',
        '/debug/traces',
        '/api/v1/debug/trace',
        '/api/v1/diagnostics',
        '/internal/trace',
        '/_trace'
    ];

    if (!traceEndpoints.includes(path)) return false;

    // 简单的认证（通过 X-Debug-Token 头）
    const debugToken = req.headers['x-debug-token'];
    const expectedToken = process.env.DEBUG_TOKEN || process.env.ADMIN_TOKEN;
    if (expectedToken && debugToken !== expectedToken) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid debug token' }));
        return true;
    }

    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const includeConnections = url.searchParams.get('connections') !== 'false';
    const includeSystem = url.searchParams.get('system') !== 'false';

    // 异步生成报告并发送响应
    getTraceReport({ limit, includeConnections, includeSystem }).then(report => {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Trace-Id': report.traceId
        });
        res.end(JSON.stringify(report, null, 2));
    }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    });

    return true;
}

module.exports = {
    startRequestTrace,
    endRequestTrace,
    recordConnectionTrace,
    getTraceReport,
    handleTraceRequest,
    generateTraceId,
    generateSpanId,
    getHeapStats,
    getEventLoopDelay,
    getSystemStats,
    getProcessStats
};
