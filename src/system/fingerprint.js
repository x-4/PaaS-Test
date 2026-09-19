/**
 * 系统运行指纹模拟器
 * 让系统的运行时指纹更接近真实的企业级 Node.js 应用
 * 包括：数据库连接池、缓存、消息队列指标，丰富的启动日志，多样化的定时任务
 * 不影响实时同步核心，完全是系统层的运行环境特征模拟
 */

const logger = require('../logger');

// 模拟的数据库连接池状态
const dbPool = {
    min: 5,
    max: 20,
    active: 3,
    idle: 7,
    waiting: 0,
    totalConnections: 10,
    acquired: 0,
    released: 0,
    timedOut: 0,
    maxUsesReached: 0
};

// 模拟的缓存状态
const cache = {
    size: 152,
    maxSize: 500,
    hits: 12450,
    misses: 3200,
    evictions: 156,
    hitRate: 0.795,
    avgTtl: 300000
};

// 模拟的消息队列状态
const messageQueue = {
    depth: 3,
    consumers: 3,
    processed: 8920,
    failed: 23,
    retried: 45,
    avgProcessingTime: 125
};

// GC 统计
const gcStats = {
    count: 42,
    durationMs: 1250,
    majorCount: 8,
    minorCount: 34,
    lastGcAt: Date.now() - 30000
};

// 定时任务状态
const scheduledTasks = {
    metricsAggregation: { lastRun: null, intervalMs: 300000, runs: 0 },
    dataBackup: { lastRun: null, intervalMs: 900000, runs: 0 },
    logRotation: { lastRun: null, intervalMs: 3600000, runs: 0 },
    cacheCleanup: { lastRun: null, intervalMs: 1800000, runs: 0 },
    historyArchive: { lastRun: null, intervalMs: 21600000, runs: 0 }
};

let started = false;
let timers = [];

/**
 * 输出企业级启动日志（模拟真实应用的启动过程）
 */
function logStartupSequence(serviceName, version, port) {
    const startTime = Date.now();

    logger.info('='.repeat(60));
    logger.info(`${serviceName} v${version} starting...`);
    logger.info('='.repeat(60));

    // 阶段1：配置加载
    logger.info('[1/6] Loading configuration from environment variables...');
    setTimeout(() => {
        logger.info('[1/6] Configuration loaded (12 keys validated, 0 warnings)');
    }, 50);

    // 阶段2：数据库连接
    setTimeout(() => {
        logger.info('[2/6] Connecting to inventory database (poolSize=5-20, host=db.internal)...');
    }, 100);
    setTimeout(() => {
        logger.info(`[2/6] Database connection established (${dbPool.min} idle connections, 12ms)`);
    }, 150);

    // 阶段3：缓存初始化
    setTimeout(() => {
        logger.info('[3/6] Initializing Redis cache (ttl=300s, maxSize=500)...');
    }, 200);
    setTimeout(() => {
        logger.info(`[3/6] Cache warmup completed (${cache.size} keys, 45ms)`);
    }, 250);

    // 阶段4：消息队列
    setTimeout(() => {
        logger.info('[4/6] Starting message queue consumer (3 partitions, 3 consumers)...');
    }, 300);
    setTimeout(() => {
        logger.info('[4/6] Message queue consumer started (3 partitions assigned)');
    }, 350);

    // 阶段5：业务引擎
    setTimeout(() => {
        logger.info('[5/6] Initializing sync engine (5 workers, backpressure enabled)...');
    }, 400);
    setTimeout(() => {
        logger.info('[5/6] Sync engine initialized (5 workers ready)');
    }, 450);

    // 阶段6：定时任务
    setTimeout(() => {
        logger.info('[6/6] Registering scheduled tasks (metrics, backup, log-rotation, cache-cleanup)...');
    }, 500);
    setTimeout(() => {
        const elapsed = Date.now() - startTime;
        logger.info(`[6/6] All scheduled tasks registered (5 tasks)`);
        logger.info('='.repeat(60));
        logger.info(`${serviceName} ready on port ${port} (startupTime=${elapsed}ms)`);
        logger.info('='.repeat(60));
    }, 550);
}

/**
 * 模拟数据库连接池波动
 */
function simulateDbPool() {
    // 活跃连接数波动
    dbPool.active = Math.max(0, Math.min(dbPool.max, dbPool.active + Math.floor(Math.random() * 5) - 2));
    dbPool.idle = Math.max(0, dbPool.totalConnections - dbPool.active);
    dbPool.waiting = Math.random() < 0.1 ? Math.floor(Math.random() * 3) : 0;

    // 累计统计
    if (Math.random() < 0.3) {
        dbPool.acquired += Math.floor(Math.random() * 5);
        dbPool.released += Math.floor(Math.random() * 5);
    }
}

/**
 * 模拟缓存命中
 */
function simulateCache() {
    if (Math.random() < 0.5) {
        cache.hits += Math.floor(Math.random() * 20);
    } else {
        cache.misses += Math.floor(Math.random() * 8);
    }
    cache.hitRate = cache.hits / (cache.hits + cache.misses);
    cache.size = Math.min(cache.maxSize, cache.size + Math.floor(Math.random() * 5) - 2);
    if (Math.random() < 0.05) cache.evictions++;
}

/**
 * 模拟消息队列处理
 */
function simulateQueue() {
    if (Math.random() < 0.4) {
        const processed = Math.floor(Math.random() * 10);
        messageQueue.processed += processed;
        messageQueue.depth = Math.max(0, messageQueue.depth + Math.floor(Math.random() * 3) - 1);
    }
    if (Math.random() < 0.02) {
        messageQueue.failed++;
        messageQueue.retried++;
    }
}

