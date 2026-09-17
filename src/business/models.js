// ====================================================================
// 业务数据模型
// SyncFlow 企业库存同步平台 - 核心业务实体定义
//
// 本文件定义仓库、库存、订单、同步任务等核心业务实体
// ====================================================================

const {
    WarehouseStatus,
    InventoryType,
    OrderStatus,
    SyncStatus,
    SyncType,
    SyncPriority,
    AlertLevel,
    ProductCategory
} = require('./constants');

/**
 * 仓库实体
 * 代表一个物理仓库或配送中心
 */
class Warehouse {
    constructor(options = {}) {
        this.id = options.id || this._generateId();
        this.name = options.name || 'Unnamed Warehouse';
        this.region = options.region || 'us-east-1';
        this.city = options.city || '';
        this.address = options.address || '';
        this.capacity = options.capacity || 50000;
        this.usedCapacity = options.usedCapacity || 0;
        this.status = options.status || WarehouseStatus.ACTIVE;
        this.manager = options.manager || '';
        this.phone = options.phone || '';
        this.email = options.email || '';
        this.operatingHours = options.operatingHours || '08:00-20:00';
        this.createdAt = options.createdAt || new Date().toISOString();
        this.updatedAt = options.updatedAt || new Date().toISOString();
        this.lastSyncAt = options.lastSyncAt || null;
        this.metadata = options.metadata || {};
    }

