/**
 * 真实用户行为轨迹模拟器
 * 模拟多个虚拟用户的完整操作轨迹，让 HTTP 请求流量特征更接近真实用户访问
 * 不影响实时同步核心，完全是业务层的 HTTP 请求行为模拟
 */

const http = require('http');
const trafficController = require('../system/simulator-traffic-controller');
const logger = require('../logger');

// 用户画像库
const USER_PROFILES = [
    { role: 'admin', name: 'Alice Chen', preference: ['settings', 'dashboard', 'sync'], frequency: 0.15 },
    { role: 'manager', name: 'Bob Wang', preference: ['dashboard', 'inventory', 'warehouses'], frequency: 0.25 },
    { role: 'operator', name: 'Carol Li', preference: ['inventory', 'sync', 'warehouses'], frequency: 0.35 },
    { role: 'viewer', name: 'David Zhang', preference: ['dashboard', 'inventory', 'about'], frequency: 0.25 }
];

// User-Agent 库（桌面:移动 = 7:3）
const USER_AGENTS = [
    // 桌面 Chrome
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // 桌面 Safari
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    // 桌面 Firefox
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    // 桌面 Edge
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    // 移动 Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    // 移动 Chrome
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
];

// 搜索关键词库（真实产品词）
const SEARCH_KEYWORDS = [
    '无线耳机', 'USB-C 数据线', '机械键盘', '显示器支架', '笔记本电脑',
    '无线鼠标', '移动电源', '蓝牙音箱', '智能手表', '平板电脑',
    '充电器', '保护壳', '屏幕保护膜', '扩展坞', '固态硬盘',
    '内存条', '显卡', '主板', 'CPU散热器', '机箱风扇',
    'headphones', 'keyboard', 'mouse', 'monitor', 'laptop',
    'charger', 'cable', 'adapter', 'stand', 'hub'
];

// 页面路径与权重（访问漏斗）
const PAGE_PATHS = [
    { path: '/', weight: 35, name: 'home' },
    { path: '/dashboard', weight: 20, name: 'dashboard' },
    { path: '/inventory', weight: 18, name: 'inventory' },
    { path: '/warehouses', weight: 10, name: 'warehouses' },
    { path: '/sync', weight: 8, name: 'sync' },
    { path: '/login', weight: 5, name: 'login' },
    { path: '/settings', weight: 2, name: 'settings' },
    { path: '/about', weight: 2, name: 'about' }
];

// API 路径与权重
const API_PATHS = [
    { path: '/api/v1/inventory', method: 'GET', weight: 40 },
    { path: '/api/v1/warehouses', method: 'GET', weight: 20 },
    { path: '/api/v1/sync/jobs', method: 'GET', weight: 15 },
    { path: '/api/v1/inventory', method: 'POST', weight: 8 },
    { path: '/api/v1/sync/jobs', method: 'POST', weight: 7 },
    { path: '/api/v1/warehouses', method: 'POST', weight: 5 },
    { path: '/api/v1/metrics', method: 'GET', weight: 5 }
];

// 虚拟用户类
class VirtualUser {
    constructor(id, profile) {
        this.id = id;
        this.profile = profile;
        this.userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        this.sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
        this.currentPage = null;
        this.pageHistory = [];
        this.actionCount = 0;
        this.maxActions = Math.floor(Math.random() * 15) + 5; // 每个会话 5-20 个操作
        this.isActive = false;
    }

    // 根据用户偏好选择页面
    selectPage() {
        // 70% 概率选择偏好页面，30% 随机
        if (Math.random() < 0.7 && this.profile.preference.length > 0) {
            const pref = this.profile.preference[Math.floor(Math.random() * this.profile.preference.length)];
            const match = PAGE_PATHS.find(p => p.name === pref);
            if (match) return match;
        }
        // 按权重随机选择
        const totalWeight = PAGE_PATHS.reduce((sum, p) => sum + p.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const p of PAGE_PATHS) {
            rand -= p.weight;
            if (rand <= 0) return p;
        }
        return PAGE_PATHS[0];
    }

    // 选择 API 操作
    selectApiAction() {
        const totalWeight = API_PATHS.reduce((sum, a) => sum + a.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const a of API_PATHS) {
            rand -= a.weight;
            if (rand <= 0) return a;
        }
        return API_PATHS[0];
    }

    // 生成操作间隔（人类节奏）
    getActionInterval() {
        // 浏览页面 2-8 秒，阅读详情 5-20 秒，操作 3-10 秒
        const base = 2000 + Math.random() * 6000;
        if (this.currentPage && (this.currentPage.name === 'inventory' || this.currentPage.name === 'sync')) {
            return base + 3000 + Math.random() * 10000; // 详情页停留更久
        }
        return base;
    }

    // 生成 Referer
    getReferer(host) {
        if (this.pageHistory.length > 0) {
            return 'http://' + host + this.pageHistory[this.pageHistory.length - 1];
        }
        return null; // 直接访问，无 Referer
    }
}

// 用户行为模拟器
class UserBehaviorSimulator {
    constructor(port, host = 'localhost') {
        this.port = port;
        this.host = host;
        this.users = [];
        this.activeUsers = 0;
        this.started = false;
        this.timer = null;
        this.requestCount = 0;
        this.errorCount = 0;
    }

