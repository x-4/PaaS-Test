// ====================================================================
// 服务韧性与稳定性模块
// 负责：全局异常分级处理、内存监控与自动清理、事件循环延迟监控、
//       连接健康巡检、HTTP 服务器超时配置、自动恢复机制
// 目标：自适应、自处理一切异常，保证长期稳定运行
// ====================================================================

const logger = require('./logger');
const { CONFIG } = require('./config');

// 异常计数（用于分级处理）
const errorStats = {
    uncaughtExceptions: 0,
    unhandledRejections: 0,
    lastExceptionTime: 0,
    consecutiveErrors: 0
};

// 内存历史（用于检测内存泄漏趋势）
const memoryHistory = [];
const MEMORY_HISTORY_MAX = 30; // 保留最近 30 次采样

// 事件循环延迟监控
let eventLoopDelay = 0;
let lastEventLoopCheck = Date.now();

// ---- 全局异常分级处理 ----
// 策略：
// 1. unhandledRejection：仅记录日志，不崩溃（大多数 Promise 拒绝是临时的）
// 2. uncaughtException：
//    - 单次异常：记录详细日志，不立即崩溃（尝试继续运行）
//    - 短时间内连续异常（5秒内超过3次）：判定为致命，优雅关闭
//    - 特定致命错误（内存不足、端口占用）：立即关闭
function setupProcessErrorHandlers(gracefulShutdownFn) {
    // 未处理的 Promise 拒绝：仅记录，不崩溃
    process.on('unhandledRejection', (reason, promise) => {
        errorStats.unhandledRejections++;
        errorStats.consecutiveErrors++;
        logger.error(`Unhandled Rejection (count: ${errorStats.unhandledRejections}):`, reason?.message || reason);
        if (reason?.stack) {
            logger.debug(`Rejection stack: ${reason.stack}`);
        }
        // 重置连续错误计数（异步错误通常不影响主循环）
        setTimeout(() => { errorStats.consecutiveErrors = Math.max(0, errorStats.consecutiveErrors - 1); }, 10000);
    });

    // 未捕获的异常：分级处理
    process.on('uncaughtException', (err, origin) => {
        errorStats.uncaughtExceptions++;
        const now = Date.now();
        const timeSinceLast = now - errorStats.lastExceptionTime;
        errorStats.lastExceptionTime = now;

        // 短时间内连续异常（5秒内）
        if (timeSinceLast < 5000) {
            errorStats.consecutiveErrors++;
        } else {
            errorStats.consecutiveErrors = 1;
        }

        logger.error(`Uncaught Exception (count: ${errorStats.uncaughtExceptions}, consecutive: ${errorStats.consecutiveErrors}):`);
        logger.error(`  Message: ${err.message}`);
        logger.error(`  Origin: ${origin}`);
        if (err.stack) {
            logger.error(`  Stack: ${err.stack}`);
        }

        // 致命错误判定
        const isFatal =
            err.message?.includes('Cannot set headers after they are sent') ||
            err.message?.includes('Out of memory') ||
            err.message?.includes('EADDRINUSE') ||
            err.code === 'ERR_MEMORY_ALLOCATION_FAILED' ||
            errorStats.consecutiveErrors >= 3; // 5秒内连续3次异常

        if (isFatal) {
            logger.error('Fatal error detected, initiating graceful shutdown...');
            if (gracefulShutdownFn) {
                gracefulShutdownFn('uncaughtException-fatal');
            }
            setTimeout(() => process.exit(1), 3000);
        } else {
            // 非致命异常：记录后继续运行
            logger.warn(`Non-fatal exception, continuing operation. Consecutive errors: ${errorStats.consecutiveErrors}/3`);
        }
    });

    // 警告信息（如内存警告）
    process.on('warning', (warning) => {
        logger.warn(`Process Warning: ${warning.name}: ${warning.message}`);
        if (warning.stack) {
            logger.debug(`Warning stack: ${warning.stack}`);
        }
    });

    logger.info('Process error handlers: configured (分级异常处理已启用)');
}

