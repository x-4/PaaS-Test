// ====================================================================
// 业务算法库
// SyncFlow 企业库存同步平台 - 核心业务算法实现
//
// 本文件实现库存周转率计算、同步延迟分析、需求预测、ABC分类等算法
// ====================================================================

/**
 * 库存周转率计算器
 * 计算库存周转次数、周转天数、库存持有成本等
 */
class InventoryTurnoverCalculator {
    constructor() {
        this.history = []; // 历史库存记录 [{date, quantity, value}]
        this.salesHistory = []; // 历史销售记录 [{date, sku, quantity, revenue}]
    }

    /**
     * 记录库存快照
     */
    recordInventory(date, quantity, value) {
        this.history.push({ date, quantity, value });
        if (this.history.length > 365) this.history.shift();
    }

    /**
     * 记录销售
     */
    recordSale(date, sku, quantity, revenue) {
        this.salesHistory.push({ date, sku, quantity, revenue });
        if (this.salesHistory.length > 10000) this.salesHistory.shift();
    }

    /**
     * 计算指定时间段的平均库存
     */
    calculateAverageInventory(startDate, endDate) {
        const filtered = this.history.filter(h => {
            const d = new Date(h.date);
            return d >= new Date(startDate) && d <= new Date(endDate);
        });
        if (filtered.length === 0) return 0;
        const totalQty = filtered.reduce((sum, h) => sum + h.quantity, 0);
        const totalValue = filtered.reduce((sum, h) => sum + h.value, 0);
        return {
            averageQuantity: totalQty / filtered.length,
            averageValue: totalValue / filtered.length,
            sampleCount: filtered.length
        };
    }

    /**
     * 计算库存周转率（次/年）
     * 公式：销售成本 / 平均库存价值
     */
    calculateTurnoverRate(startDate, endDate) {
        const sales = this.salesHistory.filter(s => {
            const d = new Date(s.date);
            return d >= new Date(startDate) && d <= new Date(endDate);
        });
        const cogs = sales.reduce((sum, s) => sum + s.revenue * 0.7, 0); // 假设销售成本 = 收入 * 70%
        const avgInventory = this.calculateAverageInventory(startDate, endDate);

        if (avgInventory.averageValue === 0) return 0;

        const days = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
        const annualizedCogs = cogs * (365 / days);

        return {
            turnoverRate: annualizedCogs / avgInventory.averageValue,
            cogs,
            averageInventoryValue: avgInventory.averageValue,
            periodDays: days
        };
    }

    /**
     * 计算库存周转天数
     * 公式：365 / 周转率
     */
    calculateDaysOnHand(startDate, endDate) {
        const { turnoverRate } = this.calculateTurnoverRate(startDate, endDate);
        if (turnoverRate === 0) return Infinity;
        return 365 / turnoverRate;
    }

    /**
     * 计算库存持有成本
     * 公式：平均库存价值 * 持有成本率（通常 20-30%）
     */
    calculateHoldingCost(startDate, endDate, holdingRate = 0.25) {
        const avgInventory = this.calculateAverageInventory(startDate, endDate);
        const days = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
        return avgInventory.averageValue * holdingRate * (days / 365);
    }
}

/**
 * 同步延迟分析器
 * 分析同步任务的延迟分布、瓶颈、趋势
 */
class SyncLatencyAnalyzer {
    constructor() {
        this.latencyRecords = []; // {jobId, type, startTime, endTime, latencyMs, itemsCount, bytes}
    }

    /**
     * 记录同步延迟
     */
    recordLatency(jobId, type, startTime, endTime, itemsCount, bytes) {
        const latencyMs = new Date(endTime).getTime() - new Date(startTime).getTime();
        this.latencyRecords.push({
            jobId, type, startTime, endTime, latencyMs, itemsCount, bytes
        });
        if (this.latencyRecords.length > 1000) this.latencyRecords.shift();
    }

    /**
     * 计算延迟统计（P50/P90/P99/平均）
     */
    calculateLatencyStats(type = null) {
        const records = type
            ? this.latencyRecords.filter(r => r.type === type)
            : this.latencyRecords;

        if (records.length === 0) return null;

        const latencies = records.map(r => r.latencyMs).sort((a, b) => a - b);
        const count = latencies.length;
        const sum = latencies.reduce((a, b) => a + b, 0);

        return {
            count,
            avgMs: Math.round(sum / count),
            p50Ms: latencies[Math.floor(count * 0.5)],
            p90Ms: latencies[Math.floor(count * 0.9)],
            p99Ms: latencies[Math.floor(count * 0.99)],
            minMs: latencies[0],
            maxMs: latencies[count - 1]
        };
    }

