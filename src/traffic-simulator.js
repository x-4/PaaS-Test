// ====================================================================
// 业务流量模拟器
// 定时发起内部 HTTP 请求，模拟正常业务访问模式
// 包含：单次随机请求 + 用户会话模拟 + POST/PUT/DELETE + Cookie/CSRF
// 避免平台监控发现"只有 WebSocket、没有 HTTP 请求"的异常流量特征
// ====================================================================

const http = require('http');
const crypto = require('crypto');
const WebSocket = require('ws');
const logger = require('./logger');
const { getTrafficRate } = require('./connection');

// ---- 请求体生成函数 ----
function generateInventoryBody() {
    const sku = 'SKU-' + String(10000 + Math.floor(Math.random() * 90000)).padStart(5, '0');
    const categories = ['Electronics', 'Apparel', 'Home & Garden', 'Sports', 'Automotive', 'Health & Beauty'];
    const warehouses = ['WH-EU-001', 'WH-US-001', 'WH-US-002', 'WH-AP-001', 'WH-AP-002'];
    return JSON.stringify({
        sku,
        name: `Product ${sku}`,
        category: categories[Math.floor(Math.random() * categories.length)],
        warehouseId: warehouses[Math.floor(Math.random() * warehouses.length)],
        quantity: Math.floor(Math.random() * 5000),
        unitPrice: Math.round((Math.random() * 500 + 1) * 100) / 100
    });
}

function generateInventoryUpdateBody() {
    return JSON.stringify({
        quantity: Math.floor(Math.random() * 5000),
        reserved: Math.floor(Math.random() * 500),
        unitPrice: Math.round((Math.random() * 500 + 1) * 100) / 100,
        status: Math.random() > 0.05 ? 'in_stock' : 'out_of_stock'
    });
}

function generateWarehouseBody() {
    const regions = ['us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'];
    const cities = ['New York', 'Los Angeles', 'Frankfurt', 'Singapore', 'Tokyo', 'London', 'Sydney'];
    return JSON.stringify({
        name: `${cities[Math.floor(Math.random() * cities.length)]} Distribution Center`,
        region: regions[Math.floor(Math.random() * regions.length)],
        city: cities[Math.floor(Math.random() * cities.length)],
        capacity: Math.floor(Math.random() * 80000) + 10000
    });
}

function generateWarehouseUpdateBody() {
    return JSON.stringify({
        capacity: Math.floor(Math.random() * 80000) + 10000,
        status: Math.random() > 0.1 ? 'active' : 'maintenance'
    });
}

function generateSyncJobBody() {
    const types = ['full_inventory', 'delta_update', 'price_sync', 'stock_reconciliation'];
    const warehouses = ['WH-EU-001', 'WH-US-001', 'WH-US-002', 'WH-AP-001', 'WH-AP-002'];
    const source = warehouses[Math.floor(Math.random() * warehouses.length)];
    let target = warehouses[Math.floor(Math.random() * warehouses.length)];
    while (target === source) target = warehouses[Math.floor(Math.random() * warehouses.length)];
    return JSON.stringify({
        type: types[Math.floor(Math.random() * types.length)],
        sourceWarehouse: source,
        targetWarehouse: target
    });
}

function generateSyncJobUpdateBody() {
    const actions = ['cancel', 'retry', 'pause'];
    return JSON.stringify({
        action: actions[Math.floor(Math.random() * actions.length)]
    });
}

