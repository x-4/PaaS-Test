// ====================================================================
// 业务规则引擎
// SyncFlow 企业库存同步平台 - 核心业务规则与算法
//
// 本文件实现库存分配、同步优先级、仓库路由、库存预警等业务规则
// ====================================================================

const {
    WarehouseStatus,
    SyncPriority,
    AlertLevel,
    SyncStatus
} = require('./constants');

/**
 * 库存分配策略
 * 根据订单需求和各仓库库存，智能分配发货仓库
 */
class InventoryAllocator {
    constructor() {
        this.warehouses = new Map(); // warehouseId -> Warehouse
        this.inventory = new Map();  // `${warehouseId}:${sku}` -> InventoryItem
    }

    /**
     * 注册仓库
     */
    registerWarehouse(warehouse) {
        this.warehouses.set(warehouse.id, warehouse);
    }

    /**
     * 注册库存项
     */
    registerInventory(item) {
        const key = `${item.warehouseId}:${item.sku}`;
        this.inventory.set(key, item);
    }

    /**
     * 分配库存（贪心算法：优先从库存充足的仓库分配）
     * @param {string} sku - 商品 SKU
     * @param {number} quantity - 需求数量
     * @param {string[]} preferredWarehouses - 优先仓库列表（可选）
     * @returns {Array} 分配结果 [{warehouseId, quantity}]
     */
    allocate(sku, quantity, preferredWarehouses = []) {
        const allocations = [];
        let remaining = quantity;

        // 获取所有有库存的仓库
        const candidates = [];
        for (const [key, item] of this.inventory.entries()) {
            if (item.sku !== sku) continue;
            const warehouse = this.warehouses.get(item.warehouseId);
            if (!warehouse || !warehouse.isAvailable) continue;
            if (item.availableQuantity <= 0) continue;

            candidates.push({
                warehouseId: item.warehouseId,
                available: item.availableQuantity,
                isPreferred: preferredWarehouses.includes(item.warehouseId),
                utilization: warehouse.utilizationPercent
            });
        }

        // 排序：优先仓库 > 库存充足 > 使用率低
        candidates.sort((a, b) => {
            if (a.isPreferred !== b.isPreferred) return b.isPreferred - a.isPreferred;
            if (b.available !== a.available) return b.available - a.available;
            return a.utilization - b.utilization;
        });

        // 贪心分配
        for (const candidate of candidates) {
            if (remaining <= 0) break;
            const allocateQty = Math.min(remaining, candidate.available);
            allocations.push({
                warehouseId: candidate.warehouseId,
                quantity: allocateQty
            });
            remaining -= allocateQty;
        }

        return {
            allocations,
            allocated: quantity - remaining,
            remaining,
            fullyAllocated: remaining === 0
        };
    }

    /**
     * 获取某 SKU 的总可用库存
     */
    getTotalAvailable(sku) {
        let total = 0;
        for (const item of this.inventory.values()) {
            if (item.sku === sku) {
                total += item.availableQuantity;
            }
        }
        return total;
    }
}

/**
 * 同步优先级计算器
 * 根据同步任务类型、数据量、紧急程度计算优先级
 */
class SyncPriorityCalculator {
    /**
     * 计算同步任务优先级
     * @param {object} options - 任务参数
     * @returns {number} 优先级分数（越高越优先）
     */
    calculatePriority(options = {}) {
        let score = 0;

        // 基础分：同步类型
        const typeScores = {
            'full_inventory': 10,
            'delta_update': 20,
            'price_sync': 15,
            'stock_reconciliation': 25,
            'order_sync': 30,
            'product_sync': 12
        };
        score += typeScores[options.type] || 10;

        // 数据量加分：大数据量优先（减少同步次数）
        if (options.itemsCount > 1000) score += 10;
        else if (options.itemsCount > 100) score += 5;

        // 紧急程度加分
        if (options.isUrgent) score += 20;

        // 失败重试加分（失败的任务需要尽快重试）
        if (options.retryCount > 0) score += options.retryCount * 5;

        // 仓库状态加分：维护中的仓库同步优先
        if (options.warehouseStatus === WarehouseStatus.MAINTENANCE) score += 15;

        return Math.min(100, score);
    }

