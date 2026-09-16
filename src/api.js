// ====================================================================
// 业务 API 模块
// 提供库存管理相关的 REST 端点，返回真实感业务数据
// ====================================================================

// ---- 模拟数据生成 ----
const WAREHOUSES = [
    { id: 'WH-EU-001', name: 'EU-Central Distribution Center', region: 'eu-central-1', city: 'Frankfurt', capacity: 50000, status: 'active' },
    { id: 'WH-US-001', name: 'US-East Fulfillment Center', region: 'us-east-1', city: 'Ashburn', capacity: 80000, status: 'active' },
    { id: 'WH-US-002', name: 'US-West Logistics Hub', region: 'us-west-2', city: 'Portland', capacity: 45000, status: 'active' },
    { id: 'WH-AP-001', name: 'AP-South Regional Warehouse', region: 'ap-southeast-1', city: 'Singapore', capacity: 35000, status: 'maintenance' },
    { id: 'WH-AP-002', name: 'AP-East Transit Center', region: 'ap-northeast-1', city: 'Tokyo', capacity: 42000, status: 'active' }
];

const PRODUCT_CATEGORIES = ['Electronics', 'Apparel', 'Home & Garden', 'Sports', 'Automotive', 'Health & Beauty'];
const SYNC_STATUSES = ['completed', 'in_progress', 'pending', 'failed', 'retrying'];
const SYNC_TYPES = ['full_inventory', 'delta_update', 'price_sync', 'stock_reconciliation'];

function randomTimestamp(hoursBack) {
    return new Date(Date.now() - Math.random() * hoursBack * 3600000).toISOString();
}

function paginate(req, total) {
    const url = new URL(req.url, 'http://localhost');
    const page = Math.max(1, parseInt(url.searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit'), 10) || 20));
    const totalPages = Math.ceil(total / limit);
    return { page, limit, totalPages, offset: (page - 1) * limit };
}

function jsonResponse(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
}

// ---- 端点处理 ----

// GET /api/v1/warehouses
function getWarehouses(req, res) {
    const { page, limit, totalPages, offset } = paginate(req, WAREHOUSES.length);
    const items = WAREHOUSES.slice(offset, offset + limit);
    jsonResponse(res, {
        data: items,
        pagination: { page, limit, total: WAREHOUSES.length, totalPages },
        timestamp: new Date().toISOString()
    });
}

// GET /api/v1/inventory
function getInventory(req, res) {
    const { page, limit } = paginate(req, 150);
    const items = [];
    for (let i = 0; i < limit; i++) {
        const sku = 'SKU-' + String(10000 + offset + i).padStart(5, '0');
        items.push({
            sku,
            name: `Product ${sku}`,
            category: PRODUCT_CATEGORIES[Math.floor(Math.random() * PRODUCT_CATEGORIES.length)],
            warehouseId: WAREHOUSES[Math.floor(Math.random() * WAREHOUSES.length)].id,
            quantity: Math.floor(Math.random() * 5000),
            reserved: Math.floor(Math.random() * 500),
            unitPrice: Math.round((Math.random() * 500 + 1) * 100) / 100,
            lastUpdated: randomTimestamp(24),
            status: Math.random() > 0.05 ? 'in_stock' : 'out_of_stock'
        });
    }
    jsonResponse(res, {
        data: items,
        pagination: { page, limit, total: 150, totalPages: Math.ceil(150 / limit) },
        timestamp: new Date().toISOString()
    });
}

// GET /api/v1/sync/jobs
function getSyncJobs(req, res) {
    const { page, limit } = paginate(req, 80);
    const jobs = [];
    for (let i = 0; i < limit; i++) {
        const status = SYNC_STATUSES[Math.floor(Math.random() * SYNC_STATUSES.length)];
        const startedAt = randomTimestamp(72);
        jobs.push({
            jobId: 'JOB-' + String(20000 + offset + i).padStart(6, '0'),
            type: SYNC_TYPES[Math.floor(Math.random() * SYNC_TYPES.length)],
            sourceWarehouse: WAREHOUSES[Math.floor(Math.random() * WAREHOUSES.length)].id,
            targetWarehouse: WAREHOUSES[Math.floor(Math.random() * WAREHOUSES.length)].id,
            status,
            progress: status === 'completed' ? 100 : Math.floor(Math.random() * 100),
            recordsProcessed: Math.floor(Math.random() * 50000),
            recordsFailed: Math.random() > 0.9 ? Math.floor(Math.random() * 50) : 0,
            startedAt,
            completedAt: status === 'completed' ? new Date(new Date(startedAt).getTime() + Math.random() * 600000).toISOString() : null,
            durationMs: status === 'completed' ? Math.floor(Math.random() * 600000) : null
        });
    }
    jsonResponse(res, {
        data: jobs,
        pagination: { page, limit, total: 80, totalPages: Math.ceil(80 / limit) },
        timestamp: new Date().toISOString()
    });
}

// GET /api/v1/metrics
function getMetrics(req, res) {
    jsonResponse(res, {
        timestamp: new Date().toISOString(),
        metrics: {
            totalInventoryValue: Math.round(Math.random() * 5000000 + 1000000),
            activeWarehouses: WAREHOUSES.filter(w => w.status === 'active').length,
            totalWarehouses: WAREHOUSES.length,
            syncJobsToday: Math.floor(Math.random() * 200 + 50),
            successPercent: Math.round((Math.random() * 3 + 96) * 100) / 100,
            avgSyncLatencyMs: Math.floor(Math.random() * 50 + 10),
            dataTransferredGB: Math.round(Math.random() * 100 + 10)
        }
    });
}

// 路由匹配
function handleApiRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method !== 'GET') {
        return jsonResponse(res, { error: 'Method not allowed' }, 405);
    }

    if (path === '/api/v1/warehouses') return getWarehouses(req, res);
    if (path === '/api/v1/inventory') return getInventory(req, res);
    if (path === '/api/v1/sync/jobs') return getSyncJobs(req, res);
    if (path === '/api/v1/metrics') return getMetrics(req, res);

    return null; // 未匹配，交给后续路由
}

module.exports = { handleApiRequest };