// ---- 模拟端点定义（带权重，包含 GET/POST/PUT/DELETE）----
const SIMULATED_ENDPOINTS = [
    // 页面访问
    { path: '/', method: 'GET', weight: 3, category: 'page' },
    { path: '/dashboard', method: 'GET', weight: 2, category: 'page' },
    { path: '/inventory', method: 'GET', weight: 2, category: 'page' },
    { path: '/warehouses', method: 'GET', weight: 1, category: 'page' },
    { path: '/sync', method: 'GET', weight: 1, category: 'page' },
    { path: '/settings', method: 'GET', weight: 1, category: 'page' },
    { path: '/docs', method: 'GET', weight: 1, category: 'page' },
    { path: '/about', method: 'GET', weight: 0.5, category: 'page' },

    // GET API
    { path: '/api/v1/inventory', method: 'GET', weight: 5, category: 'api' },
    { path: '/api/v1/inventory?page=1&limit=20', method: 'GET', weight: 2, category: 'api' },
    { path: '/api/v1/inventory?page=2&limit=20', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/inventory?search=laptop&category=Electronics', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/inventory?status=in_stock&sort=quantity_desc', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/inventory?warehouseId=WH-US-001&page=1&limit=50', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/inventory/SKU-10001', method: 'GET', weight: 2, category: 'api' },
    { path: '/api/v1/inventory/SKU-10002', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/inventory?stats=1', method: 'GET', weight: 2, category: 'api' },
    { path: '/api/v1/sync/jobs', method: 'GET', weight: 4, category: 'api' },
    { path: '/api/v1/sync/jobs?status=running', method: 'GET', weight: 2, category: 'api' },
    { path: '/api/v1/sync/jobs?status=completed', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/sync/jobs/JOB-20001', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/warehouses', method: 'GET', weight: 3, category: 'api' },
    { path: '/api/v1/warehouses/WH-EU-001', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/metrics', method: 'GET', weight: 2, category: 'api' },
    { path: '/api/v1/inventory/export?format=csv', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/warehouses?region=us-east-1&status=active', method: 'GET', weight: 1, category: 'api' },
    { path: '/api/v1/sync/jobs?status=completed&sort=created_at_desc', method: 'GET', weight: 1, category: 'api' },

    // POST API（带请求体）
    { path: '/api/v1/inventory', method: 'POST', weight: 2, category: 'api', body: generateInventoryBody },
    { path: '/api/v1/warehouses', method: 'POST', weight: 1, category: 'api', body: generateWarehouseBody },
    { path: '/api/v1/sync/jobs', method: 'POST', weight: 2, category: 'api', body: generateSyncJobBody },

    // PUT API（带请求体）
    { path: '/api/v1/inventory/SKU-10001', method: 'PUT', weight: 1, category: 'api', body: generateInventoryUpdateBody },
    { path: '/api/v1/warehouses/WH-EU-001', method: 'PUT', weight: 0.5, category: 'api', body: generateWarehouseUpdateBody },
    { path: '/api/v1/sync/jobs/JOB-20001', method: 'PUT', weight: 1, category: 'api', body: generateSyncJobUpdateBody },

    // DELETE API
    { path: '/api/v1/inventory/SKU-10003', method: 'DELETE', weight: 0.5, category: 'api' },
    { path: '/api/v1/sync/jobs/JOB-20003', method: 'DELETE', weight: 0.5, category: 'api' },

    // 健康检查
    { path: '/health', method: 'GET', weight: 2, category: 'health' },
    { path: '/healthz', method: 'GET', weight: 1, category: 'health' },
    { path: '/version', method: 'GET', weight: 0.5, category: 'health' },

    // 静态资源
    { path: '/favicon.ico', method: 'GET', weight: 1, category: 'static' },
    { path: '/robots.txt', method: 'GET', weight: 0.5, category: 'static' },
    { path: '/manifest.json', method: 'GET', weight: 0.5, category: 'static' },
];

// ---- 用户会话模板（连续请求多个相关端点，模拟真实用户操作流程）----
const USER_SESSIONS = [
    // 浏览库存（含页面访问+搜索）
    [
        { path: '/', method: 'GET' },
        { path: '/cdn/css/app.v1.0.0.css', method: 'GET' },
        { path: '/cdn/js/app.v1.0.0.js', method: 'GET' },
        { path: '/inventory', method: 'GET' },
        { path: '/api/v1/inventory?page=1&limit=20&search=laptop', method: 'GET' },
        { path: '/api/v1/inventory/SKU-10001', method: 'GET' },
        { path: '/api/v1/warehouses', method: 'GET' },
        { path: '/api/v1/metrics', method: 'POST', body: () => JSON.stringify({ v: 1, tid: 'G-XXXXXXXXXX', cid: '123456.789012', t: 'pageview', dp: '/inventory' }) },
    ],
    // 管理同步任务（含页面访问+创建任务）
    [
        { path: '/dashboard', method: 'GET' },
        { path: '/cdn/img/logo.svg', method: 'GET' },
        { path: '/api/v1/sync/jobs', method: 'GET' },
        { path: '/sync', method: 'GET' },
        { path: '/api/v1/sync/jobs', method: 'POST', body: generateSyncJobBody },
        { path: '/api/v1/metrics', method: 'GET' },
        { path: '/api/v1/metrics', method: 'POST', body: () => JSON.stringify({ v: 1, tid: 'G-XXXXXXXXXX', cid: '234567.890123', t: 'event', ec: 'sync', ea: 'create_job' }) },
    ],
    // 仓库管理（含页面访问+筛选）
    [
        { path: '/', method: 'GET' },
        { path: '/warehouses', method: 'GET' },
        { path: '/api/v1/warehouses?region=us-east&status=active', method: 'GET' },
        { path: '/api/v1/warehouses', method: 'POST', body: generateWarehouseBody },
        { path: '/api/v1/warehouses/WH-EU-001', method: 'GET' },
        { path: '/api/v1/inventory', method: 'POST', body: () => JSON.stringify({ event_id: 'evt_' + Date.now(), timestamp: new Date().toISOString(), platform: 'javascript', sdk: { name: 'sentry.javascript.browser', version: '7.91.0' }, exception: { values: [{ type: 'Error', value: 'Test error report', stacktrace: { frames: [] } }] } }) },
    ],
    // 库存操作（含页面访问+搜索+更新）
    [
        { path: '/inventory', method: 'GET' },
        { path: '/cdn/css/app.css', method: 'GET' },
        { path: '/api/v1/inventory?category=electronics&sort=price_asc', method: 'GET' },
        { path: '/api/v1/inventory', method: 'POST', body: generateInventoryBody },
        { path: '/api/v1/inventory/SKU-10001', method: 'PUT', body: generateInventoryUpdateBody },
        { path: '/api/v1/inventory?stats=1', method: 'GET' },
        { path: '/api/v1/metrics', method: 'POST', body: () => JSON.stringify({ v: 1, tid: 'G-XXXXXXXXXX', cid: '345678.901234', t: 'event', ec: 'inventory', ea: 'update_item' }) },
    ],
    // 查看监控（含页面访问+多端点）
    [
        { path: '/dashboard', method: 'GET' },
        { path: '/cdn/js/app.js', method: 'GET' },
        { path: '/api/v1/metrics', method: 'GET' },
        { path: '/health', method: 'GET' },
        { path: '/api/v1/inventory?page=1&limit=20', method: 'GET' },
        { path: '/settings', method: 'GET' },
        { path: '/about', method: 'GET' },
    ],
    // 文档浏览（含页面访问+搜索）
    [
        { path: '/docs', method: 'GET' },
        { path: '/cdn/img/icon.svg', method: 'GET' },
        { path: '/api/docs/openapi.json', method: 'GET' },
        { path: '/api/v1/inventory?search=warehouse', method: 'GET' },
        { path: '/api/v1/metrics', method: 'POST', body: () => JSON.stringify({ v: 1, tid: 'G-XXXXXXXXXX', cid: '456789.012345', t: 'pageview', dp: '/docs' }) },
    ],
];

// ---- 客户端标识 ----
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'PostmanRuntime/7.36.0',
    'curl/8.4.0',
    'python-requests/2.31.0',
];

const REFERERS = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.linkedin.com/',
    '', '', '',
];

// 加权随机选择
function pickWeighted(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * total;
    for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item;
    }
    return items[0];
}