    /**
     * 将分数转换为优先级等级
     */
    scoreToLevel(score) {
        if (score >= 70) return SyncPriority.CRITICAL;
        if (score >= 50) return SyncPriority.HIGH;
        if (score >= 30) return SyncPriority.NORMAL;
        return SyncPriority.LOW;
    }
}

/**
 * 仓库路由选择器
 * 根据目标位置、仓库状态、负载情况选择最优仓库
 */
class WarehouseRouter {
    constructor() {
        this.warehouses = new Map();
    }

    /**
     * 注册仓库
     */
    registerWarehouse(warehouse) {
        this.warehouses.set(warehouse.id, warehouse);
    }

    /**
     * 选择最优仓库
     * @param {object} criteria - 选择标准
     * @returns {Warehouse|null} 选中的仓库
     */
    selectWarehouse(criteria = {}) {
        const candidates = [...this.warehouses.values()].filter(w => {
            // 只选择可用仓库
            if (!w.isAvailable) return false;
            // 区域过滤
            if (criteria.region && w.region !== criteria.region) return false;
            // 容量过滤
            if (criteria.minCapacity && w.capacity < criteria.minCapacity) return false;
            // 使用率过滤（避免选择已满的仓库）
            if (w.utilizationPercent >= 90) return false;
            return true;
        });

        if (candidates.length === 0) return null;

        // 排序：使用率低 > 容量大 > 最近同步
        candidates.sort((a, b) => {
            if (a.utilizationPercent !== b.utilizationPercent) {
                return a.utilizationPercent - b.utilizationPercent;
            }
            if (b.capacity !== a.capacity) {
                return b.capacity - a.capacity;
            }
            return new Date(b.lastSyncAt || 0) - new Date(a.lastSyncAt || 0);
        });

        return candidates[0];
    }

    /**
     * 获取所有可用仓库
     */
    getAvailableWarehouses() {
        return [...this.warehouses.values()].filter(w => w.isAvailable);
    }
}

/**
 * 库存预警引擎
 * 根据库存水平、销售速度、补货周期计算预警
 */
class InventoryAlertEngine {
    constructor() {
        this.alerts = [];
        this.alertHistory = new Map(); // sku -> alert[]
    }

    /**
     * 评估库存项预警级别
     * @param {InventoryItem} item - 库存项
     * @param {object} context - 上下文（销售速度、补货周期等）
     * @returns {object} 预警结果
     */
    evaluate(item, context = {}) {
        const dailySales = context.dailySales || 0;
        const restockDays = context.restockDays || 7;

        // 计算可售天数
        const daysOfSupply = dailySales > 0 ? item.availableQuantity / dailySales : Infinity;

        // 计算建议补货量
        const suggestedReorder = Math.max(0,
            Math.ceil(dailySales * restockDays * 1.5) - item.availableQuantity
        );

        let level = AlertLevel.NORMAL;
        let reason = '';

        if (item.quantity === 0) {
            level = AlertLevel.OUT_OF_STOCK;
            reason = 'Stock is completely exhausted';
        } else if (daysOfSupply <= restockDays) {
            level = AlertLevel.CRITICAL;
            reason = `Stock will run out in ${Math.round(daysOfSupply)} days (restock takes ${restockDays} days)`;
        } else if (item.quantity <= item.reorderPoint) {
            level = AlertLevel.WARNING;
            reason = `Quantity (${item.quantity}) below reorder point (${item.reorderPoint})`;
        }

        const alert = {
            sku: item.sku,
            warehouseId: item.warehouseId,
            level,
            reason,
            quantity: item.quantity,
            availableQuantity: item.availableQuantity,
            reorderPoint: item.reorderPoint,
            safetyStock: item.safetyStock,
            daysOfSupply: daysOfSupply === Infinity ? null : Math.round(daysOfSupply),
            suggestedReorder,
            dailySales,
            createdAt: new Date().toISOString()
        };

        // 记录历史
        if (!this.alertHistory.has(item.sku)) {
            this.alertHistory.set(item.sku, []);
        }
        this.alertHistory.get(item.sku).push(alert);
        if (this.alertHistory.get(item.sku).length > 100) {
            this.alertHistory.get(item.sku).shift();
        }

        // 如果是警告及以上，加入活跃预警
        if (level !== AlertLevel.NORMAL) {
            this.alerts.push(alert);
        }

        return alert;
    }

