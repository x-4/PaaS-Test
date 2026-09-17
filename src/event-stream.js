// ====================================================================
// 业务事件推送引擎
// 负责 /api/v1/events 端点的 WebSocket 连接，推送 JSON 格式的业务事件
// 用于业务伪装：让 WS 流量不只是二进制同步数据，还有真实的业务事件推送
// ====================================================================

const { WebSocketServer } = require('ws');
const logger = require('./logger');

// 业务事件类型（模拟企业库存同步系统的真实事件）
const EVENT_TYPES = [
    'inventory.updated',
    'inventory.low_stock',
    'inventory.restocked',
    'sync_job.started',
    'sync_job.progress',
    'sync_job.completed',
    'sync_job.failed',
    'warehouse.online',
    'warehouse.offline',
    'order.shipped',
    'order.delivered',
    'price.changed'
];

const WAREHOUSE_IDS = ['WH-EU-001', 'WH-US-001', 'WH-US-002', 'WH-AP-001', 'WH-AP-002'];
const SKU_PREFIXES = ['SKU-', 'PRD-', 'ITEM-'];

// 生成随机业务事件
function generateEvent() {
    const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const warehouse = WAREHOUSE_IDS[Math.floor(Math.random() * WAREHOUSE_IDS.length)];
    const sku = SKU_PREFIXES[Math.floor(Math.random() * SKU_PREFIXES.length)] +
        String(10000 + Math.floor(Math.random() * 90000));
    const jobId = 'JOB-' + String(Date.now()).slice(-6);

    const base = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
        type,
        timestamp: new Date().toISOString(),
        source: warehouse
    };

    switch (type) {
        case 'inventory.updated':
            return { ...base, data: { sku, quantity: Math.floor(Math.random() * 5000), warehouse } };
        case 'inventory.low_stock':
            return { ...base, data: { sku, quantity: Math.floor(Math.random() * 10), threshold: 50, warehouse } };
        case 'inventory.restocked':
            return { ...base, data: { sku, quantity: Math.floor(Math.random() * 1000) + 500, warehouse } };
        case 'sync_job.started':
            return { ...base, data: { jobId, type: 'full_inventory', source: warehouse, target: WAREHOUSE_IDS[Math.floor(Math.random() * WAREHOUSE_IDS.length)] } };
        case 'sync_job.progress':
            return { ...base, data: { jobId, progress: Math.floor(Math.random() * 80) + 10, recordsProcessed: Math.floor(Math.random() * 50000) } };
        case 'sync_job.completed':
            return { ...base, data: { jobId, duration: Math.floor(Math.random() * 120000) + 10000, records: Math.floor(Math.random() * 50000) + 1000 } };
        case 'sync_job.failed':
            return { ...base, data: { jobId, error: 'Connection timeout', retryCount: Math.floor(Math.random() * 3) } };
        case 'warehouse.online':
        case 'warehouse.offline':
            return { ...base, data: { warehouse, status: type === 'warehouse.online' ? 'online' : 'offline' } };
        case 'order.shipped':
        case 'order.delivered':
            return { ...base, data: { orderId: 'ORD-' + Date.now().toString().slice(-8), carrier: ['DHL', 'FedEx', 'UPS', 'SF'][Math.floor(Math.random() * 4)] } };
        case 'price.changed':
            return { ...base, data: { sku, oldPrice: Math.round(Math.random() * 500 * 100) / 100, newPrice: Math.round(Math.random() * 500 * 100) / 100 } };
        default:
            return base;
    }
}

// 引入 crypto（放在文件末尾避免 hoist 问题）
const crypto = require('crypto');

// 创建业务事件推送服务器
function createEventStreamServer() {
    const wss = new WebSocketServer({
        noServer: true,
        handleProtocols: (protocols) => {
            if (protocols.includes('syncflow.events.v1')) return 'syncflow.events.v1';
            for (const p of protocols) return p;
            return false;
        }
    });

    wss.on('connection', (ws, req) => {
        const clientAddr = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        logger.debug(`Event stream connected: ${clientAddr}`);

        // 连接建立后立即发送一个欢迎事件
        const welcomeEvent = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
            type: 'stream.connected',
            timestamp: new Date().toISOString(),
            data: { message: 'Connected to SyncFlow event stream', subscriptions: ['inventory', 'sync_jobs', 'warehouses'] }
        };
        ws.send(JSON.stringify(welcomeEvent));

        // 定期推送业务事件（随机间隔 8-25 秒，模拟真实事件流）
        let eventTimer = null;
        let isAlive = true;

        function scheduleNextEvent() {
            if (!isAlive || ws.readyState !== ws.OPEN) return;
            const delay = 8000 + Math.random() * 17000; // 8-25 秒
            eventTimer = setTimeout(() => {
                if (ws.readyState === ws.OPEN) {
                    const event = generateEvent();
                    ws.send(JSON.stringify(event));
                    logger.debug(`Event pushed: ${event.type} -> ${clientAddr}`);
                }
                scheduleNextEvent();
            }, delay);
        }

        scheduleNextEvent();

        // 心跳
        ws.on('pong', () => { isAlive = true; });
        const heartbeatTimer = setInterval(() => {
            if (!isAlive) {
                cleanup();
                return;
            }
            isAlive = false;
            try { ws.ping(); } catch (e) { cleanup(); }
        }, 30000);

        // 处理客户端消息（订阅/取消订阅）
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.action === 'subscribe' || msg.action === 'unsubscribe') {
                    logger.debug(`Event stream ${msg.action}: ${msg.channels?.join(', ')} from ${clientAddr}`);
                    const ack = {
                        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36),
                        type: 'subscription.updated',
                        timestamp: new Date().toISOString(),
                        data: { action: msg.action, channels: msg.channels || [] }
                    };
                    ws.send(JSON.stringify(ack));
                }
            } catch (e) {
                // 忽略非 JSON 消息
            }
        });

        function cleanup() {
            isAlive = false;
            if (eventTimer) clearTimeout(eventTimer);
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            try { ws.terminate(); } catch (e) {}
        }

        ws.on('close', () => {
            logger.debug(`Event stream disconnected: ${clientAddr}`);
            cleanup();
        });
        ws.on('error', () => cleanup());
    });

    return wss;
}

module.exports = { createEventStreamServer, generateEvent };