// ---- 自适应间隔计算 ----
// 根据 WS 流量等级动态调整 HTTP 请求间隔
// 流量等级：0=无流量, 1=低, 2=中, 3=高
// 真实业务场景：WS 活跃（用户在使用实时功能）时，HTTP API 请求也更频繁
const INTERVAL_TABLE = {
    single: {
        0: { min: 60000, max: 120000 },   // 无流量：60-120秒
        1: { min: 30000, max: 60000 },     // 低流量：30-60秒
        2: { min: 15000, max: 30000 },     // 中流量：15-30秒
        3: { min: 5000, max: 15000 }       // 高流量：5-15秒
    },
    session: {
        0: { min: 180000, max: 300000 },   // 无流量：180-300秒
        1: { min: 120000, max: 180000 },   // 低流量：120-180秒
        2: { min: 60000, max: 120000 },    // 中流量：60-120秒
        3: { min: 30000, max: 60000 }      // 高流量：30-60秒
    }
};

// 计算自适应间隔（根据当前 WS 流量等级）
function calculateAdaptiveInterval(type) {
    const { trafficLevel } = getTrafficRate();
    const table = INTERVAL_TABLE[type] || INTERVAL_TABLE.single;
    const interval = table[trafficLevel] || table[0];
    return interval.min + Math.random() * (interval.max - interval.min);
}

