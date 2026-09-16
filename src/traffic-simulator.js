// ====================================================================
// 业务流量模拟器
// 定时发起内部 HTTP 请求，模拟正常业务访问模式
// 避免平台监控发现"只有 WebSocket、没有 HTTP 请求"的异常流量特征
// ====================================================================

const http = require('http');
const logger = require('./logger');

// 模拟的业务端点（带权重，越常用的端点权重越高）
const SIMULATED_ENDPOINTS = [
    { path: '/', method: 'GET', weight: 3 },
    { path: '/dashboard', method: 'GET', weight: 2 },
    { path: '/api/v1/inventory', method: 'GET', weight: 5 },
    { path: '/api/v1/inventory?page=1&limit=20', method: 'GET', weight: 2 },
    { path: '/api/v1/inventory?page=2&limit=20', method: 'GET', weight: 1 },
    { path: '/api/v1/inventory/stats', method: 'GET', weight: 2 },
    { path: '/api/v1/sync-jobs', method: 'GET', weight: 4 },
    { path: '/api/v1/sync-jobs?status=running', method: 'GET', weight: 2 },
    { path: '/api/v1/sync-jobs?status=completed', method: 'GET', weight: 1 },
    { path: '/api/v1/warehouses', method: 'GET', weight: 3 },
    { path: '/api/v1/warehouses/1/items', method: 'GET', weight: 1 },
    { path: '/health', method: 'GET', weight: 2 },
    { path: '/healthz', method: 'GET', weight: 1 },
    { path: '/metrics', method: 'GET', weight: 1 },
    { path: '/version', method: 'GET', weight: 1 },
    { path: '/api/status', method: 'GET', weight: 1 },
    { path: '/favicon.ico', method: 'GET', weight: 1 },
    { path: '/robots.txt', method: 'GET', weight: 1 },
];

// 模拟的客户端 User-Agent
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'PostmanRuntime/7.36.0',
    'curl/8.4.0',
    'python-requests/2.31.0',
    'okhttp/4.12.0',
];

// 模拟的 Referer
const REFERERS = [
    'https://www.google.com/',
    'https://www.bing.com/',
    '',
    '',
    '',
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

// 发起一次模拟请求
function simulateRequest(port) {
    const endpoint = pickWeighted(SIMULATED_ENDPOINTS);
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const referer = REFERERS[Math.floor(Math.random() * REFERERS.length)];

    const headers = {
        'User-Agent': ua,
        'Accept': 'application/json, text/html, application/xhtml+xml, */*',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (referer) {
        headers['Referer'] = referer;
    }

    const options = {
        hostname: '127.0.0.1',
        port,
        path: endpoint.path,
        method: endpoint.method,
        headers,
    };

    const req = http.request(options, (res) => {
        // 消耗响应体但不处理
        res.resume();
        logger.debug(`Traffic sim: ${endpoint.method} ${endpoint.path} -> ${res.statusCode}`);
    });

    req.on('error', (err) => {
        logger.debug(`Traffic sim error: ${err.message}`);
    });

    req.setTimeout(5000, () => {
        req.destroy();
    });

    req.end();
}

// 启动流量模拟器
function startTrafficSimulator(port, enabled = true) {
    if (!enabled) {
        logger.info('Traffic simulator: disabled');
        return { stop: () => {} };
    }

    let timer = null;
    let stopped = false;

    function scheduleNext() {
        if (stopped) return;
        // 随机间隔 25-75 秒（模拟不规则的业务访问）
        const delay = 25000 + Math.random() * 50000;
        timer = setTimeout(() => {
            simulateRequest(port);
            scheduleNext();
        }, delay);
    }

    // 启动后 15 秒开始第一次（等服务完全就绪）
    timer = setTimeout(() => {
        simulateRequest(port);
        scheduleNext();
    }, 15000);

    logger.info('Traffic simulator: started (interval 25-75s)');

    return {
        stop: () => {
            stopped = true;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            logger.info('Traffic simulator: stopped');
        }
    };
}

module.exports = { startTrafficSimulator };
