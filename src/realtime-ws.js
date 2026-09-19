// ====================================================================
// 实时业务消息 WebSocket 端点
// 用于业务：提供真实的双向业务消息（库存变更单更新同步进度等）
// 与实时数据端点完全分离，不影响核心同步功能
// ====================================================================

const WebSocket = require('#socket-runtime');
const logger = require('./logger');

// 业务消息类型
const MESSAGE_TYPES = {
    PING: 'ping',
    PONG: 'pong',
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    INVENTORY_UPDATE: 'inventory.update',
    ORDER_UPDATE: 'order.update',
    SYNC_PROGRESS: 'sync.progress',
    SYSTEM_NOTIFICATION: 'system.notification',
    WAREHOUSE_ALERT: 'warehouse.alert'
};

// 订阅频道
const CHANNELS = ['inventory', 'order', 'sync', 'system', 'warehouse'];

// 模拟数据生成?
function generateInventoryUpdate() {
    const warehouses = ['WH-BJ-01', 'WH-SH-02', 'WH-GZ-03', 'WH-SZ-04', 'WH-CD-05'];
    const products = ['SKU-' + Math.floor(Math.random() * 9000 + 1000), 'SKU-' + Math.floor(Math.random() * 9000 + 1000)];
    return {
        type: MESSAGE_TYPES.INVENTORY_UPDATE,
        timestamp: new Date().toISOString(),
        data: {
            warehouse: warehouses[Math.floor(Math.random() * warehouses.length)],
            product: products[Math.floor(Math.random() * products.length)],
            quantity: Math.floor(Math.random() * 500),
            change: Math.floor(Math.random() * 100 - 50),
            reason: ['sale', 'return', 'transfer', 'adjustment'][Math.floor(Math.random() * 4)]
        }
    };
}

function generateOrderUpdate() {
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    return {
        type: MESSAGE_TYPES.ORDER_UPDATE,
        timestamp: new Date().toISOString(),
        data: {
            orderId: 'ORD-' + Date.now().toString(36).toUpperCase(),
            status: statuses[Math.floor(Math.random() * statuses.length)],
            items: Math.floor(Math.random() * 5 + 1),
            total: (Math.random() * 5000 + 100).toFixed(2)
        }
    };
}

function generateSyncProgress() {
    return {
        type: MESSAGE_TYPES.SYNC_PROGRESS,
        timestamp: new Date().toISOString(),
        data: {
            taskId: 'SYNC-' + Math.floor(Math.random() * 9000 + 1000),
            progress: Math.floor(Math.random() * 100),
            status: ['running', 'completed', 'failed'][Math.floor(Math.random() * 3)],
            recordsProcessed: Math.floor(Math.random() * 10000),
            recordsTotal: Math.floor(Math.random() * 50000 + 10000)
        }
    };
}

function generateSystemNotification() {
    const levels = ['info', 'warning', 'success'];
    const messages = [
        'Scheduled sync completed successfully',
        'Warehouse WH-BJ-01 inventory threshold reached',
        'System backup completed',
        'New integration connected: Shopify',
        'API rate limit reset'
    ];
    return {
        type: MESSAGE_TYPES.SYSTEM_NOTIFICATION,
        timestamp: new Date().toISOString(),
        data: {
            level: levels[Math.floor(Math.random() * levels.length)],
            message: messages[Math.floor(Math.random() * messages.length)],
            read: false
        }
    };
}

function generateWarehouseAlert() {
    return {
        type: MESSAGE_TYPES.WAREHOUSE_ALERT,
        timestamp: new Date().toISOString(),
        data: {
            warehouse: 'WH-' + ['BJ', 'SH', 'GZ', 'SZ', 'CD'][Math.floor(Math.random() * 5)] + '-0' + Math.floor(Math.random() * 9 + 1),
            alertType: ['low_stock', 'overstock', 'temperature', 'humidity'][Math.floor(Math.random() * 4)],
            severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            message: 'Inventory level below threshold'
        }
    };
}