// 生成会话上下文（Cookie、CSRF Token、User-Agent）
function createSessionContext() {
    return {
        sessionId: crypto.randomBytes(16).toString('hex'),
        csrfToken: crypto.randomBytes(24).toString('hex'),
        userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        referer: REFERERS[Math.floor(Math.random() * REFERERS.length)],
    };
}

// 发起一次模拟请求（支持 GET/POST/PUT/DELETE，带 Cookie/CSRF）
function simulateRequest(port, endpoint, sessionCtx = null) {
    const ctx = sessionCtx || createSessionContext();
    const ua = ctx.userAgent;
    const referer = ctx.referer;

    const headers = {
        'User-Agent': ua,
        'Accept': 'application/json, text/html, application/xhtml+xml, */*',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'X-Requested-With': 'XMLHttpRequest',
    };

    // 会话 Cookie
    if (ctx.sessionId) {
        headers['Cookie'] = `syncflow_session=${ctx.sessionId}`;
    }

    // CSRF Token（POST/PUT/DELETE 时携带）
    if (endpoint.method !== 'GET' && ctx.csrfToken) {
        headers['X-CSRF-Token'] = ctx.csrfToken;
        headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    if (referer) {
        headers['Referer'] = referer;
    }

    // 请求体
    let bodyData = null;
    if (endpoint.body && typeof endpoint.body === 'function') {
        bodyData = endpoint.body();
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const options = {
        hostname: '127.0.0.1',
        port,
        path: endpoint.path,
        method: endpoint.method,
        headers,
    };

    const req = http.request(options, (res) => {
        res.resume();
        logger.debug(`Traffic sim: ${endpoint.method} ${endpoint.path} -> ${res.statusCode}`);
    });

    req.on('error', (err) => {
        logger.debug(`Traffic sim error: ${err.message}`);
    });

    req.setTimeout(5000, () => {
        req.destroy();
    });

    if (bodyData) {
        req.write(bodyData);
    }
    req.end();
}

// 执行一个用户会话（连续请求多个端点，模拟真实用户操作）
async function executeUserSession(port, session) {
    const ctx = createSessionContext();
    logger.debug(`User session started: ${session.length} requests, UA=${ctx.userAgent.substring(0, 30)}...`);

    for (let i = 0; i < session.length; i++) {
        if (i > 0) {
            // 请求间随机延迟 800-3000ms（模拟用户阅读/操作时间）
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 2200));
        }
        simulateRequest(port, session[i], ctx);
    }

    logger.debug(`User session completed: ${session.length} requests`);
}

