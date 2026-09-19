/**
 * 环境指纹模拟器（Environment Fingerprint Simulator）
 * 模拟真实企业级Node.js应用的运行时环境特征
 * 包括：进程树、内存模式、CPU模式、文件描述符、网络连接、环境变量
 * 所有特征基于真实企业应用的运行规律，用于增强进程级环境适配
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const net = require('net');
const logger = require('../logger');
const temporalEngine = require('../business/temporal-engine');

// 模拟的子进程信息（不创建真实子进程，只在日志和指标中模拟）
const SIMULATED_PROCESSES = [
    { name: 'db-connection-pool', description: '数据库连接池管理器', port: 5432 },
    { name: 'cache-warmup', description: '缓存预热服务', port: 6379 },
    { name: 'log-archiver', description: '日志归档服务', port: null },
    { name: 'metrics-collector', description: '指标采集服务', port: 9090 },
    { name: 'sync-worker', description: '同步任务工作进程', port: null },
];

// 环境指纹状态
const state = {
    started: false,
    timers: [],
    allocatedBuffers: [],
    openFiles: [],
    openSockets: [],
    processMetrics: {},
    gcSimulations: 0,
    batchProcessing: false,
};

// 初始化模拟的环境变量（看起来像真实企业应用）
function initEnvironmentVariables() {
    const envVars = {
        DB_HOST: process.env.DB_HOST || 'db.internal.syncflow.local',
        DB_PORT: process.env.DB_PORT || '5432',
        DB_NAME: process.env.DB_NAME || 'syncflow_production',
        DB_POOL_MIN: process.env.DB_POOL_MIN || '5',
        DB_POOL_MAX: process.env.DB_POOL_MAX || '20',
        REDIS_URL: process.env.REDIS_URL || 'redis://cache.internal.syncflow.local:6379/0',
        MQ_URL: process.env.MQ_URL || 'amqp://mq.internal.syncflow.local:5672',
        MQ_QUEUE: process.env.MQ_QUEUE || 'syncflow.events',
        AWS_REGION: process.env.AWS_REGION || 'us-east-1',
        AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'syncflow-backups',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        NODE_ENV: process.env.NODE_ENV || 'production',
        SERVICE_NAME: process.env.SERVICE_NAME || 'inventory-sync-service',
    };

    // 不修改process.env（避免影响真实功能），只记录用于指标和日志
    state.environmentVars = envVars;
    return envVars;
}

// 模拟子进程启动日志
function simulateProcessStartup() {
    logger.info('[process-manager] Starting child processes...');
    for (const proc of SIMULATED_PROCESSES) {
        setTimeout(() => {
            logger.info(`[process-manager] Child process '${proc.name}' started (pid=${Math.floor(Math.random() * 30000) + 1000})`);
        }, 100 + Math.random() * 200);
    }
    setTimeout(() => {
        logger.info(`[process-manager] All ${SIMULATED_PROCESSES.length} child processes ready`);
    }, 500);
}

// 模拟内存使用模式（启动时增长、运行时波动、GC尖峰）
function simulateMemoryPattern() {
    // 启动时分配一些内存（模拟缓存预热）
    const warmupSize = 5 * 1024 * 1024; // 5MB
    const warmupBuffer = Buffer.alloc(warmupSize);
    for (let i = 0; i < warmupSize; i += 4096) {
        warmupBuffer[i] = Math.floor(Math.random() * 256);
    }
    state.allocatedBuffers.push(warmupBuffer);

    // 定期模拟内存波动（模拟业务数据增减）
    const memoryTimer = setInterval(() => {
        const activity = temporalEngine.getBusinessActivity();

        // 根据活跃度调整内存分配
        if (activity.value > 0.5 && state.allocatedBuffers.length < 10) {
            // 高活跃度时分配更多内存
            const size = Math.floor(Math.random() * 2 * 1024 * 1024); // 0-2MB
            const buf = Buffer.alloc(size);
            state.allocatedBuffers.push(buf);
        } else if (activity.value < 0.2 && state.allocatedBuffers.length > 3) {
            // 低活跃度时释放一些内存
            const buf = state.allocatedBuffers.pop();
            if (buf) buf.fill(0);
        }

        // 模拟GC尖峰（每5-10分钟一次）
        if (Math.random() < 0.02) {
            state.gcSimulations++;
            // 释放一些旧的buffer模拟GC
            const gcCount = Math.min(2, state.allocatedBuffers.length - 2);
            for (let i = 0; i < gcCount; i++) {
                const buf = state.allocatedBuffers.shift();
                if (buf) buf.fill(0);
            }
        }
    }, 30000);
    if (memoryTimer.unref) memoryTimer.unref();
    state.timers.push(memoryTimer);
}

// 模拟CPU使用模式（周期性波动、批处理尖峰）
function simulateCpuPattern() {
    const cpuTimer = setInterval(() => {
        const activity = temporalEngine.getBusinessActivity();

        // 根据活跃度做一些轻量级计算（模拟业务处理）
        if (activity.value > 0.3) {
            const iterations = Math.floor(activity.value * 10000);
            let sum = 0;
            for (let i = 0; i < iterations; i++) {
                sum += Math.sqrt(i) * Math.sin(i);
            }
            state.lastCpuWork = sum;
        }

        // 模拟批处理尖峰（每小时一次，异步分片避免阻塞事件循环）
        const now = new Date();
        if (now.getMinutes() === 0 && now.getSeconds() < 10 && !state.batchProcessing) {
            state.batchProcessing = true;
            logger.debug('[batch-processor] Starting hourly metrics aggregation');
            const batchStart = Date.now();
            // 异步分片计算：每片5000次，用setImmediate让出事件循环
            let batchSum = 0;
            let batchOffset = 0;
            const BATCH_CHUNK = 5000;
            const BATCH_TOTAL = 50000;
            function processChunk() {
                const end = Math.min(batchOffset + BATCH_CHUNK, BATCH_TOTAL);
                for (let i = batchOffset; i < end; i++) {
                    batchSum += Math.sqrt(i) * Math.cos(i);
                }
                batchOffset = end;
                if (batchOffset < BATCH_TOTAL) {
                    setImmediate(processChunk);
                } else {
                    const batchDuration = Date.now() - batchStart;
                    logger.debug(`[batch-processor] Metrics aggregation completed (${batchDuration}ms, sum=${batchSum.toFixed(2)})`);
                    setTimeout(() => { state.batchProcessing = false; }, 10000);
                }
            }
            setImmediate(processChunk);
        }
    }, 5000);
    if (cpuTimer.unref) cpuTimer.unref();
    state.timers.push(cpuTimer);
}

// 模拟文件描述符模式（打开配置文件、日志文件、临时文件）- 使用异步API避免阻塞
function simulateFileDescriptorPattern() {
    const fsPromises = fs.promises;
    const tmpDir = os.tmpdir();

    // 异步打开临时文件
    (async () => {
        for (let i = 0; i < 3; i++) {
            try {
                const tmpFile = path.join(tmpDir, `syncflow-tmp-${Date.now()}-${i}.tmp`);
                const fd = await fsPromises.open(tmpFile, 'w');
                await fd.writeFile(JSON.stringify({ timestamp: Date.now(), process: 'temp' }));
                state.openFiles.push({ fd, path: tmpFile });
            } catch (e) {
                // 忽略错误
            }
        }
    })();

    // 定期轮换临时文件（模拟业务文件处理）- 异步
    const fdTimer = setInterval(async () => {
        // 关闭旧文件
        while (state.openFiles.length > 2) {
            const file = state.openFiles.shift();
            try {
                await file.fd.close();
                await fsPromises.unlink(file.path);
            } catch (e) {
                // 忽略错误
            }
        }

        // 打开新文件
        try {
            const tmpFile = path.join(os.tmpdir(), `syncflow-tmp-${Date.now()}.tmp`);
            const fd = await fsPromises.open(tmpFile, 'w');
            await fd.writeFile(JSON.stringify({ timestamp: Date.now(), activity: temporalEngine.getBusinessActivity().value }));
            state.openFiles.push({ fd, path: tmpFile });
        } catch (e) {
            // 忽略错误
        }
    }, 60000);
    if (fdTimer.unref) fdTimer.unref();
    state.timers.push(fdTimer);
}

// 模拟网络连接模式（假的数据库连接、缓存连接）
function simulateNetworkConnectionPattern() {
    // 创建一些到本地的TCP连接（模拟数据库/缓存连接）
    const createSimulatedConnection = (port, name) => {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(2000);
            socket.on('connect', () => {
                state.openSockets.push({ socket, name, port });
                resolve(true);
            });
            socket.on('error', () => resolve(false));
            socket.on('timeout', () => { socket.destroy(); resolve(false); });
            socket.connect(port, require('../config').CONFIG.SIMULATOR_HOST || 'localhost');
        });
    };

    // 尝试连接一些常见端口（即使失败也模拟了连接行为）
    (async () => {
        await createSimulatedConnection(5432, 'postgres');
        await createSimulatedConnection(6379, 'redis');
        await createSimulatedConnection(3306, 'mysql');
    })();

    // 定期检查和重连（模拟连接池维护）
    const connTimer = setInterval(() => {
        // 清理已断开的连接
        state.openSockets = state.openSockets.filter(s => !s.socket.destroyed);

        // 如果连接太少，尝试重连
        if (state.openSockets.length < 2) {
            (async () => {
                await createSimulatedConnection(5432, 'postgres');
                await createSimulatedConnection(6379, 'redis');
            })();
        }
    }, 30000);
    if (connTimer.unref) connTimer.unref();
    state.timers.push(connTimer);
}

// 启动环境指纹模拟器
function start() {
    if (state.started) return;
    state.started = true;

    initEnvironmentVariables();
    simulateProcessStartup();
    simulateMemoryPattern();
    simulateCpuPattern();
    simulateFileDescriptorPattern();
    simulateNetworkConnectionPattern();

    logger.info('Environment fingerprint simulator started (process tree, memory, CPU, FD, network)');
}

// 停止环境指纹模拟器
function stop() {
    if (!state.started) return;
    state.started = false;

    // 清理定时器
    state.timers.forEach(t => clearInterval(t));
    state.timers = [];

    // 释放内存
    state.allocatedBuffers.forEach(buf => buf.fill(0));
    state.allocatedBuffers = [];

    // 关闭文件（异步FileHandle）
    (async () => {
        for (const file of state.openFiles) {
            try {
                await file.fd.close();
                await fs.promises.unlink(file.path);
            } catch (e) {
                // 忽略错误
            }
        }
        state.openFiles = [];
    })();

    // 关闭连接
    state.openSockets.forEach(s => {
        try { s.socket.destroy(); } catch (e) { /* 忽略 */ }
    });
    state.openSockets = [];

    logger.info('Environment fingerprint simulator stopped');
}