// ---- 内存监控与自动清理 ----
function setupMemoryMonitor(getActiveConnectionsFn, cleanupIdleConnectionsFn) {
    setInterval(() => {
        const mem = process.memoryUsage();
        const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
        const rssMB = Math.round(mem.rss / 1024 / 1024);

        // 记录内存历史
        memoryHistory.push({ time: Date.now(), heapMB, rssMB });
        if (memoryHistory.length > MEMORY_HISTORY_MAX) {
            memoryHistory.shift();
        }

        // 内存超过 80% 阈值：警告
        if (heapMB > CONFIG.MEMORY_LIMIT_MB * 0.8) {
            logger.warn(`Memory usage high: heap=${heapMB}MB (${Math.round(heapMB / CONFIG.MEMORY_LIMIT_MB * 100)}%), rss=${rssMB}MB`);
        }

        // 内存超过 90% 阈值：主动清理
        if (heapMB > CONFIG.MEMORY_LIMIT_MB * 0.9) {
            logger.warn(`Memory critical (${heapMB}MB), triggering cleanup...`);

            // 清理空闲连接
            if (cleanupIdleConnectionsFn) {
                const cleaned = cleanupIdleConnectionsFn();
                logger.info(`Cleaned up ${cleaned} idle connections`);
            }

            // 尝试触发 GC（如果可用）
            if (global.gc) {
                global.gc();
                logger.info('Garbage collection triggered');
            }
        }

        // 内存泄漏趋势检测：最近 10 次采样持续增长超过 50%
        if (memoryHistory.length >= 10) {
            const recent = memoryHistory.slice(-10);
            const avgFirst = recent.slice(0, 3).reduce((s, m) => s + m.heapMB, 0) / 3;
            const avgLast = recent.slice(-3).reduce((s, m) => s + m.heapMB, 0) / 3;
            if (avgFirst > 0 && avgLast > avgFirst * 1.5 && avgLast > 50) {
                logger.warn(`Possible memory leak detected: heap grew from ${Math.round(avgFirst)}MB to ${Math.round(avgLast)}MB in last ${memoryHistory.length * 30}s`);
            }
        }
    }, 30000); // 每 30 秒采样一次

    logger.info(`Memory monitor: started (threshold: ${CONFIG.MEMORY_LIMIT_MB}MB, cleanup at 90%)`);
}

// ---- 事件循环延迟监控 ----
function setupEventLoopMonitor() {
    // 使用 setInterval 检测事件循环延迟
    setInterval(() => {
        const now = Date.now();
        const delay = now - lastEventLoopCheck - 5000; // 预期 5 秒
        lastEventLoopCheck = now;
        eventLoopDelay = Math.max(0, delay);

        if (eventLoopDelay > 1000) {
            logger.warn(`Event loop delay: ${eventLoopDelay}ms (event loop may be blocked)`);
        }
    }, 5000);

    logger.info('Event loop monitor: started (warning at >1000ms)');
}

// ---- 连接健康巡检 ----
function setupConnectionHealthCheck(getConnectionsFn, getConnectionStatsFn) {
    setInterval(() => {
        const activeCount = getConnectionsFn ? getConnectionsFn() : 0;
        const stats = getConnectionStatsFn ? getConnectionStatsFn() : null;

        if (stats) {
            // 平均连接时长异常（超过 1 小时）
            if (stats.avgDurationMs > 3600000 && stats.completedConnections > 10) {
                logger.debug(`Connection avg duration: ${Math.round(stats.avgDurationMs / 1000)}s (long-lived connections)`);
            }

            // 最大连接时长记录
            if (stats.maxDurationMs > 7200000) {
                logger.debug(`Max connection duration: ${Math.round(stats.maxDurationMs / 1000 / 60)}min`);
            }
        }

        // 连接数接近上限警告
        if (activeCount > CONFIG.MAX_CONNECTIONS * 0.8) {
            logger.warn(`Connection count high: ${activeCount}/${CONFIG.MAX_CONNECTIONS} (${Math.round(activeCount / CONFIG.MAX_CONNECTIONS * 100)}%)`);
        }
    }, 60000); // 每分钟巡检一次

    logger.info('Connection health check: started (interval: 60s)');
}

// ---- HTTP 服务器超时配置 ----
function configureHttpServerTimeouts(server) {
    // 请求超时：默认 2 分钟（防止慢请求占用连接）
    server.timeout = 120000;

    // Keep-Alive 超时：默认 65 秒（略大于常见负载均衡器的 60 秒）
    server.keepAliveTimeout = 65000;

    // 请求头超时：默认 60 秒
    server.headersTimeout = 60000;

    // 最大请求头数
    server.maxHeadersCount = 100;

    logger.info('HTTP server timeouts: configured (request=120s, keepAlive=65s, headers=60s)');
}

// ---- 获取稳定性统计信息（用于 /metrics 等端点）----
function getResilienceStats() {
    const mem = process.memoryUsage();
    return {
        errors: {
            uncaughtExceptions: errorStats.uncaughtExceptions,
            unhandledRejections: errorStats.unhandledRejections,
            consecutiveErrors: errorStats.consecutiveErrors
        },
        memory: {
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024),
            externalMB: Math.round(mem.external / 1024 / 1024),
            limitMB: CONFIG.MEMORY_LIMIT_MB,
            usagePercent: Math.round(mem.heapUsed / 1024 / 1024 / CONFIG.MEMORY_LIMIT_MB * 100)
        },
        eventLoop: {
            delayMs: eventLoopDelay,
            status: eventLoopDelay > 1000 ? 'degraded' : 'healthy'
        },
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime())
    };
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

module.exports = {
    setupProcessErrorHandlers,
    setupMemoryMonitor,
    setupEventLoopMonitor,
    setupConnectionHealthCheck,
    configureHttpServerTimeouts,
    getResilienceStats
};
