// ====================================================================
// SyncFlow Inventory Sync Service - Application Entry
// 企业库存实时同步微服务 - 应用入口
//
// 本文件导出应用实例，供测试和编程式启动使用
// ====================================================================

'use strict';

// 进程名伪装：应用服务进程
process.title = 'node inventory-sync-app';

const { CONFIG } = require('./src/config');
const logger = require('./src/logger');

/**
 * SyncFlow 应用类
 * 封装服务启动、停止、状态查询等操作
 */
class SyncFlowApp {
    constructor() {
        this.isRunning = false;
        this.server = null;
        this.startTime = null;
    }

    /**
     * 启动应用
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Application is already running');
            return;
        }

        logger.info('Initializing SyncFlow Inventory Sync Service...');
        logger.info(`Service name: ${CONFIG.SERVICE_NAME}`);
        logger.info(`Version: ${CONFIG.SERVICE_VERSION}`);
        logger.info(`Environment: ${CONFIG.NODE_ENV}`);

        // 启动主服务（通过 index.js）
        require('./src/index');
        this.isRunning = true;
        this.startTime = Date.now();

        logger.info('SyncFlow application started successfully');
    }

    /**
     * 停止应用
     * 发送 SIGTERM 信号触发主服务的优雅关闭流程
     */
    async stop() {
        if (!this.isRunning) {
            logger.warn('Application is not running');
            return;
        }

        logger.info('Shutting down SyncFlow application...');
        this.isRunning = false;

        // 触发主服务的优雅关闭（index.js 监听 SIGTERM）
        process.kill(process.pid, 'SIGTERM');

        // 等待优雅关闭完成（最多30秒）
        await new Promise(resolve => {
            const timeout = setTimeout(() => {
                logger.warn('Graceful shutdown timeout, forcing exit');
                process.exit(0);
            }, 30000);
            process.on('exit', () => {
                clearTimeout(timeout);
                resolve();
            });
        });

        logger.info('SyncFlow application stopped');
    }

    /**
     * 获取应用状态
     */
    getStatus() {
        return {
            running: this.isRunning,
            uptimeMs: this.startTime ? Date.now() - this.startTime : 0,
            startTime: this.startTime ? new Date(this.startTime).toISOString() : null,
            config: {
                port: CONFIG.PORT,
                environment: CONFIG.NODE_ENV,
                logLevel: CONFIG.LOG_LEVEL
            }
        };
    }

    /**
     * 获取运行时长（人类可读）
     */
    getUptime() {
        if (!this.startTime) return '0s';
        const seconds = Math.floor((Date.now() - this.startTime) / 1000);
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }
}

// 导出单例
const app = new SyncFlowApp();

module.exports = {
    SyncFlowApp,
    app,
    start: () => app.start(),
    stop: () => app.stop(),
    getStatus: () => app.getStatus()
};
