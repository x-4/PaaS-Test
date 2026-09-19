/**
 * 会话编排器（Session Orchestrator）
 * 模拟真实用户的完整会话序列：HTTP浏览→WS连接→HTTP交互→WS断开
 * 让每个WS连接都有完整的业务上下文，避免"只有WS没有HTTP"的异常特征
 */

const http = require('http');
const trafficController = require('../system/simulator-traffic-controller');
const crypto = require('crypto');
const logger = require('../logger');
const temporalEngine = require('./temporal-engine');

// 用户会话状态
class UserSession {
    constructor(id, port, host) {
        this.id = id;
        this.port = port;
        this.host = host;
        this.stage = 'idle'; // idle -> browsing -> connecting -> active -> disconnecting -> ended
        this.pageHistory = [];
        this.wsConnected = false;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.userAgent = this.pickUserAgent();
        this.sessionCookie = 'syncflow_session=' + this.randomHex(32);
    }

    pickUserAgent() {
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        ];
        return agents[Math.floor(Math.random() * agents.length)];
    }

    randomHex(length) {
        // 使用CSPRNG生成安全的随机十六进制字符串
        return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').substring(0, length);
    }

    // 发送HTTP请求
    async sendRequest(path, method = 'GET', referer = null) {
        // 配额用尽时跳过
        if (trafficController.isPaused()) return { status: 0, data: '' };
        return new Promise((resolve) => {
            const options = {
                hostname: this.host,
                port: this.port,
                path: path,
                method: method,
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Cookie': this.sessionCookie,
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                }
            };
            if (referer) {
                options.headers['Referer'] = referer;
            }

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; trafficController.recordBytes(chunk.length); });
                res.on('end', () => {
                    this.pageHistory.push({ path, method, status: res.statusCode, time: Date.now() });
                    this.lastActivity = Date.now();
                    resolve({ status: res.statusCode, data });
                });
            });
            req.on('error', () => resolve({ status: 0, data: '' }));
            req.setTimeout(5000, () => { req.destroy(); resolve({ status: 0, data: '' }); });
            req.end();
        });
    }

    // 模拟浏览阶段（访问几个页面）
    async browse() {
        this.stage = 'browsing';

        // 访问首页
        await this.sendRequest('/', 'GET');
        await this.delay(1000 + Math.random() * 2000);

        // 访问库存页
        await this.sendRequest('/inventory', 'GET', `http://${this.host}:${this.port}/`);
        await this.delay(1000 + Math.random() * 2000);

        // 可能访问仓库页
        if (Math.random() > 0.5) {
            await this.sendRequest('/warehouses', 'GET', `http://${this.host}:${this.port}/inventory`);
            await this.delay(1000 + Math.random() * 1500);
        }

        // 访问同步页（这是即将发起WS连接的页面）
        await this.sendRequest('/sync', 'GET', `http://${this.host}:${this.port}/inventory`);
        await this.delay(500 + Math.random() * 1000);

        // 调用"开始同步"API（模拟用户点击按钮）
        await this.sendRequest('/api/v1/sync/jobs', 'POST', `http://${this.host}:${this.port}/sync`);
        await this.delay(300 + Math.random() * 500);
    }

    // 模拟WS连接阶段（由实际的WS连接完成，这里只记录状态）
    onWsConnected() {
        this.stage = 'active';
        this.wsConnected = true;
        this.lastActivity = Date.now();
    }

    // 模拟活跃阶段（WS连接期间的HTTP交互）- 修复定时器竞态：先排期再执行
    async activePhase() {
        if (!this.wsConnected) return;

        // 定期查询同步状态（先排期定时器，再执行请求，避免disconnect竞态）
        const scheduleStatusCheck = () => {
            if (!this.wsConnected || this.stage !== 'active') return;
            this.statusTimer = setTimeout(async () => {
                if (!this.wsConnected || this.stage !== 'active') return;
                await this.sendRequest('/api/v1/sync/jobs', 'GET', `http://${this.host}:${this.port}/sync`);
                scheduleStatusCheck();
            }, 15000 + Math.random() * 15000);
        };
        // 立即执行一次，然后排期后续
        (async () => {
            if (this.wsConnected && this.stage === 'active') {
                await this.sendRequest('/api/v1/sync/jobs', 'GET', `http://${this.host}:${this.port}/sync`);
            }
            scheduleStatusCheck();
        })();

        // 偶尔查询库存统计（同样先排期）
        const scheduleStatsCheck = () => {
            if (!this.wsConnected || this.stage !== 'active') return;
            this.statsTimer = setTimeout(async () => {
                if (!this.wsConnected || this.stage !== 'active') return;
                if (Math.random() > 0.3) {
                    await this.sendRequest('/api/v1/inventory', 'GET', `http://${this.host}:${this.port}/inventory`);
                }
                scheduleStatsCheck();
            }, 30000 + Math.random() * 30000);
        };
        scheduleStatsCheck();
    }

    // 模拟断开阶段
    async disconnect() {
        if (this.stage === 'ended') return;
        this.stage = 'disconnecting';

        // 调用"停止同步"API（模拟用户点击停止按钮）
        await this.sendRequest('/api/v1/sync/jobs', 'DELETE', `http://${this.host}:${this.port}/sync`);
        await this.delay(200 + Math.random() * 300);

        // 访问其他页面（模拟用户离开同步页）
        await this.sendRequest('/', 'GET', `http://${this.host}:${this.port}/sync`);

        this.wsConnected = false;
        this.stage = 'ended';

        // 清理定时器
        if (this.statusTimer) clearTimeout(this.statusTimer);
        if (this.statsTimer) clearTimeout(this.statsTimer);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    destroy() {
        this.wsConnected = false;
        this.stage = 'ended';
        if (this.statusTimer) clearTimeout(this.statusTimer);
        if (this.statsTimer) clearTimeout(this.statsTimer);
    }
}