    /**
     * 生成仓库 ID
     */
    _generateId() {
        const regions = ['WH-EU', 'WH-US', 'WH-AP', 'WH-SA'];
        const region = regions[Math.floor(Math.random() * regions.length)];
        return `${region}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
    }

    /**
     * 获取使用率百分比
     */
    get utilizationPercent() {
        return this.capacity > 0 ? Math.round((this.usedCapacity / this.capacity) * 100) : 0;
    }

    /**
     * 判断仓库是否可用
     */
    get isAvailable() {
        return this.status === WarehouseStatus.ACTIVE;
    }

    /**
     * 判断仓库是否已满
     */
    get isFull() {
        return this.utilizationPercent >= 95;
    }

    /**
     * 更新已用容量
     */
    updateUsedCapacity(delta) {
        this.usedCapacity = Math.max(0, Math.min(this.capacity, this.usedCapacity + delta));
        this.updatedAt = new Date().toISOString();
        return this.usedCapacity;
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            region: this.region,
            city: this.city,
            capacity: this.capacity,
            usedCapacity: this.usedCapacity,
            utilizationPercent: this.utilizationPercent,
            status: this.status,
            isAvailable: this.isAvailable,
            manager: this.manager,
            operatingHours: this.operatingHours,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastSyncAt: this.lastSyncAt
        };
    }
}

/**
 * 库存项实体
 * 代表某个仓库中的某个 SKU 的库存记录
 */
class InventoryItem {
    constructor(options = {}) {
        this.sku = options.sku || this._generateSku();
        this.name = options.name || `Product ${this.sku}`;
        this.category = options.category || ProductCategory.ELECTRONICS;
        this.warehouseId = options.warehouseId || '';
        this.quantity = options.quantity || 0;
        this.reservedQuantity = options.reservedQuantity || 0;
        this.reorderPoint = options.reorderPoint || 100;
        this.safetyStock = options.safetyStock || 50;
        this.unitPrice = options.unitPrice || 0;
        this.currency = options.currency || 'USD';
        this.type = options.type || InventoryType.FINISHED_GOODS;
        this.location = options.location || '';
        this.batchNumber = options.batchNumber || '';
        this.expiryDate = options.expiryDate || null;
        this.lastCountedAt = options.lastCountedAt || null;
        this.createdAt = options.createdAt || new Date().toISOString();
        this.updatedAt = options.updatedAt || new Date().toISOString();
    }

    /**
     * 生成 SKU
     */
    _generateSku() {
        return 'SKU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    /**
     * 获取可用数量（减去已预留）
     */
    get availableQuantity() {
        return Math.max(0, this.quantity - this.reservedQuantity);
    }

    /**
     * 获取库存价值
     */
    get inventoryValue() {
        return this.quantity * this.unitPrice;
    }

    /**
     * 获取预警级别
     */
    get alertLevel() {
        if (this.quantity === 0) return AlertLevel.OUT_OF_STOCK;
        if (this.quantity <= this.safetyStock) return AlertLevel.CRITICAL;
        if (this.quantity <= this.reorderPoint) return AlertLevel.WARNING;
        return AlertLevel.NORMAL;
    }

    /**
     * 是否需要补货
     */
    get needsReorder() {
        return this.quantity <= this.reorderPoint;
    }

    /**
     * 增加库存
     */
    addStock(quantity) {
        this.quantity += quantity;
        this.updatedAt = new Date().toISOString();
        return this.quantity;
    }

    /**
     * 减少库存
     */
    removeStock(quantity) {
        if (quantity > this.availableQuantity) {
            throw new Error(`Insufficient stock: requested ${quantity}, available ${this.availableQuantity}`);
        }
        this.quantity -= quantity;
        this.updatedAt = new Date().toISOString();
        return this.quantity;
    }

    /**
     * 预留库存
     */
    reserve(quantity) {
        if (quantity > this.availableQuantity) {
            throw new Error(`Cannot reserve ${quantity}: only ${this.availableQuantity} available`);
        }
        this.reservedQuantity += quantity;
        this.updatedAt = new Date().toISOString();
        return this.reservedQuantity;
    }

    /**
     * 释放预留
     */
    release(quantity) {
        this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
        this.updatedAt = new Date().toISOString();
        return this.reservedQuantity;
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            sku: this.sku,
            name: this.name,
            category: this.category,
            warehouseId: this.warehouseId,
            quantity: this.quantity,
            reservedQuantity: this.reservedQuantity,
            availableQuantity: this.availableQuantity,
            reorderPoint: this.reorderPoint,
            safetyStock: this.safetyStock,
            unitPrice: this.unitPrice,
            currency: this.currency,
            inventoryValue: this.inventoryValue,
            alertLevel: this.alertLevel,
            needsReorder: this.needsReorder,
            type: this.type,
            location: this.location,
            lastCountedAt: this.lastCountedAt,
            updatedAt: this.updatedAt
        };
    }
}

/**
 * 订单实体
 * 代表一个销售订单或采购订单
 */
class Order {
    constructor(options = {}) {
        this.id = options.id || this._generateId();
        this.type = options.type || 'sales'; // sales / purchase
        this.status = options.status || OrderStatus.PENDING;
        this.customerId = options.customerId || '';
        this.warehouseId = options.warehouseId || '';
        this.items = options.items || [];
        this.totalAmount = options.totalAmount || 0;
        this.currency = options.currency || 'USD';
        this.shippingAddress = options.shippingAddress || {};
        this.billingAddress = options.billingAddress || {};
        this.paymentStatus = options.paymentStatus || 'pending';
        this.shippingMethod = options.shippingMethod || 'standard';
        this.trackingNumber = options.trackingNumber || '';
        this.notes = options.notes || '';
        this.createdAt = options.createdAt || new Date().toISOString();
        this.updatedAt = options.updatedAt || new Date().toISOString();
        this.estimatedDelivery = options.estimatedDelivery || null;
        this.shippedAt = options.shippedAt || null;
        this.deliveredAt = options.deliveredAt || null;
    }

    /**
     * 生成订单 ID
     */
    _generateId() {
        const prefix = this.type === 'sales' ? 'ORD' : 'PO';
        return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    /**
     * 获取订单商品总数
     */
    get totalItems() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    /**
     * 判断订单是否可取消
     */
    get isCancellable() {
        return [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(this.status);
    }

    /**
     * 添加订单项
     */
    addItem(sku, quantity, unitPrice) {
        const existing = this.items.find(i => i.sku === sku);
        if (existing) {
            existing.quantity += quantity;
        } else {
            this.items.push({ sku, quantity, unitPrice });
        }
        this._recalculateTotal();
        this.updatedAt = new Date().toISOString();
    }

    /**
     * 重新计算订单总额
     */
    _recalculateTotal() {
        this.totalAmount = this.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    }

    /**
     * 更新订单状态
     */
    updateStatus(newStatus) {
        this.status = newStatus;
        this.updatedAt = new Date().toISOString();
        if (newStatus === OrderStatus.SHIPPED) {
            this.shippedAt = new Date().toISOString();
        }
        if (newStatus === OrderStatus.DELIVERED) {
            this.deliveredAt = new Date().toISOString();
        }
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            status: this.status,
            customerId: this.customerId,
            warehouseId: this.warehouseId,
            items: this.items,
            totalItems: this.totalItems,
            totalAmount: this.totalAmount,
            currency: this.currency,
            paymentStatus: this.paymentStatus,
            shippingMethod: this.shippingMethod,
            trackingNumber: this.trackingNumber,
            isCancellable: this.isCancellable,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            estimatedDelivery: this.estimatedDelivery,
            shippedAt: this.shippedAt,
            deliveredAt: this.deliveredAt
        };
    }
}

/**
 * 同步任务实体
 * 代表一次库存同步任务
 */
class SyncJob {
    constructor(options = {}) {
        this.id = options.id || this._generateId();
        this.type = options.type || SyncType.DELTA_UPDATE;
        this.status = options.status || SyncStatus.PENDING;
        this.priority = options.priority || SyncPriority.NORMAL;
        this.sourceWarehouseId = options.sourceWarehouseId || '';
        this.targetWarehouseId = options.targetWarehouseId || '';
        this.direction = options.direction || 'outbound';
        this.itemsCount = options.itemsCount || 0;
        this.itemsProcessed = options.itemsProcessed || 0;
        this.itemsFailed = options.itemsFailed || 0;
        this.totalBytes = options.totalBytes || 0;
        this.startedAt = options.startedAt || null;
        this.completedAt = options.completedAt || null;
        this.errorMessage = options.errorMessage || '';
        this.retryCount = options.retryCount || 0;
        this.maxRetries = options.maxRetries || 2;
        this.createdBy = options.createdBy || 'system';
        this.createdAt = options.createdAt || new Date().toISOString();
        this.updatedAt = options.updatedAt || new Date().toISOString();
    }

    /**
     * 生成同步任务 ID
     */
    _generateId() {
        return `SYNC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    /**
     * 获取进度百分比
     */
    get progressPercent() {
        if (this.itemsCount === 0) return 0;
        return Math.round((this.itemsProcessed / this.itemsCount) * 100);
    }

    /**
     * 获取耗时（毫秒）
     */
    get durationMs() {
        if (!this.startedAt) return 0;
        const end = this.completedAt || Date.now();
        return new Date(end).getTime() - new Date(this.startedAt).getTime();
    }

    /**
     * 获取成功率
     */
    get successRate() {
        if (this.itemsProcessed === 0) return 100;
        return Math.round(((this.itemsProcessed - this.itemsFailed) / this.itemsProcessed) * 100);
    }

    /**
     * 开始同步
     */
    start() {
        this.status = SyncStatus.IN_PROGRESS;
        this.startedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    /**
     * 完成同步
     */
    complete() {
        this.status = SyncStatus.COMPLETED;
        this.completedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    /**
     * 同步失败
     */
    fail(errorMessage) {
        this.status = SyncStatus.FAILED;
        this.errorMessage = errorMessage;
        this.completedAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }

    /**
     * 记录处理进度
     */
    recordProgress(processed, failed = 0, bytes = 0) {
        this.itemsProcessed += processed;
        this.itemsFailed += failed;
        this.totalBytes += bytes;
        this.updatedAt = new Date().toISOString();
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            status: this.status,
            priority: this.priority,
            sourceWarehouseId: this.sourceWarehouseId,
            targetWarehouseId: this.targetWarehouseId,
            direction: this.direction,
            itemsCount: this.itemsCount,
            itemsProcessed: this.itemsProcessed,
            itemsFailed: this.itemsFailed,
            progressPercent: this.progressPercent,
            totalBytes: this.totalBytes,
            durationMs: this.durationMs,
            successRate: this.successRate,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            errorMessage: this.errorMessage,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt
        };
    }
}

module.exports = {
    Warehouse,
    InventoryItem,
    Order,
    SyncJob
};