// ---- 业务事件流连接模拟 ----
// 定期建立到 /api/v1/events 的 WebSocket 连接，接收业务推送，保持一段时间后断开
// 用于业务伪装：让 WS 流量不只是二进制同步数据，还有 JSON 业务事件流
const EVENT_STREAM_UAS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function simulateEventStreamConnection(port) {
    const ua = EVENT_STREAM_UAS[Math.floor(Math.random() * EVENT_STREAM_UAS.length)];
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/events`, {
        headers: {
            'User-Agent': ua,
            'Accept': 'text/event-stream, application/json',
            'Origin': `http://127.0.0.1:${port}`,
        }
    });

    let eventCount = 0;
    const connectionDuration = 30000 + Math.random() * 90000; // 保持 30-120 秒

    ws.on('open', () => {
        logger.debug(`Event stream sim: connected (duration=${Math.round(connectionDuration / 1000)}s)`);
        // 连接后发送一个订阅请求
        setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                    action: 'subscribe',
                    channels: ['inventory', 'sync_jobs', 'warehouses']
                }));
            }
        }, 1000 + Math.random() * 2000);
    });

    ws.on('message', (data) => {
        eventCount++;
        if (eventCount <= 2) {
            try {
                const event = JSON.parse(data.toString());
                logger.debug(`Event stream sim: received ${event.type} (total=${eventCount})`);
            } catch (e) {}
        }
    });

    ws.on('error', (err) => {
        logger.debug(`Event stream sim error: ${err.message}`);
    });

    // 一段时间后断开
    setTimeout(() => {
        if (ws.readyState === ws.OPEN) {
            logger.debug(`Event stream sim: closing after ${eventCount} events`);
            ws.close();
        }
    }, connectionDuration);

    return ws;
}

// 启动流量模拟器
function startTrafficSimulator(port, enabled = true) {
    if (!enabled) {
        logger.info('Traffic simulator: disabled');
        return { stop: () => {} };
    }

    let singleTimer = null;
    let sessionTimer = null;
    let eventStreamTimer = null;
    let activeEventStream = null;
    let stopped = false;

    // 单次随机请求（自适应间隔：根据 WS 流量动态调整）
    function scheduleSingleRequest() {
        if (stopped) return;
        const delay = calculateAdaptiveInterval('single');
        singleTimer = setTimeout(() => {
            const endpoint = pickWeighted(SIMULATED_ENDPOINTS);
            simulateRequest(port, endpoint);
            scheduleSingleRequest();
        }, delay);
    }

    // 用户会话（自适应间隔：根据 WS 流量动态调整，60%概率触发）
    function scheduleUserSession() {
        if (stopped) return;
        const delay = calculateAdaptiveInterval('session');
        sessionTimer = setTimeout(() => {
            if (Math.random() < 0.6) {
                const session = USER_SESSIONS[Math.floor(Math.random() * USER_SESSIONS.length)];
                executeUserSession(port, session).catch(() => {});
            }
            scheduleUserSession();
        }, delay);
    }

    // 业务事件流连接（自适应间隔：WS 流量大时更频繁，模拟用户在监控面板停留）
    function scheduleEventStream() {
        if (stopped) return;
        // 事件流连接间隔：根据流量等级调整
        const { trafficLevel } = getTrafficRate();
        const baseDelay = [120000, 90000, 60000, 45000][trafficLevel] || 120000; // 无流量120s，高流量45s
        const delay = baseDelay + Math.random() * baseDelay * 0.5;
        eventStreamTimer = setTimeout(() => {
            if (!activeEventStream || activeEventStream.readyState !== WebSocket.OPEN) {
                activeEventStream = simulateEventStreamConnection(port);
            }
            scheduleEventStream();
        }, delay);
    }

    // 启动后 15 秒开始第一次单次请求
    singleTimer = setTimeout(() => {
        const endpoint = pickWeighted(SIMULATED_ENDPOINTS);
        simulateRequest(port, endpoint);
        scheduleSingleRequest();
    }, 15000);

    // 启动后 30 秒开始第一个用户会话
    sessionTimer = setTimeout(() => {
        const session = USER_SESSIONS[Math.floor(Math.random() * USER_SESSIONS.length)];
        executeUserSession(port, session).catch(() => {});
        scheduleUserSession();
    }, 30000);

    // 启动后 45 秒开始第一个业务事件流连接
    eventStreamTimer = setTimeout(() => {
        activeEventStream = simulateEventStreamConnection(port);
        scheduleEventStream();
    }, 45000);

    logger.info('Traffic simulator: started (adaptive interval + event stream)');

    return {
        stop: () => {
            stopped = true;
            if (singleTimer) { clearTimeout(singleTimer); singleTimer = null; }
            if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }
            if (eventStreamTimer) { clearTimeout(eventStreamTimer); eventStreamTimer = null; }
            if (activeEventStream) {
                try { activeEventStream.close(); } catch (e) {}
                activeEventStream = null;
            }
            logger.info('Traffic simulator: stopped');
        }
    };
}

