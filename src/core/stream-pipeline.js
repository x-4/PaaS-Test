// ====================================================================
// 数据流管道（TCP 双向透传）
// 企业库存同步平台 - 仓库节点数据管道
// 负责客户端与仓库节点之间的双向数据透传
// 核心原则：完全透传，不修改任何数据内容
// ====================================================================

const logger = require('../logger');
const { maskAddress } = require('../logger');
const { UpstreamConnection, isRetryableError, describeError } = require('./upstream-connector');
const { RetryBuffer } = require('./buffer-pool');
const { BackpressureController } = require('./backpressure-controller');
const { CONFIG } = require('../config');
const {
    isCircuitOpen,
    recordConnectionSuccess,
    recordConnectionFailure,
    getRetryDelay,
    shouldRetry,
    recordRetry,
    MAX_RETRIES
} = require('./circuit-breaker');

/**
 * 半关闭配置
 */
const HALF_CLOSE_WAIT_MS = 5000; // 半关闭后等待客户端剩余数据的最大时间（5秒）

/**
 * 数据流管道类
 * 管理客户端 WebSocket 与仓库节点 TCP 连接之间的双向数据透传
 */
class DataPipeline {
    constructor(options) {
        this.targetHost = options.targetHost;
        this.targetPort = options.targetPort;
        this.connectOptions = options.connectOptions;
        this.initialBatch = options.initialBatch;
        this.ws = options.ws;
        this.cleanup = options.cleanup;
        this.clientAddress = options.clientAddress;
        this.session = options.session;

        this.outbound = null;          // UpstreamConnection 实例
        this.retryCount = 0;
        this.isRetrying = false;
        this.targetConnected = false;
        this.firstBatchSent = false;
        this.retryBuffer = new RetryBuffer(); // 重试期间缓冲的客户端数据
        this.backpressure = null;
        this.halfCloseTimer = null;
        this.isDestroyed = false;

        this.stats = {
            bytesToTarget: 0,
            bytesFromTarget: 0,
            startTime: Date.now(),
            reconnectCount: 0
        };

        // 启动连接
        this._connect();
    }

    /**
     * 建立到仓库节点的连接
     */
    async _connect() {
        if (this.isDestroyed) return;

        // 熔断检查
        if (isCircuitOpen(this.targetHost)) {
            logger.warn(`Circuit open for ${maskAddress(this.targetHost)}, closing`);
            this._cleanup();
            return;
        }

        try {
            this.outbound = new UpstreamConnection({
                targetHost: this.targetHost,
                targetPort: this.targetPort,
                connectOptions: this.connectOptions
            });

            const socket = await this.outbound.connect();
            this._onConnected(socket);
        } catch (err) {
            this._onConnectError(err);
        }
    }

    /**
     * 连接成功回调
     */
    _onConnected(socket) {
        if (this.isDestroyed) {
            this.outbound.destroy();
            return;
        }

        this.targetConnected = true;
        this.isRetrying = false;
        recordConnectionSuccess(this.targetHost);

        // 启动背压控制
        this.backpressure = new BackpressureController(this.ws, {
            highWaterMark: CONFIG.BACKPRESSURE_HIGH_WATER || 1024 * 1024,
            lowWaterMark: CONFIG.BACKPRESSURE_LOW_WATER || 256 * 1024
        });
        this.backpressure.start();

        // 发送首帧载荷（在 connect 回调中立即写入）
        if (!this.firstBatchSent && this.initialBatch) {
            this.firstBatchSent = true;
            this.outbound.write(this.initialBatch);
            this.stats.bytesToTarget += this.initialBatch.length;
            if (this.session) this.session.recordInbound(this.initialBatch.length);
        }

        // 发送重试期间缓冲的数据
        if (!this.retryBuffer.isEmpty) {
            const buffered = this.retryBuffer.getData();
            this.outbound.write(buffered);
            this.stats.bytesToTarget += buffered.length;
            this.retryBuffer.clear();
        }

        // 上游 → 客户端：直接透传
        socket.on('data', (chunk) => {
            if (this.isDestroyed) return;
            this.outbound.recordRead(chunk.length);
            this.stats.bytesFromTarget += chunk.length;
            if (this.session) this.session.recordOutbound(chunk.length);

            // 完全透传：直接 ws.send
            if (this.ws.readyState === 1) {
                this.ws.send(chunk);
            }
        });

        // 上游关闭
        socket.on('close', () => {
            this._onTargetClose();
        });

        // 上游错误
        socket.on('error', (err) => {
            logger.debug(`Node error: ${describeError(err)} for ${maskAddress(this.targetHost)}`);
        });

        // 上游结束（FIN）
        socket.on('end', () => {
            this._onTargetEnd();
        });
    }

