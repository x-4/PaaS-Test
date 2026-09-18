#!/usr/bin/env node
// ====================================================================
// 后台任务工作进程
// 企业库存同步平台 - 异步任务执行器
// 负责数据同步、库存盘点、报表生成等后台任务
// ====================================================================

'use strict';

// 进程名伪装：工作进程
process.title = 'node inventory-sync-worker';

// 环境变量加载（可选，.env 文件不存在时静默跳过）
try { require('dotenv').config(); } catch (e) { /* dotenv 未安装或无 .env 文件，使用环境变量 */ }

const { CONFIG } = require('./src/config');
const logger = require('./src/logger');

// ====================================================================
// 工作进程状态管理
// ====================================================================

const WorkerState = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    STOPPING: 'stopping'
};

class SyncWorker {
    constructor(role = 'data-sync') {
        this.role = role;
        this.state = WorkerState.IDLE;
        this.startTime = Date.now();
        this.processedJobs = 0;
        this.failedJobs = 0;
        this.lastJobTime = null;
        this._heartbeatTimer = null;
        this._jobTimer = null;
    }

    /**
     * 启动工作进程
     */
    async start() {
        logger.info(`[Worker] ${this.role} worker starting...`);
        this.state = WorkerState.RUNNING;

        // 模拟工作进程初始化
        await this._initialize();

        // 启动心跳上报
        this._startHeartbeat();

        // 启动任务处理循环
        this._startJobLoop();

        logger.info(`[Worker] ${this.role} worker started successfully`);
    }

    /**
     * 初始化工作进程
     */
    async _initialize() {
        // 模拟连接数据库、初始化缓存等
        logger.debug(`[Worker] Initializing ${this.role} context...`);
        await new Promise(resolve => setTimeout(resolve, 100));
        logger.debug(`[Worker] ${this.role} context initialized`);
    }

    /**
     * 启动心跳上报
     */
    _startHeartbeat() {
        const interval = 30 + Math.floor(Math.random() * 15); // 30-45秒
        this._heartbeatTimer = setInterval(() => {
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            logger.debug(`[Worker] Heartbeat: role=${this.role}, uptime=${uptime}s, jobs=${this.processedJobs}`);
        }, interval * 1000);
    }

    /**
     * 启动任务处理循环
     */
    _startJobLoop() {
        const processJob = () => {
            if (this.state !== WorkerState.RUNNING) return;

            // 模拟处理任务
            this._processMockJob();

            // 随机间隔：5-20秒
            const nextDelay = 5000 + Math.random() * 15000;
            this._jobTimer = setTimeout(processJob, nextDelay);
        };

        // 首次延迟启动
        setTimeout(processJob, 2000 + Math.random() * 3000);
    }

    /**
     * 模拟处理一个任务
     */
    async _processMockJob() {
        this.lastJobTime = Date.now();
        const jobType = this._getRandomJobType();

        logger.debug(`[Worker] Processing job: ${jobType}`);

        try {
            // 模拟任务处理时间
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));
            this.processedJobs++;
            logger.debug(`[Worker] Job completed: ${jobType}`);
        } catch (err) {
            this.failedJobs++;
            logger.warn(`[Worker] Job failed: ${jobType} - ${err.message}`);
        }
    }

    /**
     * 获取随机任务类型
     */
    _getRandomJobType() {
        const jobTypes = [
            'inventory-sync',
            'order-sync',
            'warehouse-audit',
            'report-generation',
            'data-cleanup',
            'cache-warming',
            'backup-verification'
        ];
        return jobTypes[Math.floor(Math.random() * jobTypes.length)];
    }

    /**
     * 暂停工作进程
     */
    pause() {
        this.state = WorkerState.PAUSED;
        logger.info(`[Worker] ${this.role} paused`);
    }

    /**
     * 恢复工作进程
     */
    resume() {
        this.state = WorkerState.RUNNING;
        logger.info(`[Worker] ${this.role} resumed`);
    }

    /**
     * 停止工作进程
     */
    async stop() {
        this.state = WorkerState.STOPPING;
        logger.info(`[Worker] ${this.role} stopping...`);

        if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
        if (this._jobTimer) clearTimeout(this._jobTimer);

        // 模拟优雅关闭
        await new Promise(resolve => setTimeout(resolve, 500));
        logger.info(`[Worker] ${this.role} stopped gracefully`);
        process.exit(0);
    }

    /**
     * 获取工作进程状态
     */
    getStats() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        return {
            role: this.role,
            state: this.state,
            uptime,
            processedJobs: this.processedJobs,
            failedJobs: this.failedJobs,
            lastJobTime: this.lastJobTime ? new Date(this.lastJobTime).toISOString() : null
        };
    }
}

// ====================================================================
// 工作进程启动入口
// ====================================================================

const worker = new SyncWorker(process.env.WORKER_ROLE || 'data-sync');

// 信号处理
process.on('SIGTERM', () => worker.stop());
process.on('SIGINT', () => worker.stop());

// 异常处理（和主服务一致，不崩溃）
process.on('uncaughtException', (err) => {
    logger.error(`[Worker] Uncaught exception: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
    logger.error(`[Worker] Unhandled rejection: ${reason}`);
});

// 启动工作进程
worker.start().catch(err => {
    logger.error(`[Worker] Failed to start: ${err.message}`);
    process.exit(1);
});

// 导出供测试
module.exports = { SyncWorker, WorkerState };