// ---- 定时同步任务模拟 ----
const SCHEDULED_JOB_TYPES = ['full_inventory', 'delta_update', 'price_sync', 'stock_reconciliation'];
const WAREHOUSE_IDS = ['WH-EU-001', 'WH-US-001', 'WH-US-002', 'WH-AP-001', 'WH-AP-002'];

function simulateScheduledJob() {
    const jobType = SCHEDULED_JOB_TYPES[Math.floor(Math.random() * SCHEDULED_JOB_TYPES.length)];
    const source = WAREHOUSE_IDS[Math.floor(Math.random() * WAREHOUSE_IDS.length)];
    let target = WAREHOUSE_IDS[Math.floor(Math.random() * WAREHOUSE_IDS.length)];
    while (target === source) {
        target = WAREHOUSE_IDS[Math.floor(Math.random() * WAREHOUSE_IDS.length)];
    }
    const jobId = 'JOB-' + String(Date.now()).slice(-6);
    const records = Math.floor(Math.random() * 50000) + 1000;
    const duration = Math.floor(Math.random() * 120000) + 10000;

    logger.info(`[SyncJob] ${jobId} STARTED type=${jobType} source=${source} target=${target}`);

    const progressSteps = Math.floor(Math.random() * 3) + 2;
    for (let i = 1; i <= progressSteps; i++) {
        setTimeout(() => {
            const progress = Math.floor((i / progressSteps) * 100);
            logger.debug(`[SyncJob] ${jobId} PROGRESS ${progress}% (${Math.floor(records * progress / 100)} records)`);
        }, (duration / progressSteps) * i);
    }

    setTimeout(() => {
        const success = Math.random() > 0.05;
        if (success) {
            logger.info(`[SyncJob] ${jobId} COMPLETED records=${records} duration=${Math.round(duration / 1000)}s`);
        } else {
            const failedRecords = Math.floor(Math.random() * 50);
            logger.warn(`[SyncJob] ${jobId} COMPLETED_WITH_WARNINGS records=${records} failed=${failedRecords} duration=${Math.round(duration / 1000)}s`);
        }
    }, duration + 1000);
}

function startScheduledJobSimulator() {
    let timer = null;
    let stopped = false;

    function scheduleNext() {
        if (stopped) return;
        const delay = (15 + Math.random() * 30) * 60 * 1000;
        timer = setTimeout(() => {
            simulateScheduledJob();
            scheduleNext();
        }, delay);
    }

    timer = setTimeout(() => {
        simulateScheduledJob();
        scheduleNext();
    }, (2 + Math.random() * 3) * 60 * 1000);

    logger.info('Scheduled job simulator: started (interval 15-45min)');

    return {
        stop: () => {
            stopped = true;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            logger.info('Scheduled job simulator: stopped');
        }
    };
}

module.exports = { startTrafficSimulator, startScheduledJobSimulator, simulateScheduledJob };