    /**
     * 计算吞吐量（items/sec, bytes/sec）
     */
    calculateThroughput(type = null) {
        const records = type
            ? this.latencyRecords.filter(r => r.type === type)
            : this.latencyRecords;

        if (records.length === 0) return null;

        const totalItems = records.reduce((sum, r) => sum + r.itemsCount, 0);
        const totalBytes = records.reduce((sum, r) => sum + r.bytes, 0);
        const totalTimeSec = records.reduce((sum, r) => sum + r.latencyMs, 0) / 1000;

        return {
            itemsPerSecond: totalTimeSec > 0 ? Math.round(totalItems / totalTimeSec) : 0,
            bytesPerSecond: totalTimeSec > 0 ? Math.round(totalBytes / totalTimeSec) : 0,
            totalItems,
            totalBytes,
            totalTimeSec
        };
    }

    /**
     * 检测延迟趋势（是否在恶化）
     */
    detectLatencyTrend() {
        if (this.latencyRecords.length < 20) return 'insufficient_data';

        const recent = this.latencyRecords.slice(-10);
        const older = this.latencyRecords.slice(-20, -10);

        const recentAvg = recent.reduce((sum, r) => sum + r.latencyMs, 0) / recent.length;
        const olderAvg = older.reduce((sum, r) => sum + r.latencyMs, 0) / older.length;

        const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (changePercent > 20) return 'degrading';
        if (changePercent < -20) return 'improving';
        return 'stable';
    }
}

/**
 * ABC 分类器
 * 根据销售额/利润将商品分为 A/B/C 三类
 * A 类：前 20% 的商品贡献 80% 的销售额
 * B 类：接下来 30% 的商品贡献 15% 的销售额
 * C 类：后 50% 的商品贡献 5% 的销售额
 */
class ABCClassifier {
    constructor() {
        this.products = new Map(); // sku -> {sku, name, revenue, profit, quantity}
    }

    /**
     * 添加或更新商品数据
     */
    updateProduct(sku, name, revenue, profit, quantity) {
        this.products.set(sku, { sku, name, revenue, profit, quantity });
    }

    /**
     * 执行 ABC 分类
     */
    classify() {
        const products = [...this.products.values()];

        // 按销售额降序排序
        products.sort((a, b) => b.revenue - a.revenue);

        const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
        if (totalRevenue === 0) {
            return { A: [], B: [], C: products };
        }

        const result = { A: [], B: [], C: [] };
        let cumulativeRevenue = 0;

        for (const product of products) {
            cumulativeRevenue += product.revenue;
            const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100;

            if (cumulativePercent <= 80) {
                result.A.push({ ...product, cumulativePercent });
            } else if (cumulativePercent <= 95) {
                result.B.push({ ...product, cumulativePercent });
            } else {
                result.C.push({ ...product, cumulativePercent });
            }
        }

        return result;
    }

    /**
     * 获取分类摘要
     */
    getSummary() {
        const classified = this.classify();
        return {
            totalProducts: this.products.size,
            A: {
                count: classified.A.length,
                percent: (classified.A.length / this.products.size * 100).toFixed(1),
                revenue: classified.A.reduce((sum, p) => sum + p.revenue, 0)
            },
            B: {
                count: classified.B.length,
                percent: (classified.B.length / this.products.size * 100).toFixed(1),
                revenue: classified.B.reduce((sum, p) => sum + p.revenue, 0)
            },
            C: {
                count: classified.C.length,
                percent: (classified.C.length / this.products.size * 100).toFixed(1),
                revenue: classified.C.reduce((sum, p) => sum + p.revenue, 0)
            }
        };
    }
}

/**
 * 需求预测器
 * 基于简单移动平均和趋势的需求预测
 */
class DemandForecaster {
    constructor() {
        this.history = new Map(); // sku -> [{date, quantity}]
    }

    /**
     * 记录历史需求
     */
    recordDemand(sku, date, quantity) {
        if (!this.history.has(sku)) {
            this.history.set(sku, []);
        }
        this.history.get(sku).push({ date, quantity });
        if (this.history.get(sku).length > 365) {
            this.history.get(sku).shift();
        }
    }

