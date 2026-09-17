// ====================================================================
// 业务常量与枚举
// SyncFlow 企业库存同步平台 - 业务领域常量定义
//
// 本文件定义所有业务相关的常量、枚举和类型，供各模块引用
// ====================================================================

/**
 * 仓库状态枚举
 */
const WarehouseStatus = Object.freeze({
    ACTIVE: 'active',           // 正常运营
    MAINTENANCE: 'maintenance', // 维护中
    OFFLINE: 'offline',         // 离线
    RESTRICTED: 'restricted'    // 受限（部分功能不可用）
});

/**
 * 库存类型枚举
 */
const InventoryType = Object.freeze({
    RAW_MATERIAL: 'raw_material',       // 原材料
    WORK_IN_PROGRESS: 'work_in_progress', // 在制品
    FINISHED_GOODS: 'finished_goods',   // 成品
    PACKAGING: 'packaging',             // 包装材料
    SPARE_PARTS: 'spare_parts'          // 备件
});

/**
 * 订单状态枚举
 */
const OrderStatus = Object.freeze({
    PENDING: 'pending',           // 待处理
    CONFIRMED: 'confirmed',       // 已确认
    PICKING: 'picking',           // 拣货中
    PACKED: 'packed',             // 已打包
    SHIPPED: 'shipped',           // 已发货
    DELIVERED: 'delivered',       // 已送达
    CANCELLED: 'cancelled',       // 已取消
    RETURNED: 'returned'          // 已退货
});

/**
 * 同步任务状态枚举
 */
const SyncStatus = Object.freeze({
    PENDING: 'pending',           // 待同步
    IN_PROGRESS: 'in_progress',   // 同步中
    COMPLETED: 'completed',       // 已完成
    FAILED: 'failed',             // 失败
    RETRYING: 'retrying',         // 重试中
    CANCELLED: 'cancelled'        // 已取消
});

/**
 * 同步类型枚举
 */
const SyncType = Object.freeze({
    FULL_INVENTORY: 'full_inventory',       // 全量库存同步
    DELTA_UPDATE: 'delta_update',           // 增量更新
    PRICE_SYNC: 'price_sync',               // 价格同步
    STOCK_RECONCILIATION: 'stock_reconciliation', // 库存对账
    ORDER_SYNC: 'order_sync',               // 订单同步
    PRODUCT_SYNC: 'product_sync'            // 商品同步
});

/**
 * 同步优先级枚举
 */
const SyncPriority = Object.freeze({
    LOW: 1,        // 低优先级
    NORMAL: 2,     // 普通优先级
    HIGH: 3,       // 高优先级
    CRITICAL: 4    // 紧急优先级
});

/**
 * 库存预警级别枚举
 */
const AlertLevel = Object.freeze({
    NORMAL: 'normal',           // 正常
    WARNING: 'warning',         // 警告（库存偏低）
    CRITICAL: 'critical',       // 严重（库存不足）
    OUT_OF_STOCK: 'out_of_stock' // 缺货
});

/**
 * 仓库区域枚举
 */
const WarehouseRegion = Object.freeze({
    US_EAST: 'us-east-1',
    US_WEST: 'us-west-2',
    EU_CENTRAL: 'eu-central-1',
    EU_WEST: 'eu-west-1',
    AP_SOUTHEAST: 'ap-southeast-1',
    AP_NORTHEAST: 'ap-northeast-1',
    AP_SOUTH: 'ap-south-1',
    SA_EAST: 'sa-east-1'
});

/**
 * 产品类别枚举
 */
const ProductCategory = Object.freeze({
    ELECTRONICS: 'Electronics',
    APPAREL: 'Apparel',
    HOME_GARDEN: 'Home & Garden',
    SPORTS: 'Sports',
    AUTOMOTIVE: 'Automotive',
    HEALTH_BEAUTY: 'Health & Beauty',
    TOYS: 'Toys & Games',
    BOOKS: 'Books & Media'
});