    /**
     * 获取所有活跃预警
     */
    getActiveAlerts() {
        return this.alerts.filter(a => a.level !== AlertLevel.NORMAL);
    }

    /**
     * 按级别统计预警
     */
    getAlertSummary() {
        const summary = {
            total: this.alerts.length,
            outOfStock: 0,
            critical: 0,
            warning: 0
        };
        for (const alert of this.alerts) {
            if (alert.level === AlertLevel.OUT_OF_STOCK) summary.outOfStock++;
            else if (alert.level === AlertLevel.CRITICAL) summary.critical++;
            else if (alert.level === AlertLevel.WARNING) summary.warning++;
        }
        return summary;
    }
}

/**
 * 同步任务调度器
 * 根据优先级、依赖关系、资源限制调度同步任务
 */
class SyncJobScheduler {
    constructor() {
        this.queue = []; // 待执行队列
        this.running = new Map(); // 执行中的任务 jobId -> SyncJob
        this.completed = []; // 已完成任务（最近 100 个）
        this.maxConcurrent = 3; // 最大并发数
        this.priorityCalculator = new SyncPriorityCalculator();
    }

    /**
     * 添加同步任务到队列
     */
    enqueue(job) {
        const priorityScore = this.priorityCalculator.calculatePriority({
            type: job.type,
            itemsCount: job.itemsCount,
            isUrgent: job.priority === SyncPriority.CRITICAL,
            retryCount: job.retryCount
        });
        job.priorityScore = priorityScore;
        this.queue.push(job);
        this._sortQueue();
        return job;
    }

    /**
     * 按优先级排序队列
     */
    _sortQueue() {
        this.queue.sort((a, b) => {
            if (b.priorityScore !== a.priorityScore) {
                return b.priorityScore - a.priorityScore;
            }
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
    }

    /**
     * 获取下一个可执行的任务
     */
    getNextJob() {
        if (this.running.size >= this.maxConcurrent) return null;
        if (this.queue.length === 0) return null;

        const job = this.queue.shift();
        job.status = SyncStatus.IN_PROGRESS;
        job.startedAt = new Date().toISOString();
        this.running.set(job.id, job);
        return job;
    }

    /**
     * 完成任务
     */
    completeJob(jobId, result = {}) {
        const job = this.running.get(jobId);
        if (!job) return null;

        job.status = result.success ? SyncStatus.COMPLETED : SyncStatus.FAILED;
        job.completedAt = new Date().toISOString();
        if (result.error) job.errorMessage = result.error;
        if (result.itemsProcessed) job.itemsProcessed = result.itemsProcessed;
        if (result.itemsFailed) job.itemsFailed = result.itemsFailed;

        this.running.delete(jobId);
        this.completed.push(job);
        if (this.completed.length > 100) this.completed.shift();

        return job;
    }

    /**
     * 获取队列状态
     */
    getQueueStatus() {
        return {
            queued: this.queue.length,
            running: this.running.size,
            completed: this.completed.length,
            maxConcurrent: this.maxConcurrent,
            nextJob: this.queue[0] ? {
                id: this.queue[0].id,
                type: this.queue[0].type,
                priorityScore: this.queue[0].priorityScore
            } : null
        };
    }
}

// 全局单例
const inventoryAllocator = new InventoryAllocator();
const syncPriorityCalculator = new SyncPriorityCalculator();
const warehouseRouter = new WarehouseRouter();
const inventoryAlertEngine = new InventoryAlertEngine();
const syncJobScheduler = new SyncJobScheduler();

module.exports = {
    InventoryAllocator,
    SyncPriorityCalculator,
    WarehouseRouter,
    InventoryAlertEngine,
    SyncJobScheduler,
    // 全局单例
    inventoryAllocator,
    syncPriorityCalculator,
    warehouseRouter,
    inventoryAlertEngine,
    syncJobScheduler
};
