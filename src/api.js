// ====================================================================
// 业务 API 模块
// 提供库存管理相关的 REST 端点，返回真实感业务数据
// 支持完整 CRUD：GET / POST / PUT / DELETE
// ====================================================================

// ---- 模拟数据 ----
const WAREHOUSES = [
    { id: 'WH-EU-001', name: 'EU-Central Distribution Center', region: 'eu-central-1', city: 'Frankfurt', capacity: 50000, status: 'active', createdAt: '2024-01-15T08:00:00Z' },
    { id: 'WH-US-001', name: 'US-East Fulfillment Center', region: 'us-east-1', city: 'Ashburn', capacity: 80000, status: 'active', createdAt: '2024-02-20T10:30:00Z' },
    { id: 'WH-US-002', name: 'US-West Logistics Hub', region: 'us-west-2', city: 'Portland', capacity: 45000, status: 'active', createdAt: '2024-03-10T14:00:00Z' },
    { id: 'WH-AP-001', name: 'AP-South Regional Warehouse', region: 'ap-southeast-1', city: 'Singapore', capacity: 35000, status: 'maintenance', createdAt: '2024-04-05T09:00:00Z' },
    { id: 'WH-AP-002', name: 'AP-East Transit Center', region: 'ap-northeast-1', city: 'Tokyo', capacity: 42000, status: 'active', createdAt: '2024-05-12T11:00:00Z' }
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

// 解析请求体（JSON）
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', () => resolve({}));
    });
}

// 生成模拟库存项
function generateInventoryItem(sku) {
    return {
        sku,
        name: `Product ${sku}`,
        category: PRODUCT_CATEGORIES[Math.floor(Math.random() * PRODUCT_CATEGORIES.length)],
        warehouseId: WAREHOUSES[Math.floor(Math.random() * WAREHOUSES.length)].id,
        quantity: Math.floor(Math.random() * 5000),
        reserved: Math.floor(Math.random() * 500),
        unitPrice: Math.round((Math.random() * 500 + 1) * 100) / 100,
        lastUpdated: randomTimestamp(24),
        status: Math.random() > 0.05 ? 'in_stock' : 'out_of_stock'
    };
}

// 生成模拟同步任务
function generateSyncJob(jobId) {
    const status = SYNC_STATUSES[Math.floor(Math.random() * SYNC_STATUSES.length)];
    const startedAt = randomTimestamp(72);
    return {
        jobId,
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
    };
}

// ---- 仓库 CRUD ----

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

