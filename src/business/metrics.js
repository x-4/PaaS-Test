// ====================================================================
// 业务指标计算
// SyncFlow 企业库存同步平台 - 核心业务指标计算
//
// 本文件计算库存周转率、同步成功率、订单满足率、仓库利用率等业务指标
// ====================================================================

const {
    InventoryTurnoverCalculator,
    SyncLatencyAnalyzer,
    ABCClassifier
} = require('./algorithms');

/**
 * 业务指标收集器
 * 收集和计算所有业务相关的指标
 */
class BusinessMetricsCollector {
    constructor() {
        this.turnoverCalculator = new InventoryTurnoverCalculator();
        this.latencyAnalyzer = new SyncLatencyAnalyzer();
        this.abcClassifier = new ABCClassifier();

        // 业务指标统计
        this.metrics = {
            totalOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            totalSyncJobs: 0,
            successfulSyncJobs: 0,
            failedSyncJobs: 0,
            totalInventoryUpdates: 0,
            totalItemsSynced: 0,
            totalBytesSynced: 0,
            activeWarehouses: 0,
            totalWarehouses: 0,
            lowStockItems: 0,
            outOfStockItems: 0,
            alertsGenerated: 0
        };

        // 时间序列数据（最近 24 小时，每小时一个点）
        this.timeSeries = {
            ordersPerHour: new Array(24).fill(0),
            syncJobsPerHour: new Array(24).fill(0),
            inventoryUpdatesPerHour: new Array(24).fill(0),
            bytesSyncedPerHour: new Array(24).fill(0)
        };

        this.startTime = Date.now();
    }

    /**
     * 记录订单
     */
    recordOrder(status = 'completed') {
        this.metrics.totalOrders++;
        if (status === 'completed') this.metrics.completedOrders++;
        if (status === 'cancelled') this.metrics.cancelledOrders++;
        this._recordTimeSeries('ordersPerHour');
    }

    /**
     * 记录同步任务
     */
    recordSyncJob(success, itemsCount = 0, bytes = 0, durationMs = 0) {
        this.metrics.totalSyncJobs++;
        if (success) this.metrics.successfulSyncJobs++;
        else this.metrics.failedSyncJobs++;
        this.metrics.totalItemsSynced += itemsCount;
        this.metrics.totalBytesSynced += bytes;
        this._recordTimeSeries('syncJobsPerHour');
        this._recordTimeSeries('bytesSyncedPerHour', bytes);
    }

    /**
     * 记录库存更新
     */
    recordInventoryUpdate(quantity = 0) {
        this.metrics.totalInventoryUpdates++;
        this._recordTimeSeries('inventoryUpdatesPerHour');
    }

    /**
     * 更新仓库统计
     */
    updateWarehouseStats(active, total) {
        this.metrics.activeWarehouses = active;
        this.metrics.totalWarehouses = total;
    }

    /**
     * 更新库存预警统计
     */
    updateAlertStats(lowStock, outOfStock) {
        this.metrics.lowStockItems = lowStock;
        this.metrics.outOfStockItems = outOfStock;
    }

    /**
     * 记录时间序列数据
     */
    _recordTimeSeries(metric, value = 1) {
        const hour = new Date().getHours();
        this.timeSeries[metric][hour] += value;
    }

    /**
     * 计算订单满足率
     */
    get orderFulfillmentRate() {
        if (this.metrics.totalOrders === 0) return 100;
        return Math.round((this.metrics.completedOrders / this.metrics.totalOrders) * 100);
    }

    /**
     * 计算同步成功率
     */
    get syncSuccessRate() {
        if (this.metrics.totalSyncJobs === 0) return 100;
        return Math.round((this.metrics.successfulSyncJobs / this.metrics.totalSyncJobs) * 100);
    }

    /**
     * 计算仓库可用率
     */
    get warehouseAvailability() {
        if (this.metrics.totalWarehouses === 0) return 100;
        return Math.round((this.metrics.activeWarehouses / this.metrics.totalWarehouses) * 100);
    }

    /**
     * 计算平均同步吞吐量（items/sec）
     */
    get avgSyncThroughput() {
        const uptimeSec = (Date.now() - this.startTime) / 1000;
        return uptimeSec > 0 ? Math.round(this.metrics.totalItemsSynced / uptimeSec) : 0;
    }

    /**
     * 获取完整业务指标报告
     */
    getReport() {
        return {
            timestamp: new Date().toISOString(),
            uptimeMs: Date.now() - this.startTime,
            orders: {
                total: this.metrics.totalOrders,
                completed: this.metrics.completedOrders,
                cancelled: this.metrics.cancelledOrders,
                fulfillmentRate: this.orderFulfillmentRate
            },
            sync: {
                totalJobs: this.metrics.totalSyncJobs,
                successful: this.metrics.successfulSyncJobs,
                failed: this.metrics.failedSyncJobs,
                successRate: this.syncSuccessRate,
                totalItems: this.metrics.totalItemsSynced,
                totalBytes: this.metrics.totalBytesSynced,
                avgThroughput: this.avgSyncThroughput
            },
            inventory: {
                totalUpdates: this.metrics.totalInventoryUpdates,
                lowStockItems: this.metrics.lowStockItems,
                outOfStockItems: this.metrics.outOfStockItems
            },
            warehouses: {
                total: this.metrics.totalWarehouses,
                active: this.metrics.activeWarehouses,
                availability: this.warehouseAvailability
            },
            timeSeries: {
                ordersPerHour: this.timeSeries.ordersPerHour,
                syncJobsPerHour: this.timeSeries.syncJobsPerHour,
                inventoryUpdatesPerHour: this.timeSeries.inventoryUpdatesPerHour,
                bytesSyncedPerHour: this.timeSeries.bytesSyncedPerHour
            }
        };
    }

    /**
     * 获取 Prometheus 格式指标
     */
    getPrometheusMetrics() {
        const m = this.metrics;
        return `# HELP syncflow_orders_total Total orders processed
# TYPE syncflow_orders_total counter
syncflow_orders_total ${m.totalOrders}

# HELP syncflow_sync_jobs_total Total sync jobs
# TYPE syncflow_sync_jobs_total counter
syncflow_sync_jobs_total ${m.totalSyncJobs}

# HELP syncflow_sync_success_rate Sync job success rate
# TYPE syncflow_sync_success_rate gauge
syncflow_sync_success_rate ${this.syncSuccessRate}

# HELP syncflow_active_warehouses Number of active warehouses
# TYPE syncflow_active_warehouses gauge
syncflow_active_warehouses ${m.activeWarehouses}

# HELP syncflow_low_stock_items Number of low stock items
# TYPE syncflow_low_stock_items gauge
syncflow_low_stock_items ${m.lowStockItems}

# HELP syncflow_out_of_stock_items Number of out of stock items
# TYPE syncflow_out_of_stock_items gauge
syncflow_out_of_stock_items ${m.outOfStockItems}

# HELP syncflow_items_synced_total Total items synced
# TYPE syncflow_items_synced_total counter
syncflow_items_synced_total ${m.totalItemsSynced}

# HELP syncflow_bytes_synced_total Total bytes synced
# TYPE syncflow_bytes_synced_total counter
syncflow_bytes_synced_total ${m.totalBytesSynced}
`;
    }
}

// 全局单例
const businessMetrics = new BusinessMetricsCollector();

module.exports = {
    BusinessMetricsCollector,
    businessMetrics
};