/**
 * 同步方向枚举
 */
const SyncDirection = Object.freeze({
    INBOUND: 'inbound',   // 入站（从仓库到中心）
    OUTBOUND: 'outbound', // 出站（从中心到仓库）
    BIDIRECTIONAL: 'bidirectional' // 双向
});

/**
 * 数据格式枚举
 */
const DataFormat = Object.freeze({
    JSON: 'json',
    XML: 'xml',
    CSV: 'csv',
    BINARY: 'binary'
});

/**
 * 业务事件类型枚举
 */
const BusinessEventType = Object.freeze({
    INVENTORY_UPDATE: 'inventory.update',
    INVENTORY_LOW: 'inventory.low',
    INVENTORY_OUT: 'inventory.out_of_stock',
    ORDER_CREATED: 'order.created',
    ORDER_UPDATED: 'order.updated',
    ORDER_SHIPPED: 'order.shipped',
    WAREHOUSE_OFFLINE: 'warehouse.offline',
    WAREHOUSE_ONLINE: 'warehouse.online',
    SYNC_STARTED: 'sync.started',
    SYNC_COMPLETED: 'sync.completed',
    SYNC_FAILED: 'sync.failed',
    SYSTEM_NOTIFICATION: 'system.notification'
});

/**
 * 同步协议版本
 */
const ProtocolVersion = Object.freeze({
    V1: '1.0.0',
    V2: '2.0.0',
    V2_4: '2.4.1',
    CURRENT: '2.4.1'
});

/**
 * 默认配置常量
 */
const DefaultConfig = Object.freeze({
    DEFAULT_PORT: 3000,
    DEFAULT_PING_INTERVAL: 30000,
    DEFAULT_IDLE_TIMEOUT: 300000,
    DEFAULT_MAX_CONNECTIONS: 500,
    DEFAULT_MAX_CONNECTIONS_PER_IP: 50,
    DEFAULT_MEMORY_LIMIT_MB: 384,
    DEFAULT_SHUTDOWN_TIMEOUT: 10000,
    DEFAULT_AUTH_MAX_FAILURES: 5,
    DEFAULT_AUTH_WINDOW_MS: 60000,
    DEFAULT_AUTH_BAN_MS: 300000,
    DEFAULT_CIRCUIT_BREAKER_THRESHOLD: 5,
    DEFAULT_CIRCUIT_BREAKER_TIMEOUT: 30000,
    DEFAULT_MAX_RETRIES: 2,
    DEFAULT_RETRY_DELAY_BASE: 150
});

/**
 * 业务错误码枚举
 */
const BusinessErrorCode = Object.freeze({
    WAREHOUSE_NOT_FOUND: 'WAREHOUSE_NOT_FOUND',
    SKU_NOT_FOUND: 'SKU_NOT_FOUND',
    INVENTORY_LOCKED: 'INVENTORY_LOCKED',
    INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
    SYNC_JOB_EXPIRED: 'SYNC_JOB_EXPIRED',
    SYNC_QUEUE_FULL: 'SYNC_QUEUE_FULL',
    WAREHOUSE_MAINTENANCE: 'WAREHOUSE_MAINTENANCE',
    WAREHOUSE_OFFLINE: 'WAREHOUSE_OFFLINE',
    ORDER_ALREADY_PROCESSED: 'ORDER_ALREADY_PROCESSED',
    INVALID_PRODUCT_CATEGORY: 'INVALID_PRODUCT_CATEGORY'
});

module.exports = {
    WarehouseStatus,
    InventoryType,
    OrderStatus,
    SyncStatus,
    SyncType,
    SyncPriority,
    AlertLevel,
    WarehouseRegion,
    ProductCategory,
    SyncDirection,
    DataFormat,
    BusinessEventType,
    ProtocolVersion,
    DefaultConfig,
    BusinessErrorCode
};
