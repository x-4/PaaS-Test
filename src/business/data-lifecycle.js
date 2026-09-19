/**
 * 业务数据生命周期引擎
 * 模拟企业库存系统的真实运转：库存波动、任务流转、仓库负载变化
 * 所有数据变更均触发业务事件，与 event-stream 联动
 */

const logger = require('../logger');
const { eventBus } = require('../event-bus');

// 历史记录（内存存储，不持久化）
const inventoryHistory = [];
const taskHistory = [];
const MAX_INVENTORY_HISTORY = 100;
const MAX_TASK_HISTORY = 50;

// 仓库负载指标（运行时计算）
const warehouseMetrics = {};

let started = false;
let inventoryTimer = null;
let taskTimer = null;
let metricsTimer = null;

/**
 * 初始化仓库负载指标
 */
function initWarehouseMetrics(warehouses) {
    warehouses.forEach(w => {
        if (!warehouseMetrics[w.id]) {
            warehouseMetrics[w.id] = {
                throughput: Math.floor(Math.random() * 500) + 100,
                utilization: Math.floor(Math.random() * 40) + 30,
                pendingTasks: Math.floor(Math.random() * 10),
                completedToday: Math.floor(Math.random() * 200) + 50,
                failedToday: Math.floor(Math.random() * 10)
            };
        }
    });
}

/**
 * 模拟库存波动（出入库）
 */
function simulateInventoryMovement(inventory) {
    if (!inventory || inventory.length === 0) return;

    // 随机选择 5-15 个 SKU 进行波动
    const count = Math.floor(Math.random() * 11) + 5;
    const selected = [];
    const usedIndices = new Set();

    for (let i = 0; i < Math.min(count, inventory.length); i++) {
        let idx;
        do {
            idx = Math.floor(Math.random() * inventory.length);
        } while (usedIndices.has(idx));
        usedIndices.add(idx);
        selected.push(inventory[idx]);
    }

    selected.forEach(item => {
        const oldQuantity = item.quantity;
        // 波动幅度 ±5-20%
        const changePercent = (Math.random() * 0.4 - 0.2);
        const change = Math.floor(oldQuantity * changePercent);
        const newQuantity = Math.max(0, oldQuantity + change);

        item.quantity = newQuantity;
        item.lastUpdated = new Date().toISOString();
        item.lastMovement = change >= 0 ? 'inbound' : 'outbound';

        // 记录历史
        inventoryHistory.unshift({
            sku: item.sku,
            name: item.name,
            oldQuantity,
            newQuantity,
            change,
            type: change >= 0 ? 'inbound' : 'outbound',
            warehouseId: item.warehouseId,
            timestamp: new Date().toISOString()
        });

        // 触发业务事件
        eventBus.emit('inventory.updated', {
            sku: item.sku,
            name: item.name,
            oldQuantity,
            newQuantity,
            change,
            warehouseId: item.warehouseId,
            timestamp: new Date().toISOString()
        });
    });

    // 限制历史记录长度
    while (inventoryHistory.length > MAX_INVENTORY_HISTORY) {
        inventoryHistory.pop();
    }

    logger.debug(`Inventory movement: ${selected.length} items updated`);
}

/**
 * 模拟同步任务状态流转
 */
function simulateTaskProgress(syncJobs) {
    if (!syncJobs || syncJobs.length === 0) return;

    // 找到 pending 状态的任务，转为 in_progress
    const pendingJobs = syncJobs.filter(j => j.status === 'pending');
    if (pendingJobs.length > 0 && Math.random() > 0.3) {
        const job = pendingJobs[Math.floor(Math.random() * pendingJobs.length)];
        job.status = 'in_progress';
        job.startedAt = new Date().toISOString();
        job.progress = Math.floor(Math.random() * 30) + 10;

        eventBus.emit('sync.started', {
            jobId: job.jobId,
            type: job.type,
            sourceWarehouse: job.sourceWarehouse,
            targetWarehouse: job.targetWarehouse,
            timestamp: new Date().toISOString()
        });

        logger.debug(`Sync job started: ${job.jobId}`);
    }

    // 找到 in_progress 状态的任务，转为 completed 或 failed
    const runningJobs = syncJobs.filter(j => j.status === 'in_progress');
    runningJobs.forEach(job => {
        // 增加进度
        job.progress = Math.min(100, job.progress + Math.floor(Math.random() * 40) + 20);

        if (job.progress >= 100) {
            // 8-15% 概率失败
            const failed = Math.random() < 0.12;
            if (failed) {
                job.status = 'failed';
                job.errorCode = ['SYNC_TIMEOUT', 'CONNECTION_LOST', 'DATA_MISMATCH', 'PERMISSION_DENIED'][Math.floor(Math.random() * 4)];
                job.errorMessage = 'Sync operation failed due to ' + job.errorCode.toLowerCase().replace(/_/g, ' ');
                job.completedAt = new Date().toISOString();

                eventBus.emit('sync.failed', {
                    jobId: job.jobId,
                    errorCode: job.errorCode,
                    errorMessage: job.errorMessage,
                    timestamp: new Date().toISOString()
                });
            } else {
                job.status = 'completed';
                job.progress = 100;
                job.completedAt = new Date().toISOString();
                job.itemsProcessed = Math.floor(Math.random() * 500) + 50;

                eventBus.emit('sync.completed', {
                    jobId: job.jobId,
                    type: job.type,
                    itemsProcessed: job.itemsProcessed,
                    durationMs: Math.floor(Math.random() * 30000) + 5000,
                    timestamp: new Date().toISOString()
                });
            }

            // 记录历史
            taskHistory.unshift({
                jobId: job.jobId,
                type: job.type,
                status: job.status,
                sourceWarehouse: job.sourceWarehouse,
                targetWarehouse: job.targetWarehouse,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                errorCode: job.errorCode || null,
                timestamp: new Date().toISOString()
            });

            while (taskHistory.length > MAX_TASK_HISTORY) {
                taskHistory.pop();
            }

            logger.debug(`Sync job ${job.status}: ${job.jobId}`);
        }
    });

    // 自动创建新任务（模拟系统自动调度）
    if (syncJobs.length < 30 && Math.random() > 0.7) {
        const newJob = {
            jobId: 'JOB-' + String(Date.now()).slice(-6),
            type: ['full_inventory', 'delta_update', 'price_sync', 'stock_reconciliation'][Math.floor(Math.random() * 4)],
            sourceWarehouse: 'WH-' + ['US', 'EU', 'AP'][Math.floor(Math.random() * 3)] + '-00' + (Math.floor(Math.random() * 3) + 1),
            targetWarehouse: 'WH-' + ['US', 'EU', 'AP'][Math.floor(Math.random() * 3)] + '-00' + (Math.floor(Math.random() * 3) + 1),
            priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
            status: 'pending',
            progress: 0,
            itemsCount: Math.floor(Math.random() * 200) + 10,
            createdAt: new Date().toISOString()
        };
        syncJobs.push(newJob);
        logger.debug(`Auto-created sync job: ${newJob.jobId}`);
    }
}