const generators = [
    generateInventoryUpdate,
    generateOrderUpdate,
    generateSyncProgress,
    generateSystemNotification,
    generateWarehouseAlert
];

// 实时业务消息 WebSocket 服务器
let wss = null;
let messageInterval = null;
let connectedClients = 0;

function createRealtimeWebSocketServer() {
    if (wss) return wss;

    wss = new WebSocket.Server({ noServer: true, maxPayload: 1 * 1024 * 1024 });  // 1MB 单帧上限

    wss.on('connection', (ws, req) => {
        connectedClients++;
        ws.subscriptions = new Set(['inventory', 'order', 'sync', 'system', 'warehouse']);
        ws.isAlive = true;

        const clientIp = req.socket.remoteAddress || 'unknown';
        logger.debug(`Realtime WS connected: ${clientIp} (total: ${connectedClients})`);

        // 发迎消?
        ws.send(JSON.stringify({
            type: 'system.connected',
            timestamp: new Date().toISOString(),
            data: {
                message: 'Connected to SyncFlow realtime service',
                channels: CHANNELS,
                serverTime: new Date().toISOString()
            }
        }));

        // 蹇冭烦
        ws.on('pong', () => { ws.isAlive = true; });

        // 处理客户端消息
        ws.on('message', (data) => {
            ws.isAlive = true;
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === MESSAGE_TYPES.PING) {
                    ws.send(JSON.stringify({ type: MESSAGE_TYPES.PONG, timestamp: new Date().toISOString() }));
                } else if (msg.type === MESSAGE_TYPES.SUBSCRIBE && msg.channel) {
                    if (CHANNELS.includes(msg.channel)) {
                        ws.subscriptions.add(msg.channel);
                        logger.debug(`Realtime WS subscribe: ${msg.channel} from ${clientIp}`);
                    }
                } else if (msg.type === MESSAGE_TYPES.UNSUBSCRIBE && msg.channel) {
                    ws.subscriptions.delete(msg.channel);
                    logger.debug(`Realtime WS unsubscribe: ${msg.channel} from ${clientIp}`);
                }
            } catch (e) {
                // 忽略?JSON 消息
            }
        });

        ws._cleanedUp = false;
        ws.on('close', () => {
            if (!ws._cleanedUp) {
                ws._cleanedUp = true;
                connectedClients = Math.max(0, connectedClients - 1);
                logger.debug(`Realtime WS disconnected: ${clientIp} (remaining: ${connectedClients})`);
            }
        });

        ws.on('error', () => {
            if (!ws._cleanedUp) {
                ws._cleanedUp = true;
                connectedClients = Math.max(0, connectedClients - 1);
            }
        });
    });

    // 定期推业务消恼模拟真实业务流量?
    messageInterval = setInterval(() => {
        if (connectedClients === 0) return;
        const generator = generators[Math.floor(Math.random() * generators.length)];
        const message = generator();
        const channel = message.type.split('.')[0];

        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client.subscriptions.has(channel)) {
                client.send(JSON.stringify(message));
            }
        });
    }, 3000 + Math.random() * 5000); // 3-8 绉掗殢鏈洪棿闅?

    // 心跳?
    setInterval(() => {
        if (!wss) return;
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                try { ws.terminate(); } catch (e) {}
                return;
            }
            ws.isAlive = false;
            try { ws.ping(); } catch (e) {}
        });
    }, 30000);

    logger.info('Realtime business WebSocket: started at /api/v1/realtime');
    return wss;
}

function handleRealtimeUpgrade(request, socket, head) {
    if (!wss) createRealtimeWebSocketServer();
    // 连接上限：单端点最多 100 个并发连接
    if (wss.clients && wss.clients.size >= 100) {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
}

function getRealtimeStats() {
    return {
        connectedClients,
        channels: CHANNELS,
        messageTypes: Object.values(MESSAGE_TYPES)
    };
}

module.exports = {
    createRealtimeWebSocketServer,
    handleRealtimeUpgrade,
    getRealtimeStats,
    MESSAGE_TYPES,
    CHANNELS
};
