// ====================================================================
// 流量控制器（背压管理）
// 企业库存同步平台 - 数据流控与缓冲区水位管理
// 负责 WebSocket 缓冲区监控、暂停/恢复数据流、防止内存溢出
// ====================================================================

const logger = require('../logger');

/**
 * 背压配置常量
 */
const BackpressureConfig = {
    HIGH_WATER_MARK: 1024 * 1024,   // 高水位（1MB）
    LOW_WATER_MARK: 256 * 1024,     // 低水位（256KB）
    CHECK_INTERVAL_MS: 100,          // 检查间隔（100ms）
    MAX_BUFFERED_AMOUNT: 8 * 1024 * 1024 // 最大缓冲量（8MB），超过则强制断开
};

/**
 * 流控状态枚举
 */
const FlowState = {
    NORMAL: 'normal',           // 正常
    HIGH_PRESSURE: 'high',      // 高压力（超过高水位）
    CRITICAL: 'critical',       // 临界（超过最大缓冲）
    DRAINING: 'draining'        // 排水中（从高压力恢复）
};

/**
 * 背压控制器类
 * 监控 WebSocket 缓冲区大小，控制数据流
 */
class BackpressureController {
    constructor(ws, options = {}) {
        this.ws = ws;
        this.highWaterMark = options.highWaterMark || BackpressureConfig.HIGH_WATER_MARK;
        this.lowWaterMark = options.lowWaterMark || BackpressureConfig.LOW_WATER_MARK;
        this.maxBufferedAmount = options.maxBufferedAmount || BackpressureConfig.MAX_BUFFERED_AMOUNT;

        this.state = FlowState.NORMAL;
        this.isPaused = false;
        this.checkTimer = null;
        this.stats = {
            pauseCount: 0,
            resumeCount: 0,
            maxBufferedAmount: 0,
            totalPausedMs: 0,
            lastPauseAt: null
        };
    }

    /**
     * 启动监控
     */
    start() {
        if (this.checkTimer) return;
        this.checkTimer = setInterval(() => this._check(), BackpressureConfig.CHECK_INTERVAL_MS);
        if (this.checkTimer.unref) this.checkTimer.unref();
    }

    /**
     * 停止监控
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }
    }

    /**
     * 检查缓冲区状态
     */
    _check() {
        if (!this.ws || this.ws.readyState !== 1) {
            this.stop();
            return;
        }

        const buffered = this.ws.bufferedAmount || 0;
        this.stats.maxBufferedAmount = Math.max(this.stats.maxBufferedAmount, buffered);

        // 临界状态：超过最大缓冲，强制断开
        if (buffered > this.maxBufferedAmount) {
            logger.warn(`Flow critical: buffered=${(buffered/1024).toFixed(0)}KB, force disconnect`);
            this.state = FlowState.CRITICAL;
            this.ws.close();
            return;
        }

        // 高压力：暂停上游数据
        if (buffered > this.highWaterMark && !this.isPaused) {
            this._pause();
        }
        // 恢复：低于低水位
        else if (buffered < this.lowWaterMark && this.isPaused) {
            this._resume();
        }
    }

    /**
     * 暂停数据流
     */
    _pause() {
        this.isPaused = true;
        this.state = FlowState.HIGH_PRESSURE;
        this.stats.pauseCount++;
        this.stats.lastPauseAt = Date.now();
        logger.debug(`Flow paused: buffered=${(this.ws.bufferedAmount/1024).toFixed(0)}KB`);
    }

    /**
     * 恢复数据流
     */
    _resume() {
        this.isPaused = false;
        this.state = FlowState.DRAINING;
        this.stats.resumeCount++;
        if (this.stats.lastPauseAt) {
            this.stats.totalPausedMs += Date.now() - this.stats.lastPauseAt;
            this.stats.lastPauseAt = null;
        }
        logger.debug(`Flow resumed: buffered=${(this.ws.bufferedAmount/1024).toFixed(0)}KB`);

        // 触发恢复事件
        if (this.onResume) {
            this.onResume();
        }
    }

    /**
     * 检查是否可以发送数据
     * @returns {boolean} 是否可以发送
     */
    canSend() {
        return !this.isPaused && this.state !== FlowState.CRITICAL;
    }

    /**
     * 等待缓冲区排水（异步）
     * @returns {Promise<void>}
     */
    waitForDrain() {
        return new Promise((resolve) => {
            if (!this.isPaused) {
                resolve();
                return;
            }
            const originalOnResume = this.onResume;
            this.onResume = () => {
                if (originalOnResume) originalOnResume();
                resolve();
            };
        });
    }

    /**
     * 获取当前缓冲区大小
     */
    get bufferedAmount() {
        return this.ws ? (this.ws.bufferedAmount || 0) : 0;
    }

    /**
     * 获取缓冲区使用率（0-1）
     */
    get usageRatio() {
        return this.bufferedAmount / this.highWaterMark;
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            state: this.state,
            isPaused: this.isPaused,
            bufferedAmount: this.bufferedAmount,
            usageRatio: Math.round(this.usageRatio * 100) / 100,
            ...this.stats
        };
    }

    /**
     * 销毁控制器
     */
    destroy() {
        this.stop();
        this.ws = null;
    }
}

/**
 * 写入队列类
 * 实现带背压的有序写入
 */
class WriteQueue {
    constructor(ws, controller) {
        this.ws = ws;
        this.controller = controller;
        this.queue = [];
        this.isWriting = false;
        this.totalQueued = 0;
        this.totalDropped = 0;
    }

    /**
     * 入队数据
     * @returns {boolean} 是否成功入队
     */
    enqueue(data) {
        // 背压检查
        if (!this.controller.canSend()) {
            this.totalDropped++;
            return false;
        }

        this.queue.push(data);
        this.totalQueued++;
        this._process();
        return true;
    }

    /**
     * 处理队列
     */
    async _process() {
        if (this.isWriting || this.queue.length === 0) return;
        this.isWriting = true;

        while (this.queue.length > 0) {
            if (!this.controller.canSend()) {
                await this.controller.waitForDrain();
            }
            const data = this.queue.shift();
            if (this.ws && this.ws.readyState === 1) {
                this.ws.send(data);
            }
        }

        this.isWriting = false;
    }

    /**
     * 获取队列长度
     */
    get length() {
        return this.queue.length;
    }

    /**
     * 清空队列
     */
    clear() {
        this.queue = [];
    }

    /**
     * 获取统计
     */
    getStats() {
        return {
            queued: this.totalQueued,
            dropped: this.totalDropped,
            pending: this.queue.length,
            isWriting: this.isWriting
        };
    }
}

module.exports = {
    BackpressureConfig,
    FlowState,
    BackpressureController,
    WriteQueue
};