/**
 * 模拟仓库负载变化
 */
function simulateWarehouseLoad(warehouses) {
    initWarehouseMetrics(warehouses);

    warehouses.forEach(w => {
        const metrics = warehouseMetrics[w.id];
        if (!metrics) return;

        // 吞吐率波动 ±10%
        metrics.throughput = Math.max(50, Math.floor(metrics.throughput * (0.9 + Math.random() * 0.2)));
        // 利用率波动 ±5%
        metrics.utilization = Math.min(100, Math.max(10, Math.floor(metrics.utilization * (0.95 + Math.random() * 0.1))));
        // 待处理任务数波动
        const runningCount = Object.keys(warehouseMetrics).length;
        metrics.pendingTasks = Math.max(0, Math.floor(Math.random() * 15));

        // 更新仓库对象上的指标
        w.throughput = metrics.throughput;
        w.utilization = metrics.utilization;
        w.pendingTasks = metrics.pendingTasks;
        w.lastUpdated = new Date().toISOString();
    });
}

/**
 * 启动数据生命周期引擎
 */
function start(inventory, syncJobs, warehouses) {
    if (started) {
        logger.warn('Data lifecycle engine already started');
        return;
    }

    started = true;
    initWarehouseMetrics(warehouses);

    // 库存波动：每 30-90 秒一次
    const runInventory = () => {
        if (!started) return;
        try {
            simulateInventoryMovement(inventory);
        } catch (e) {
            logger.error('Inventory movement simulation failed', e.message);
        }
        inventoryTimer = setTimeout(runInventory, 30000 + Math.random() * 60000); inventoryTimer.unref();
    };
    inventoryTimer = setTimeout(runInventory, 15000); inventoryTimer.unref();

    // 任务流转：每 10-30 秒一次
    const runTasks = () => {
        if (!started) return;
        try {
            simulateTaskProgress(syncJobs);
        } catch (e) {
            logger.error('Task progress simulation failed', e.message);
        }
        taskTimer = setTimeout(runTasks, 10000 + Math.random() * 20000); taskTimer.unref();
    };
    taskTimer = setTimeout(runTasks, 8000); taskTimer.unref();

    // 仓库负载：每 20-40 秒一次
    const runMetrics = () => {
        if (!started) return;
        try {
            simulateWarehouseLoad(warehouses);
        } catch (e) {
            logger.error('Warehouse load simulation failed', e.message);
        }
        metricsTimer = setTimeout(runMetrics, 20000 + Math.random() * 20000); metricsTimer.unref();
    };
    metricsTimer = setTimeout(runMetrics, 12000); metricsTimer.unref();

    logger.info('Data lifecycle engine started (inventory movement, task progress, warehouse load)');
}

/**
 * 停止数据生命周期引擎
 */
function stop() {
    if (!started) return;
    started = false;

    if (inventoryTimer) clearTimeout(inventoryTimer);
    if (taskTimer) clearTimeout(taskTimer);
    if (metricsTimer) clearTimeout(metricsTimer);

    inventoryTimer = null;
    taskTimer = null;
    metricsTimer = null;

    logger.info('Data lifecycle engine stopped');
}

/**
 * 获取库存变动历史
 */
function getInventoryHistory(limit = 20) {
    return inventoryHistory.slice(0, limit);
}

/**
 * 获取任务执行历史
 */
function getTaskHistory(limit = 20) {
    return taskHistory.slice(0, limit);
}

/**
 * 获取仓库负载指标
 */
function getWarehouseMetrics(warehouseId) {
    if (warehouseId) {
        return warehouseMetrics[warehouseId] || null;
    }
    return { ...warehouseMetrics };
}

/**
 * 获取统计摘要
 */
function getStats() {
    return {
        inventoryMovementsTotal: inventoryHistory.length,
        taskExecutionsTotal: taskHistory.length,
        activeWarehouses: Object.keys(warehouseMetrics).length,
        engineRunning: started,
        uptime: started ? process.uptime() : 0
    };
}

module.exports = {
    start,
    stop,
    getInventoryHistory,
    getTaskHistory,
    getWarehouseMetrics,
    getStats,
    simulateInventoryMovement,
    simulateTaskProgress,
    simulateWarehouseLoad
};