    // 创建新用户
    createUser() {
        const profile = USER_PROFILES[Math.floor(Math.random() * USER_PROFILES.length)];
        const user = new VirtualUser('user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6), profile);
        this.users.push(user);
            // 限制用户数组上限，防止无界增长
            if (this.users.length > 200) {
                this.users = this.users.slice(-200);
            }
        return user;
    }

    // 发送 HTTP 请求
    sendRequest(user, path, method = 'GET', body = null) {
        return new Promise((resolve) => {
            const options = {
                hostname: this.host,
                port: this.port,
                path: path,
                method: method,
                headers: {
                    'User-Agent': user.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Cookie': 'syncflow_session=' + user.sessionId
                }
            };

            // 添加 Referer
            const referer = user.getReferer(this.host + ':' + this.port);
            if (referer) options.headers['Referer'] = referer;

            // POST 请求添加 Content-Type
            if (method === 'POST' && body) {
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Length'] = Buffer.byteLength(body);
            }

            const req = http.request(options, (res) => {
                // 消费响应体
                res.on('data', (chunk) => { trafficController.recordBytes(chunk.length); });
                res.on('end', () => {
                    this.requestCount++;
                    resolve({ status: res.statusCode, success: res.statusCode < 400 });
                });
            });

            req.on('error', (e) => {
                this.errorCount++;
                resolve({ status: 0, success: false, error: e.message });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                this.errorCount++;
                resolve({ status: 0, success: false, error: 'timeout' });
            });

            if (body) { trafficController.recordBytes(Buffer.byteLength(body)); req.write(body); }
            req.end();
        });
    }

    // 执行用户的一个操作
    async performUserAction(user) {
        if (!user.isActive) return;
        // 配额用尽时跳过
        if (trafficController.isPaused()) return;

        user.actionCount++;

        // 80% 概率浏览页面，20% 概率调用 API
        if (Math.random() < 0.8) {
            const page = user.selectPage();
            user.pageHistory.push(page.path);
            if (user.pageHistory.length > 5) user.pageHistory.shift();
            user.currentPage = page;

            await this.sendRequest(user, page.path, 'GET');
            logger.debug(`User ${user.id} (${user.profile.role}) viewed ${page.name}`);
        } else {
            const action = user.selectApiAction();
            let body = null;

            if (action.method === 'POST') {
                // 生成随机的 POST 数据
                if (action.path.includes('inventory')) {
                    body = JSON.stringify({
                        name: SEARCH_KEYWORDS[Math.floor(Math.random() * SEARCH_KEYWORDS.length)],
                        category: ['Electronics', 'Apparel', 'Home & Garden'][Math.floor(Math.random() * 3)],
                        quantity: Math.floor(Math.random() * 1000) + 10,
                        unitPrice: (Math.random() * 500 + 10).toFixed(2)
                    });
                } else if (action.path.includes('sync')) {
                    body = JSON.stringify({
                        type: ['full_inventory', 'delta_update', 'price_sync'][Math.floor(Math.random() * 3)],
                        priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
                        itemsCount: Math.floor(Math.random() * 200) + 10
                    });
                } else {
                    body = JSON.stringify({
                        name: 'Warehouse ' + Math.floor(Math.random() * 100),
                        region: ['US', 'EU', 'AP'][Math.floor(Math.random() * 3)],
                        capacity: Math.floor(Math.random() * 50000) + 10000
                    });
                }
            }

            await this.sendRequest(user, action.path, action.method, body);
            logger.debug(`User ${user.id} (${user.profile.role}) ${action.method} ${action.path}`);
        }

        // 检查是否结束会话
        if (user.actionCount >= user.maxActions || Math.random() < 0.05) {
            user.isActive = false;
            this.activeUsers--;
            logger.debug(`User ${user.id} session ended (${user.actionCount} actions)`);
            return;
        }

        // 安排下一个操作（乘以流量控制器降频系数）
        const baseInterval = user.getActionInterval();
        const throttleFactor = trafficController.getThrottleFactor();
        const interval = baseInterval / Math.max(0.1, throttleFactor);
        setTimeout(() => this.performUserAction(user), interval);
    }

    // 启动模拟器
    start() {
        if (this.started) return;
        this.started = true;

        logger.info('User behavior simulator started (multi-user, realistic patterns)');

        // 初始创建 2-3 个用户
        const initialCount = Math.floor(Math.random() * 2) + 2;
        for (let i = 0; i < initialCount; i++) {
            setTimeout(() => {
                const user = this.createUser();
                user.isActive = true;
                this.activeUsers++;
                this.performUserAction(user);
            }, i * 3000);
        }

        // 定期创建新用户（模拟新访客）
        this.timer = setInterval(() => {
            if (!this.started) return;
            // 保持 2-5 个活跃用户
            if (this.activeUsers < 5 && Math.random() < 0.6) {
                const user = this.createUser();
                user.isActive = true;
                this.activeUsers++;
                logger.debug(`New user ${user.id} (${user.profile.role}) started session`);
                this.performUserAction(user);
            }
        }, 15000 + Math.random() * 15000);

        if (this.timer.unref) this.timer.unref();
    }

    // 停止模拟器
    stop() {
        this.started = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // 结束所有用户会话
        this.users.forEach(u => u.isActive = false);
        this.activeUsers = 0;
        logger.info('User behavior simulator stopped');
    }

    // 获取统计
    getStats() {
        return {
            totalUsers: this.users.length,
            activeUsers: this.activeUsers,
            totalRequests: this.requestCount,
            totalErrors: this.errorCount,
            errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) + '%' : '0%',
            running: this.started
        };
    }
}

module.exports = UserBehaviorSimulator;