    /**
     * 简单移动平均预测
     * @param {string} sku - 商品 SKU
     * @param {number} periods - 移动平均周期数
     * @param {number} forecastDays - 预测天数
     */
    forecastMovingAverage(sku, periods = 7, forecastDays = 7) {
        const history = this.history.get(sku) || [];
        if (history.length < periods) return null;

        const recent = history.slice(-periods);
        const avgDemand = recent.reduce((sum, h) => sum + h.quantity, 0) / periods;

        const forecast = [];
        for (let i = 1; i <= forecastDays; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            forecast.push({
                date: date.toISOString().split('T')[0],
                forecastQuantity: Math.round(avgDemand),
                method: 'moving_average',
                confidence: 0.7
            });
        }

        return forecast;
    }

    /**
     * 加权移动平均预测（近期数据权重更高）
     */
    forecastWeightedMovingAverage(sku, periods = 7, forecastDays = 7) {
        const history = this.history.get(sku) || [];
        if (history.length < periods) return null;

        const recent = history.slice(-periods);
        let totalWeight = 0;
        let weightedSum = 0;

        for (let i = 0; i < recent.length; i++) {
            const weight = i + 1; // 越近期权重越高
            weightedSum += recent[i].quantity * weight;
            totalWeight += weight;
        }

        const avgDemand = weightedSum / totalWeight;

        const forecast = [];
        for (let i = 1; i <= forecastDays; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            forecast.push({
                date: date.toISOString().split('T')[0],
                forecastQuantity: Math.round(avgDemand),
                method: 'weighted_moving_average',
                confidence: 0.75
            });
        }

        return forecast;
    }

    /**
     * 计算预测误差（MAE）
     */
    calculateForecastError(sku, method = 'moving_average') {
        const history = this.history.get(sku) || [];
        if (history.length < 14) return null;

        let totalError = 0;
        let count = 0;

        for (let i = 7; i < history.length; i++) {
            const window = history.slice(i - 7, i);
            const forecast = window.reduce((sum, h) => sum + h.quantity, 0) / 7;
            const actual = history[i].quantity;
            totalError += Math.abs(forecast - actual);
            count++;
        }

        return {
            mae: count > 0 ? totalError / count : 0,
            sampleCount: count,
            method
        };
    }
}

/**
 * 安全库存计算器
 * 基于服务水平、需求波动、补货周期计算安全库存
 */
class SafetyStockCalculator {
    /**
     * 计算安全库存
     * @param {object} params - 参数
     * @param {number} params.serviceLevel - 服务水平（0-1，如 0.95 表示 95%）
     * @param {number} params.demandStdDev - 日需求标准差
     * @param {number} params.leadTimeDays - 补货周期（天）
     * @param {number} params.avgDailyDemand - 平均日需求
     */
    calculate(params = {}) {
        const {
            serviceLevel = 0.95,
            demandStdDev = 10,
            leadTimeDays = 7,
            avgDailyDemand = 50
        } = params;

        // 服务水平对应的 Z 值（简化版）
        const zScores = {
            0.90: 1.28,
            0.95: 1.65,
            0.98: 2.05,
            0.99: 2.33,
            0.999: 3.09
        };
        const z = zScores[serviceLevel] || 1.65;

        // 安全库存 = Z * 需求标准差 * sqrt(补货周期)
        const safetyStock = Math.round(z * demandStdDev * Math.sqrt(leadTimeDays));

        // 再订货点 = 平均日需求 * 补货周期 + 安全库存
        const reorderPoint = Math.round(avgDailyDemand * leadTimeDays + safetyStock);

        return {
            safetyStock,
            reorderPoint,
            serviceLevel,
            zScore: z,
            demandStdDev,
            leadTimeDays,
            avgDailyDemand,
            formula: 'safety_stock = Z * σ * √(lead_time)'
        };
    }
}

// 全局单例
const inventoryTurnoverCalculator = new InventoryTurnoverCalculator();
const syncLatencyAnalyzer = new SyncLatencyAnalyzer();
const abcClassifier = new ABCClassifier();
const demandForecaster = new DemandForecaster();
const safetyStockCalculator = new SafetyStockCalculator();

module.exports = {
    InventoryTurnoverCalculator,
    SyncLatencyAnalyzer,
    ABCClassifier,
    DemandForecaster,
    SafetyStockCalculator,
    // 全局单例
    inventoryTurnoverCalculator,
    syncLatencyAnalyzer,
    abcClassifier,
    demandForecaster,
    safetyStockCalculator
};