// 会话编排器
class SessionOrchestrator {
    constructor(port, host = 'localhost') {
        this.port = port;
        this.host = host;
        this.sessions = new Map();
        this.started = false;
    }

    start() {
        if (this.started) return;
        this.started = true;
        logger.info('Session orchestrator started (HTTP session context simulation)');
    }

    stop() {
        if (!this.started) return;
        this.started = false;
        for (const session of this.sessions.values()) {
            session.destroy();
        }
        this.sessions.clear();
        logger.info('Session orchestrator stopped');
    }

    // 创建新会话（在WS连接之前调用，模拟用户浏览）
    async createSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            return this.sessions.get(sessionId);
        }

        const session = new UserSession(sessionId, this.port, this.host);
        this.sessions.set(sessionId, session);

        // 根据时间活跃度决定是否模拟完整浏览序列
        const activity = temporalEngine.getBusinessActivity();
        if (activity.value > 0.3 && Math.random() > 0.3) {
            // 高活跃度时，70%的会话有完整浏览序列
            await session.browse();
        } else {
            // 低活跃度时，只访问同步页
            await session.sendRequest('/sync', 'GET');
            await session.delay(300 + Math.random() * 500);
        }

        return session;
    }

    // 标记WS连接已建立
    markWsConnected(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.onWsConnected();
            session.activePhase();
        }
    }

    // 标记WS连接已断开
    async markWsDisconnected(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            await session.disconnect();
            // 保留一段时间后删除
            setTimeout(() => {
                this.sessions.delete(sessionId);
            }, 5000);
        }
    }

    // 获取会话统计
    getStats() {
        let browsing = 0, active = 0, disconnecting = 0;
        for (const session of this.sessions.values()) {
            if (session.stage === 'browsing') browsing++;
            else if (session.stage === 'active') active++;
            else if (session.stage === 'disconnecting') disconnecting++;
        }
        return {
            total: this.sessions.size,
            browsing,
            active,
            disconnecting
        };
    }
}

module.exports = { SessionOrchestrator, UserSession };
