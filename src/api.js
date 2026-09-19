// ====================================================================
// 业务 API 模块
// 提供库存管理相关的 REST 端点，返回真实感业务数据
// 支持完整 CRUD：GET / POST / PUT / DELETE
// ====================================================================

// ---- 模拟数据 ----
// 安全限制：防止内存无限增长
const MAX_WAREHOUSES = 100;
const MAX_INVENTORY_ITEMS = 500;
const MAX_SYNC_JOBS = 200;

// 字段白名单：防止客户端通过批量赋值注入任意字段
function filterFields(body, allowedFields) {
    const filtered = {};
    for (const key of allowedFields) {
        if (body[key] !== undefined) {
            filtered[key] = body[key];
        }
    }
    return filtered;
}

const WAREHOUSE_ALLOWED = ['name', 'region', 'city', 'capacity', 'status'];
const INVENTORY_ALLOWED = ['name', 'category', 'warehouseId', 'quantity', 'unitPrice', 'status', 'reserved'];
const SYNCJOB_ALLOWED = ['type', 'sourceWarehouse', 'targetWarehouse', 'priority', 'itemsCount'];

// 持久化存储（用于 create/delete 操作，上限检查）
const INVENTORY = [];
const SYNC_JOBS = [];

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
// 安全限制：最大 1MB 请求体，防止 OOM 攻击
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        let byteCount = 0;
        let aborted = false;
        req.on('data', (chunk) => {
            if (aborted) return;
            byteCount += chunk.length;  // 按字节计数，非 UTF-16 码元
            if (byteCount > MAX_BODY_SIZE) {
                aborted = true;
                req.destroy();
                resolve({ __error: 'REQUEST_TOO_LARGE' });
                return;
            }
            body += chunk;
        });
        req.on('end', () => {
            if (aborted) return;
            if (!body) { resolve({}); return; }
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({ __error: 'INVALID_JSON', message: 'Request body is not valid JSON' });
            }
        });
        req.on('error', () => {
            if (!aborted) resolve({ __error: 'REQUEST_ERROR' });
        });
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
    if (body.__error) {
        return jsonResponse(res, { error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    // 去重检查：如果指定了name，检查是否已存在
    if (body.name) {
        const existing = WAREHOUSES.find(w => w.name === body.name);
        if (existing) {
            jsonResponse(res, { error: 'Warehouse already exists', code: 'DUPLICATE', data: existing }, 409);
            return;
        }
    }
    // 上限检查
    if (WAREHOUSES.length >= MAX_WAREHOUSES) {
        jsonResponse(res, { error: 'Maximum warehouses limit reached', code: 'LIMIT_EXCEEDED' }, 413);
        return;
    }
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
    WAREHOUSES.push(warehouse);
    jsonResponse(res, { data: warehouse, message: 'Warehouse created successfully' }, 201);
}

// PUT /api/v1/warehouses/:id
async function updateWarehouse(req, res, id) {
    const body = await parseBody(req);
    if (body.__error) {
        return jsonResponse(res, { error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    const warehouse = WAREHOUSES.find(w => w.id === id);
    if (!warehouse) {
        jsonResponse(res, { error: 'Warehouse not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    const updated = { ...warehouse, ...filterFields(body, WAREHOUSE_ALLOWED), id, lastUpdated: new Date().toISOString() };
    const idx = WAREHOUSES.findIndex(w => w.id === id);
    if (idx !== -1) WAREHOUSES[idx] = updated;
    jsonResponse(res, { data: updated, message: 'Warehouse updated successfully' });
}

// DELETE /api/v1/warehouses/:id
function deleteWarehouse(req, res, id) {
    const warehouse = WAREHOUSES.find(w => w.id === id);
    if (!warehouse) {
        jsonResponse(res, { error: 'Warehouse not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    const idx = WAREHOUSES.findIndex(w => w.id === id);
    if (idx !== -1) WAREHOUSES.splice(idx, 1);
    jsonResponse(res, { message: 'Warehouse deleted successfully', deletedId: id }, 200);
}

// ---- 库存 CRUD ----

// GET /api/v1/inventory
function getInventory(req, res) {
    // 如果持久化数组为空，生成初始数据
    if (INVENTORY.length === 0) {
        for (let i = 0; i < 50; i++) {
            const sku = 'SKU-' + String(10000 + i).padStart(5, '0');
            INVENTORY.push(generateInventoryItem(sku));
        }
    }
    const { page, limit, offset } = paginate(req, INVENTORY.length);
    const items = INVENTORY.slice(offset, offset + limit);
    jsonResponse(res, {
        data: items,
        pagination: { page, limit, total: INVENTORY.length, totalPages: Math.ceil(INVENTORY.length / limit) },
        timestamp: new Date().toISOString()
    });
}

// GET /api/v1/inventory/:sku
function getInventoryItem(req, res, sku) {
    // 确保数组已初始化
    if (INVENTORY.length === 0) {
        for (let i = 0; i < 50; i++) {
            const s = 'SKU-' + String(10000 + i).padStart(5, '0');
            INVENTORY.push(generateInventoryItem(s));
        }
    }
    const item = INVENTORY.find(i => i.sku === sku);
    if (!item) {
        jsonResponse(res, { error: 'Inventory item not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    jsonResponse(res, { data: item, timestamp: new Date().toISOString() });
}

// POST /api/v1/inventory
async function createInventoryItem(req, res) {
    if (WAREHOUSES.length === 0) {
        return sendError(res, 409, 'NO_WAREHOUSES', 'No warehouses available - create a warehouse first');
    }
    const body = await parseBody(req);
    if (body.__error) {
        return jsonResponse(res, { error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    // 上限检查
    if (INVENTORY.length >= MAX_INVENTORY_ITEMS) {
        jsonResponse(res, { error: 'Maximum inventory items limit reached', code: 'LIMIT_EXCEEDED' }, 413);
        return;
    }
    const sku = body.sku || 'SKU-' + String(Date.now()).slice(-5);
    const item = {
        ...generateInventoryItem(sku),
        ...filterFields(body, INVENTORY_ALLOWED),
        sku,
        lastUpdated: new Date().toISOString()
    };
    INVENTORY.push(item);
    jsonResponse(res, { data: item, message: 'Inventory item created successfully' }, 201);
}

// PUT /api/v1/inventory/:sku
async function updateInventoryItem(req, res, sku) {
    const body = await parseBody(req);
    if (body.__error) {
        return jsonResponse(res, { error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    // 确保数组已初始化
    if (INVENTORY.length === 0) {
        for (let i = 0; i < 50; i++) {
            const s = 'SKU-' + String(10000 + i).padStart(5, '0');
            INVENTORY.push(generateInventoryItem(s));
        }
    }
    const idx = INVENTORY.findIndex(i => i.sku === sku);
    if (idx === -1) {
        jsonResponse(res, { error: 'Inventory item not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    const item = {
        ...INVENTORY[idx],
        ...filterFields(body, INVENTORY_ALLOWED),
        sku,
        lastUpdated: new Date().toISOString()
    };
    INVENTORY[idx] = item;
    jsonResponse(res, { data: item, message: 'Inventory item updated successfully' });
}

// DELETE /api/v1/inventory/:sku
function deleteInventoryItem(req, res, sku) {
    const idx = INVENTORY.findIndex(i => i.sku === sku);
    if (idx === -1) {
        jsonResponse(res, { error: 'Inventory item not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    INVENTORY.splice(idx, 1);
    jsonResponse(res, { message: 'Inventory item deleted successfully', deletedSku: sku }, 200);
}

// ---- 同步任务 CRUD ----

// GET /api/v1/sync/jobs
function getSyncJobs(req, res) {
    // 如果持久化数组为空，生成初始数据
    if (SYNC_JOBS.length === 0) {
        for (let i = 0; i < 30; i++) {
            const jobId = 'JOB-' + String(20000 + i).padStart(6, '0');
            SYNC_JOBS.push(generateSyncJob(jobId));
        }
    }
    const { page, limit, offset } = paginate(req, SYNC_JOBS.length);
    const jobs = SYNC_JOBS.slice(offset, offset + limit);
    jsonResponse(res, {
        data: jobs,
        pagination: { page, limit, total: SYNC_JOBS.length, totalPages: Math.ceil(SYNC_JOBS.length / limit) },
        timestamp: new Date().toISOString()
    });
}

// GET /api/v1/sync/jobs/:jobId
function getSyncJobById(req, res, jobId) {
    // 确保数组已初始化
    if (SYNC_JOBS.length === 0) {
        for (let i = 0; i < 30; i++) {
            const j = 'JOB-' + String(20000 + i).padStart(6, '0');
            SYNC_JOBS.push(generateSyncJob(j));
        }
    }
    const job = SYNC_JOBS.find(j => j.jobId === jobId);
    if (!job) {
        jsonResponse(res, { error: 'Sync job not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    jsonResponse(res, { data: job, timestamp: new Date().toISOString() });
}

// POST /api/v1/sync/jobs
async function createSyncJob(req, res) {
    const body = await parseBody(req);
    if (body.__error) {
        return jsonResponse(res, { error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    // 上限检查
    if (SYNC_JOBS.length >= MAX_SYNC_JOBS) {
        jsonResponse(res, { error: 'Maximum sync jobs limit reached', code: 'LIMIT_EXCEEDED' }, 413);
        return;
    }
    const jobId = 'JOB-' + String(Date.now()).slice(-6);
    const job = {
        ...generateSyncJob(jobId),
        ...filterFields(body, SYNCJOB_ALLOWED),
        jobId,
        status: 'pending',
        progress: 0,
        startedAt: null,
        createdAt: new Date().toISOString()
    };
    SYNC_JOBS.push(job);
    jsonResponse(res, { data: job, message: 'Sync job created successfully' }, 201);
}

// PUT /api/v1/sync/jobs/:jobId (取消/重试)
async function updateSyncJob(req, res, jobId) {
    const body = await parseBody(req);
    if (body.__error) {
        return jsonResponse(res, { error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' }, 413);
    }
    // 确保数组已初始化
    if (SYNC_JOBS.length === 0) {
        for (let i = 0; i < 30; i++) {
            const j = 'JOB-' + String(20000 + i).padStart(6, '0');
            SYNC_JOBS.push(generateSyncJob(j));
        }
    }
    const idx = SYNC_JOBS.findIndex(j => j.jobId === jobId);
    if (idx === -1) {
        jsonResponse(res, { error: 'Sync job not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    const job = {
        ...SYNC_JOBS[idx],
        ...filterFields(body, SYNCJOB_ALLOWED),
        jobId,
        lastUpdated: new Date().toISOString()
    };
    SYNC_JOBS[idx] = job;
    jsonResponse(res, { data: job, message: 'Sync job updated successfully' });
}

// DELETE /api/v1/sync/jobs/:jobId
function deleteSyncJob(req, res, jobId) {
    const idx = SYNC_JOBS.findIndex(j => j.jobId === jobId);
    if (idx === -1) {
        jsonResponse(res, { error: 'Sync job not found', code: 'NOT_FOUND' }, 404);
        return;
    }
    SYNC_JOBS.splice(idx, 1);
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
        let id;
        try { id = decodeURIComponent(whMatch[1]); } catch (e) { return sendError(res, 400, 'INVALID_ID', 'Invalid warehouse ID encoding'); }
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
        let sku;
        try { sku = decodeURIComponent(invMatch[1]); } catch (e) { return sendError(res, 400, 'INVALID_SKU', 'Invalid SKU encoding'); }
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
        let jobId;
        try { jobId = decodeURIComponent(jobMatch[1]); } catch (e) { return sendError(res, 400, 'INVALID_JOB_ID', 'Invalid job ID encoding'); }
        if (method === 'GET') { getSyncJobById(req, res, jobId); return true; }
        if (method === 'PUT') { updateSyncJob(req, res, jobId); return true; }
        if (method === 'DELETE') { deleteSyncJob(req, res, jobId); return true; }
        jsonResponse(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
        return true;
    }

    // 指标路由
    if (path === '/api/v1/metrics') {
        if (method !== 'GET') {
            jsonResponse(res, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
            return true;
        }
        getMetrics(req, res);
        return true;
    }

    return null; // 未匹配，交给后续路由
}

module.exports = {
    handleApiRequest,
    getInventory: () => INVENTORY,
    getSyncJobs: () => SYNC_JOBS,
    getWarehouses: () => WAREHOUSES,
    INVENTORY,
    SYNC_JOBS,
    WAREHOUSES,
    startDataSimulator,
    stopDataSimulator
};

// ---- 业务数据生命周期引擎（方案一：真实业务数据生命周期模拟）----
// 库存波动、任务流转、仓库负载变化、业务事件关联
const dataLifecycle = require('./business/data-lifecycle');
let dataSimulatorStarted = false;

function startDataSimulator() {
    if (dataSimulatorStarted) return;
    dataSimulatorStarted = true;
    // 启动数据生命周期引擎（库存波动、任务流转、仓库负载）
    dataLifecycle.start(INVENTORY, SYNC_JOBS, WAREHOUSES);
}

function stopDataSimulator() {
    if (!dataSimulatorStarted) return;
    dataSimulatorStarted = false;
    dataLifecycle.stop();
}

// 启动数据模拟器（延迟启动，避免影响服务启动）
// 数据生命周期引擎启动权已移交 src/index.js（避免模块导入即有生产副作用）