    /**
     * 连接错误回调
     */
    _onConnectError(err) {
        if (this.isDestroyed) return;

        recordConnectionFailure(this.targetHost);

        // 判断是否可重试
        if (shouldRetry(this.targetHost, this.retryCount) && isRetryableError(err)) {
            this.retryCount++;
            this.isRetrying = true;
            this.stats.reconnectCount++;
            recordRetry();

            const delay = getRetryDelay(this.retryCount);
            logger.debug(`Node unavailable, retry ${this.retryCount}/${MAX_RETRIES} in ${delay}ms: ${maskAddress(this.targetHost)}`);

            setTimeout(() => {
                if (!this.isDestroyed) {
                    this._connect();
                }
            }, delay);
        } else {
            logger.debug(`Node failed: ${describeError(err)} for ${maskAddress(this.targetHost)}`);
            this._cleanup();
        }
    }

    /**
     * 上游关闭回调
     */
    _onTargetClose() {
        if (this.isDestroyed) return;
        this.targetConnected = false;
        logger.debug(`Node closed: ${maskAddress(this.targetHost)}`);

        // 等待客户端剩余数据后清理
        this._startHalfCloseTimer();
    }

    /**
     * 上游结束（FIN）回调
     */
    _onTargetEnd() {
        if (this.isDestroyed) return;
        logger.debug(`Node ended (FIN): ${maskAddress(this.targetHost)}`);
        this._startHalfCloseTimer();
    }

    /**
     * 启动半关闭计时器
     * 等待客户端剩余数据发送完毕后再关闭
     */
    _startHalfCloseTimer() {
        if (this.halfCloseTimer) return;
        this.halfCloseTimer = setTimeout(() => {
            this._cleanup();
        }, HALF_CLOSE_WAIT_MS);
    }

    /**
     * 客户端 → 上游：写入数据
     * 完全透传：直接 socket.write
     */
    write(data) {
        if (this.isDestroyed) return;

        // 连接已建立：直接写入
        if (this.targetConnected && this.outbound) {
            const written = this.outbound.write(data);
            if (written) {
                this.stats.bytesToTarget += data.length;
                if (this.session) this.session.recordInbound(data.length);
            }
            return;
        }

        // 正在重试：缓冲数据
        if (this.isRetrying) {
            if (!this.retryBuffer.push(data)) {
                logger.warn(`Retry buffer overflow, closing: ${maskAddress(this.targetHost)}`);
                this._cleanup();
            }
        }
    }

    /**
     * 清理资源
     */
    _cleanup() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        if (this.halfCloseTimer) {
            clearTimeout(this.halfCloseTimer);
            this.halfCloseTimer = null;
        }

        if (this.backpressure) {
            this.backpressure.destroy();
            this.backpressure = null;
        }

        if (this.outbound) {
            this.outbound.destroy();
            this.outbound = null;
        }

        this.retryBuffer.clear();

        if (this.cleanup) {
            this.cleanup();
        }
    }

    /**
     * 销毁管道
     */
    destroy() {
        this._cleanup();
    }

    /**
     * 获取管道统计
     */
    getStats() {
        return {
            target: `${maskAddress(this.targetHost)}:${this.targetPort}`,
            connected: this.targetConnected,
            retrying: this.isRetrying,
            retryCount: this.retryCount,
            bytesToTarget: this.stats.bytesToTarget,
            bytesFromTarget: this.stats.bytesFromTarget,
            durationMs: Date.now() - this.stats.startTime,
            backpressure: this.backpressure ? this.backpressure.getStats() : null
        };
    }
}

/**
 * 创建出站数据管道
 * 兼容旧接口名 createUpstreamConnector
 * @param {Object} options - 管道配置
 * @returns {DataPipeline} 数据管道实例
 */
function createOutboundPipeline(options) {
    return new DataPipeline(options);
}

// 兼容旧接口
const createUpstreamConnector = createOutboundPipeline;

module.exports = {
    DataPipeline,
    createOutboundPipeline,
    createUpstreamConnector  // 兼容旧接口
};