// GET /api/v1/warehouses/:id
function getWarehouseById(req, res, id) {
    const warehouse = WAREHOUSES.find(w => w.id === id);
    if (!warehouse) {
        jsonResponse(res, { error: 'Warehouse not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    jsonResponse(res, { data: warehouse, timestamp: new Date().toISOString() });
}

// POST /api/v1/warehouses
async function createWarehouse(req, res) {
    const body = await parseBody(req);
    const id = 'WH-' + String(Date.now()).slice(-6);
    const warehouse = {
        id,
        name: body.name || 'New Warehouse',
        region: body.region || 'us-east-1',
        city: body.city || 'New City',
        capacity: body.capacity || 10000,
        status: 'active',
        createdAt: new Date().toISOString()
    };
    jsonResponse(res, { data: warehouse, message: 'Warehouse created successfully' }, 201);
}

// PUT /api/v1/warehouses/:id
async function updateWarehouse(req, res, id) {
    const body = await parseBody(req);
    const warehouse = WAREHOUSES.find(w => w.id === id);
    if (!warehouse) {
        jsonResponse(res, { error: 'Warehouse not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    const updated = { ...warehouse, ...body, id, lastUpdated: new Date().toISOString() };
    jsonResponse(res, { data: updated, message: 'Warehouse updated successfully' });
}

// DELETE /api/v1/warehouses/:id
function deleteWarehouse(req, res, id) {
    const warehouse = WAREHOUSES.find(w => w.id === id);
    if (!warehouse) {
        jsonResponse(res, { error: 'Warehouse not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    jsonResponse(res, { message: 'Warehouse deleted successfully', deletedId: id }, 200);
}

// ---- 库存 CRUD ----

// GET /api/v1/inventory
function getInventory(req, res) {
    const { page, limit, offset } = paginate(req, 150);
    const items = [];
    for (let i = 0; i < limit; i++) {
        const sku = 'SKU-' + String(10000 + offset + i).padStart(5, '0');
        items.push(generateInventoryItem(sku));
    }
    jsonResponse(res, {
        data: items,
        pagination: { page, limit, total: 150, totalPages: Math.ceil(150 / limit) },
        timestamp: new Date().toISOString()
    });
}

// GET /api/v1/inventory/:sku
function getInventoryItem(req, res, sku) {
    jsonResponse(res, { data: generateInventoryItem(sku), timestamp: new Date().toISOString() });
}

// POST /api/v1/inventory
async function createInventoryItem(req, res) {
    const body = await parseBody(req);
    const sku = body.sku || 'SKU-' + String(Date.now()).slice(-5);
    const item = {
        ...generateInventoryItem(sku),
        ...body,
        sku,
        lastUpdated: new Date().toISOString()
    };
    jsonResponse(res, { data: item, message: 'Inventory item created successfully' }, 201);
}

// PUT /api/v1/inventory/:sku
async function updateInventoryItem(req, res, sku) {
    const body = await parseBody(req);
    const item = {
        ...generateInventoryItem(sku),
        ...body,
        sku,
        lastUpdated: new Date().toISOString()
    };
    jsonResponse(res, { data: item, message: 'Inventory item updated successfully' });
}

// DELETE /api/v1/inventory/:sku
function deleteInventoryItem(req, res, sku) {
    jsonResponse(res, { message: 'Inventory item deleted successfully', deletedSku: sku }, 200);
}

// ---- 同步任务 CRUD ----

// GET /api/v1/sync/jobs
function getSyncJobs(req, res) {
    const { page, limit, offset } = paginate(req, 80);
    const jobs = [];
    for (let i = 0; i < limit; i++) {
        const jobId = 'JOB-' + String(20000 + offset + i).padStart(6, '0');
        jobs.push(generateSyncJob(jobId));
    }
    jsonResponse(res, {
        data: jobs,
        pagination: { page, limit, total: 80, totalPages: Math.ceil(80 / limit) },
        timestamp: new Date().toISOString()
    });
}

// GET /api/v1/sync/jobs/:jobId
function getSyncJobById(req, res, jobId) {
    jsonResponse(res, { data: generateSyncJob(jobId), timestamp: new Date().toISOString() });
}

// POST /api/v1/sync/jobs
async function createSyncJob(req, res) {
    const body = await parseBody(req);
    const jobId = 'JOB-' + String(Date.now()).slice(-6);
    const job = {
        ...generateSyncJob(jobId),
        ...body,
        jobId,
        status: 'pending',
        progress: 0,
        startedAt: null,
        createdAt: new Date().toISOString()
    };
    jsonResponse(res, { data: job, message: 'Sync job created successfully' }, 201);
}

// PUT /api/v1/sync/jobs/:jobId (取消/重试)
async function updateSyncJob(req, res, jobId) {
    const body = await parseBody(req);
    const job = {
        ...generateSyncJob(jobId),
        ...body,
        jobId,
        lastUpdated: new Date().toISOString()
    };
    jsonResponse(res, { data: job, message: 'Sync job updated successfully' });
}

// DELETE /api/v1/sync/jobs/:jobId
function deleteSyncJob(req, res, jobId) {
    jsonResponse(res, { message: 'Sync job deleted successfully', deletedJobId: jobId }, 200);
}

// ---- 指标 ----

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

// ---- 路由匹配（支持路径参数） ----
function handleApiRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const method = req.method;

    // 仓库路由
    if (path === '/api/v1/warehouses') {
        if (method === 'GET') { getWarehouses(req, res); return true; }
        if (method === 'POST') { createWarehouse(req, res); return true; }
        jsonResponse(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
        return true;
    }
    const whMatch = path.match(/^\/api\/v1\/warehouses\/([^/]+)$/);
    if (whMatch) {
        const id = decodeURIComponent(whMatch[1]);
        if (method === 'GET') { getWarehouseById(req, res, id); return true; }
        if (method === 'PUT') { updateWarehouse(req, res, id); return true; }
        if (method === 'DELETE') { deleteWarehouse(req, res, id); return true; }
        jsonResponse(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
        return true;
    }

    // 库存路由
    if (path === '/api/v1/inventory') {
        if (method === 'GET') { getInventory(req, res); return true; }
        if (method === 'POST') { createInventoryItem(req, res); return true; }
        jsonResponse(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
        return true;
    }
    const invMatch = path.match(/^\/api\/v1\/inventory\/([^/]+)$/);
    if (invMatch) {
        const sku = decodeURIComponent(invMatch[1]);
        if (method === 'GET') { getInventoryItem(req, res, sku); return true; }
        if (method === 'PUT') { updateInventoryItem(req, res, sku); return true; }
        if (method === 'DELETE') { deleteInventoryItem(req, res, sku); return true; }
        jsonResponse(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
        return true;
    }

    // 同步任务路由
    if (path === '/api/v1/sync/jobs') {
        if (method === 'GET') { getSyncJobs(req, res); return true; }
        if (method === 'POST') { createSyncJob(req, res); return true; }
        jsonResponse(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
        return true;
    }
    const jobMatch = path.match(/^\/api\/v1\/sync\/jobs\/([^/]+)$/);
    if (jobMatch) {
        const jobId = decodeURIComponent(jobMatch[1]);
        if (method === 'GET') { getSyncJobById(req, res, jobId); return true; }
        if (method === 'PUT') { updateSyncJob(req, res, jobId); return true; }
        if (method === 'DELETE') { deleteSyncJob(req, res, jobId); return true; }
        jsonResponse(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
        return true;
    }

    // 指标路由
    if (path === '/api/v1/metrics' && method === 'GET') {
        getMetrics(req, res);
        return true;
    }

    return null; // 未匹配，交给后续路由
}

module.exports = { handleApiRequest };

// ---- 假数据动态更新（模拟真实业务数据波动）----
// 定期更新仓库库存、同步任务状态，让 API 数据看起来像真实运行的业务系统
let dataSimulatorStarted = false;

function startDataSimulator() {
    if (dataSimulatorStarted) return;
    dataSimulatorStarted = true;

    // 每 30 秒随机更新仓库容量和状态
    setInterval(() => {
        for (const wh of WAREHOUSES) {
            // 随机波动容量（±5%）
            const change = Math.floor((Math.random() - 0.5) * wh.capacity * 0.1);
            wh.capacity = Math.max(10000, wh.capacity + change);
            // 小概率切换状态（maintenance <-> active）
            if (Math.random() < 0.02) {
                wh.status = wh.status === 'active' ? 'maintenance' : 'active';
            }
        }
    }, 30000);

    // 每 15 秒更新同步任务状态（模拟任务推进）
    setInterval(() => {
        // 这里可以扩展为更新内存中的同步任务列表
        // 当前任务是每次请求随机生成，所以不需要显式更新
    }, 15000);
}

// 启动数据模拟器（延迟启动，避免影响服务启动）
setTimeout(startDataSimulator, 5000);