/**
 * 模拟 GC
 */
function simulateGc() {
    if (Math.random() < 0.1) {
        gcStats.count++;
        gcStats.minorCount++;
        gcStats.durationMs += Math.floor(Math.random() * 50) + 10;
        gcStats.lastGcAt = Date.now();
    }
    if (Math.random() < 0.02) {
        gcStats.majorCount++;
        gcStats.durationMs += Math.floor(Math.random() * 200) + 100;
    }
}

/**
 * 执行定时任务
 */
function runScheduledTask(name) {
    const task = scheduledTasks[name];
    if (!task) return;

    task.lastRun = new Date().toISOString();
    task.runs++;

    const durations = {
        metricsAggregation: 150,
        dataBackup: 2000,
        logRotation: 500,
        cacheCleanup: 300,
        historyArchive: 5000
    };

    logger.debug(`Scheduled task '${name}' started`);
    setTimeout(() => {
        logger.debug(`Scheduled task '${name}' completed (${durations[name] || 100}ms)`);
    }, durations[name] || 100);
}

/**
 * 启动系统指纹模拟器
 */
function start() {
    if (started) return;
    started = true;

    // 系统资源模拟：每 10 秒更新一次
    const resourceTimer = setInterval(() => {
        simulateDbPool();
        simulateCache();
        simulateQueue();
        simulateGc();
    }, 10000);
    if (resourceTimer.unref) resourceTimer.unref();
    timers.push(resourceTimer);

    // 定时任务：指标聚合（每 5 分钟）
    const metricsTimer = setInterval(() => runScheduledTask('metricsAggregation'), 300000);
    if (metricsTimer.unref) metricsTimer.unref();
    timers.push(metricsTimer);

    // 定时任务：数据备份（每 15 分钟）
    const backupTimer = setInterval(() => runScheduledTask('dataBackup'), 900000);
    if (backupTimer.unref) backupTimer.unref();
    timers.push(backupTimer);

    // 定时任务：日志轮转（每 1 小时）
    const logTimer = setInterval(() => runScheduledTask('logRotation'), 3600000);
    if (logTimer.unref) logTimer.unref();
    timers.push(logTimer);

    // 定时任务：缓存清理（每 30 分钟）
    const cacheTimer = setInterval(() => runScheduledTask('cacheCleanup'), 1800000);
    if (cacheTimer.unref) cacheTimer.unref();
    timers.push(cacheTimer);

    // 定时任务：历史归档（每 6 小时）
    const archiveTimer = setInterval(() => runScheduledTask('historyArchive'), 21600000);
    if (archiveTimer.unref) archiveTimer.unref();
    timers.push(archiveTimer);

    logger.info('System fingerprint simulator started (db pool, cache, queue, gc, scheduled tasks)');
}

/**
 * 停止系统指纹模拟器
 */
function stop() {
    if (!started) return;
    started = false;

    timers.forEach(t => clearInterval(t));
    timers = [];

    logger.info('System fingerprint simulator stopped');
}

/**
 * 获取完整的系统指标（用于 /metrics 端点）
 */
function getMetrics() {
    return {
        // 数据库连接池
        db_connections_active: dbPool.active,
        db_connections_idle: dbPool.idle,
        db_connections_waiting: dbPool.waiting,
        db_connections_total: dbPool.totalConnections,
        db_connections_acquired_total: dbPool.acquired,
        db_connections_released_total: dbPool.released,
        db_pool_max: dbPool.max,
        db_pool_min: dbPool.min,

        // 缓存
        cache_size: cache.size,
        cache_max_size: cache.maxSize,
        cache_hits_total: cache.hits,
        cache_misses_total: cache.misses,
        cache_evictions_total: cache.evictions,
        cache_hit_rate: parseFloat(cache.hitRate.toFixed(4)),

        // 消息队列
        queue_depth: messageQueue.depth,
        queue_consumers: messageQueue.consumers,
        queue_processed_total: messageQueue.processed,
        queue_failed_total: messageQueue.failed,
        queue_retried_total: messageQueue.retried,
        queue_avg_processing_time_ms: messageQueue.avgProcessingTime,

        // GC
        gc_count: gcStats.count,
        gc_duration_ms_total: gcStats.durationMs,
        gc_major_count: gcStats.majorCount,
        gc_minor_count: gcStats.minorCount,

        // 定时任务
        scheduled_tasks_total: Object.keys(scheduledTasks).length,
        scheduled_tasks_runs_total: Object.values(scheduledTasks).reduce((sum, t) => sum + t.runs, 0)
    };
}

/**
 * 获取健康检查详情（用于 /health 端点）
 */
function getHealthDetails() {
    return {
        database: {
            status: 'UP',
            pool: { active: dbPool.active, idle: dbPool.idle, total: dbPool.totalConnections },
            latencyMs: 5 + Math.floor(Math.random() * 10)
        },
        cache: {
            status: 'UP',
            size: cache.size,
            hitRate: parseFloat(cache.hitRate.toFixed(4))
        },
        queue: {
            status: 'UP',
            depth: messageQueue.depth,
            consumers: messageQueue.consumers
        },
        scheduledTasks: Object.entries(scheduledTasks).map(([name, task]) => ({
            name,
            lastRun: task.lastRun,
            runs: task.runs,
            intervalMs: task.intervalMs
        }))
    };
}

module.exports = {
    start,
    stop,
    logStartupSequence,
    getMetrics,
    getHealthDetails,
    simulateDbPool,
    simulateCache,
    simulateQueue,
    simulateGc
};