// 获取环境指纹指标（用于Prometheus）
function getMetrics() {
    const memUsage = process.memoryUsage();
    return {
        // 子进程
        process_child_processes_total: SIMULATED_PROCESSES.length,
        process_child_processes_running: SIMULATED_PROCESSES.length,

        // 内存模式
        process_buffer_allocations_total: state.allocatedBuffers.length,
        process_buffer_bytes_total: state.allocatedBuffers.reduce((sum, buf) => sum + buf.length, 0),

        // CPU模式
        batch_processing_active: state.batchProcessing ? 1 : 0,

        // 文件描述符模式
        process_open_files_total: state.openFiles.length,

        // 网络连接模式
        process_open_connections_total: state.openSockets.length,

        // 真实指标（用于对比）
        process_heap_used: Math.floor(memUsage.heapUsed / 1024 / 1024),
        process_heap_total: Math.floor(memUsage.heapTotal / 1024 / 1024),
        process_rss: Math.floor(memUsage.rss / 1024 / 1024),
        process_uptime_seconds: Math.floor(process.uptime()),

        // 系统信息
        os_hostname: os.hostname(),
        os_platform: os.platform(),
        os_cpus: os.cpus().length,
        os_total_memory_mb: Math.floor(os.totalmem() / 1024 / 1024),
        os_free_memory_mb: Math.floor(os.freemem() / 1024 / 1024),
    };
}

// 获取模拟的子进程信息
function getSimulatedProcesses() {
    return SIMULATED_PROCESSES.map(p => ({
        name: p.name,
        description: p.description,
        status: 'running',
        pid: Math.floor(Math.random() * 30000) + 1000,
        port: p.port,
        cpuPercent: (Math.random() * 5).toFixed(1),
        memoryMb: Math.floor(Math.random() * 50) + 10,
    }));
}

module.exports = {
    start,
    stop,
    getMetrics,
    getSimulatedProcesses,
};
