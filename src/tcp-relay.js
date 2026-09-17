// ====================================================================
// 仓库节点数据中继（TCP）
// 负责上游 TCP 连接建立、双向数据透传、智能重试、连接健康管理
// ====================================================================

const net = require('net');
const logger = require('./logger');
const { maskAddress } = require('./logger');
const {
    isCircuitOpen,
    recordConnectionSuccess,
    recordConnectionFailure,
    getRetryDelay,
    shouldRetry,
    recordRetry,
    MAX_RETRIES
} = require('./circuit');

// ---- 连接配置常量 ----
const CONNECT_TIMEOUT_MS = 10000;      // 连接建立超时（10秒）
const KEEPALIVE_INITIAL_DELAY = 30000; // Keepalive 初始探针延迟（30秒）
const IDLE_TIMEOUT_MS = 300000;         // 空闲超时（5分钟）

// ---- 背压配置常量 ----
const BACKPRESSURE_HIGH_WATER_MARK = 1024 * 1024; // WebSocket 缓冲区高水位（1MB）
const BACKPRESSURE_LOW_WATER_MARK = 256 * 1024;    // WebSocket 缓冲区低水位（256KB）
const BACKPRESSURE_CHECK_INTERVAL = 100;             // 背压检查间隔（100ms）

// ---- 首字节超时配置 ----
const FIRST_BYTE_TIMEOUT_MS = 10000; // 首字节超时（10秒），连接建立后多久没收到数据则断开

// ---- 半关闭配置 ----
const HALF_CLOSE_WAIT_MS = 5000; // 半关闭后等待客户端剩余数据的最大时间（5秒）

// ---- 重试缓冲配置 ----
const RETRY_BUFFER_MAX_BYTES = 1024 * 1024; // 重试期间客户端数据缓冲上限（1MB），超过则断开

// 调试用：十六进制转储前 N 字节
function hexDump(buf, n = 16) {
    const len = Math.min(n, buf.length);
    return buf.subarray(0, len).toString('hex') + (buf.length > len ? `...(+${buf.length - len}B)` : '');
}

// 错误分类：判断是否为可重试的连接建立前错误
function isConnectError(err) {
    return err.code === 'ECONNREFUSED' ||
           err.code === 'ETIMEDOUT' ||
           err.code === 'EHOSTUNREACH' ||
           err.code === 'ENETUNREACH' ||
           err.code === 'EAI_AGAIN' ||
           err.code === 'ECONNRESET';
}

// 错误分类：获取人类可读的错误描述
function describeError(err) {
    const descriptions = {
        'ECONNREFUSED': 'Connection refused (target port not open)',
        'ETIMEDOUT': 'Connection timed out',
        'EHOSTUNREACH': 'Host unreachable',
        'ENETUNREACH': 'Network unreachable',
        'EAI_AGAIN': 'DNS lookup temporary failure',
        'ECONNRESET': 'Connection reset by peer',
        'EPIPE': 'Broken pipe',
        'ENOTFOUND': 'DNS lookup failed',
        'EACCES': 'Permission denied'
    };
    return descriptions[err.code] || err.message;
}

// 创建 TCP 中继
// options: { targetHost, targetPort, connectOptions, batchData, ws, cleanup, clientAddr }
function createOutboundConnector(options) {
    const { targetHost, targetPort, connectOptions, batchData, ws, cleanup, clientAddr } = options;

    let outboundSocket = null;
    let retryCount = 0;
    let isRetrying = false;
    let targetConnected = false;
    let firstBatchSent = false;
    const clientBuffer = []; // 重试期间缓冲的客户端数据
    let destroyed = false;
    let connectTimer = null;  // 连接建立超时定时器
    let firstByteTimer = null; // 首字节超时定时器
    let firstByteReceived = false; // 是否收到首字节
    let upstreamHalfClosed = false; // 上游是否半关闭
    let halfCloseTimer = null; // 半关闭等待定时器

    // ---- 流量统计 ----
    const trafficStats = {
        bytesUp: 0,      // 客户端 -> 上游
        bytesDown: 0,    // 上游 -> 客户端
        connectTime: 0,  // 连接建立耗时
        connectStart: 0  // 连接开始时间
    };

    // 清理连接超时定时器
    function clearConnectTimer() {
        if (connectTimer) {
            clearTimeout(connectTimer);
            connectTimer = null;
        }
    }

    // 建立上游连接（支持智能重试）
    function establishConnection() {
        if (destroyed) return;

        // 重置连接状态（支持重连）
        firstByteReceived = false;
        upstreamHalfClosed = false;
        if (halfCloseTimer) {
            clearTimeout(halfCloseTimer);
            halfCloseTimer = null;
        }

        // 熔断器检查
        if (isCircuitOpen(targetHost)) {
            logger.warn(`Circuit breaker OPEN for ${maskAddress(targetHost)}, rejecting connection`);
            cleanup();
            return;
        }

        trafficStats.connectStart = Date.now();
        outboundSocket = net.createConnection(connectOptions);

        // ---- 连接建立超时（10秒）----
        connectTimer = setTimeout(() => {
            if (!targetConnected && !destroyed) {
                logger.warn(`Connection timeout (${CONNECT_TIMEOUT_MS}ms) to ${maskAddress(targetHost)}:${targetPort}`);
                if (outboundSocket) {
                    outboundSocket.destroy();
                    outboundSocket = null;
                }
                // 超时也走重试逻辑
                handleConnectionError({ code: 'ETIMEDOUT', message: 'Connection timed out' });
            }
        }, CONNECT_TIMEOUT_MS);

        // 连接建立成功
        outboundSocket.on('connect', () => {
            clearConnectTimer();
            targetConnected = true;
            isRetrying = false;
            trafficStats.connectTime = Date.now() - trafficStats.connectStart;
            recordConnectionSuccess(targetHost);
            if (retryCount > 0) recordRetry(true); // 记录重试成功
            logger.debug(`Sync node connected: ${maskAddress(targetHost)}:${targetPort} (attempt ${retryCount + 1}, ${trafficStats.connectTime}ms)`);

            // TCP 参数优化
            outboundSocket.setNoDelay(true);  // 禁用 Nagle 算法，降低延迟
            outboundSocket.setKeepAlive(true, KEEPALIVE_INITIAL_DELAY); // Keepalive 探针
            outboundSocket.setTimeout(connectOptions.idleTimeout || IDLE_TIMEOUT_MS); // 空闲超时

            // 首字节超时：连接建立后 10 秒内没收到数据则断开（防止僵死连接）
            firstByteReceived = false;
            firstByteTimer = setTimeout(() => {
                if (!firstByteReceived && !destroyed) {
                    logger.debug(`First byte timeout: no data from ${maskAddress(targetHost)}:${targetPort} in ${FIRST_BYTE_TIMEOUT_MS}ms, closing`);
                    cleanup();
                }
            }, FIRST_BYTE_TIMEOUT_MS);

            // 先发送首帧数据（如果还没发送）
            if (!firstBatchSent && batchData.length > 0) {
                logger.debug(`First batch -> sync node: ${hexDump(batchData)}`);
                outboundSocket.write(batchData);
                firstBatchSent = true;
            }

            // 再发送重试期间缓冲的客户端数据
            if (clientBuffer.length > 0) {
                logger.debug(`Flushing ${clientBuffer.length} buffered client frames`);
                clientBuffer.forEach(data => outboundSocket.write(data));
                clientBuffer.length = 0;
            }
        });

        // 背压状态
        let isPaused = false;
        let backpressureCheckTimer = null;

        // 背压检查：WebSocket 缓冲区降到低水位后恢复上游读取
        function checkBackpressure() {
            if (isPaused && ws.bufferedAmount <= BACKPRESSURE_LOW_WATER_MARK) {
                isPaused = false;
                if (outboundSocket && !outboundSocket.destroyed) {
                    outboundSocket.resume();
                    logger.debug(`Backpressure released: buffered=${ws.bufferedAmount}B, resumed upstream read`);
                }
            }
            if (isPaused) {
                backpressureCheckTimer = setTimeout(checkBackpressure, BACKPRESSURE_CHECK_INTERVAL);
            }
        }

        // 仓库节点 → 客户端：直接透传（完全不修改数据）
        outboundSocket.on('data', (chunk) => {
            // 收到第一个数据包，清除首字节超时定时器
            if (!firstByteReceived) {
                firstByteReceived = true;
                clearTimeout(firstByteTimer);
                trafficStats.firstByteTime = Date.now() - trafficStats.connectStart - trafficStats.connectTime;
                logger.debug(`First byte received: ${maskAddress(targetHost)}:${targetPort} (${trafficStats.firstByteTime}ms after connect)`);
            }
            trafficStats.bytesDown += chunk.length;
            logger.debug(`Sync node -> client: ${chunk.length} bytes | ${hexDump(chunk)}`);
            if (ws.readyState === ws.OPEN) {
                ws.send(chunk);

                // 背压检查：WebSocket 缓冲区超过高水位时暂停上游读取
                if (!isPaused && ws.bufferedAmount >= BACKPRESSURE_HIGH_WATER_MARK) {
                    isPaused = true;
                    if (outboundSocket && !outboundSocket.destroyed) {
                        outboundSocket.pause();
                        logger.debug(`Backpressure triggered: buffered=${ws.bufferedAmount}B, paused upstream read`);
                        backpressureCheckTimer = setTimeout(checkBackpressure, BACKPRESSURE_CHECK_INTERVAL);
                    }
                }
            }
        });

        // 半关闭处理：上游发送 FIN（正常关闭）
        outboundSocket.on('end', () => {
            logger.debug(`Sync node half-closed (FIN): ${maskAddress(targetHost)}:${targetPort}, waiting for client data...`);
            upstreamHalfClosed = true;

            // 启动定时器，等待客户端剩余数据发送完毕，超时则清理
            halfCloseTimer = setTimeout(() => {
                logger.debug(`Half-close wait timeout (${HALF_CLOSE_WAIT_MS}ms), closing: ${maskAddress(targetHost)}:${targetPort}`);
                cleanup();
            }, HALF_CLOSE_WAIT_MS);
        });

        // 仓库节点空闲超时
        outboundSocket.on('timeout', () => {
            logger.debug(`Sync node idle timeout: ${maskAddress(targetHost)}:${targetPort}`);
            cleanup();
        });

        // 仓库节点错误（智能重试：仅连接建立前的错误重试）
        outboundSocket.on('error', (err) => {
            clearConnectTimer();
            handleConnectionError(err);
        });

        // 仓库节点关闭
        outboundSocket.on('close', (hadError) => {
            if (targetConnected && !destroyed) {
                logger.debug(`Sync node closed: ${maskAddress(targetHost)}:${targetPort}${hadError ? ' (with error)' : ''} | up=${trafficStats.bytesUp}B down=${trafficStats.bytesDown}B`);
                cleanup();
            }
            // 连接建立前的 close 由 error 事件处理重试逻辑
        });
    }

    // 统一的连接错误处理
    function handleConnectionError(err) {
        const errDesc = describeError(err);
        logger.debug(`Sync node error: ${maskAddress(targetHost)}:${targetPort} - ${err.code || 'UNKNOWN'}: ${errDesc}`);

        // 只在连接建立前的错误才重试（连接建立后的传输错误直接断开）
        if (shouldRetry(retryCount, targetConnected) && !destroyed && isConnectError(err)) {
            retryCount++;
            isRetrying = true;
            const delay = getRetryDelay(retryCount);
            logger.debug(`Retrying connection to ${maskAddress(targetHost)} (attempt ${retryCount}/${MAX_RETRIES}) in ${delay}ms`);

            // 销毁旧 socket，延迟后重新连接
            if (outboundSocket) {
                outboundSocket.destroy();
                outboundSocket = null;
            }

            setTimeout(() => {
                if (!destroyed) {
                    establishConnection();
                }
            }, delay);
            return;
        }

        // 重试耗尽或连接建立后的错误：记录失败并断开
        recordConnectionFailure(targetHost);
        if (retryCount > 0) recordRetry(false); // 记录重试失败
        cleanup();
    }

    // 写入客户端数据（重试期间缓冲，连接建立后直接写入）
    function write(data) {
        if (isRetrying) {
            // 计算当前缓冲区总字节数
            const currentBufferBytes = clientBuffer.reduce((sum, buf) => sum + buf.length, 0);
            if (currentBufferBytes + data.length > RETRY_BUFFER_MAX_BYTES) {
                // 缓冲区超过上限，不再缓冲，断开连接（防止内存溢出）
                logger.warn(`Retry buffer overflow: ${currentBufferBytes + data.length}B > ${RETRY_BUFFER_MAX_BYTES}B, closing connection`);
                cleanup();
                return;
            }
            clientBuffer.push(data);
            logger.debug(`Client data buffered during retry: ${data.length} bytes (buffer: ${clientBuffer.length} frames, ${currentBufferBytes + data.length}B)`);
        } else if (outboundSocket && !outboundSocket.destroyed && targetConnected) {
            // 上游半关闭后收到客户端数据，重置半关闭等待定时器（给客户端更多时间发送剩余数据）
            if (upstreamHalfClosed && halfCloseTimer) {
                clearTimeout(halfCloseTimer);
                halfCloseTimer = setTimeout(() => {
                    logger.debug(`Half-close wait timeout (${HALF_CLOSE_WAIT_MS}ms), closing: ${maskAddress(targetHost)}:${targetPort}`);
                    cleanup();
                }, HALF_CLOSE_WAIT_MS);
            }
            trafficStats.bytesUp += data.length;
            logger.debug(`Client -> sync node: ${data.length} bytes | ${hexDump(data)}`);
            outboundSocket.write(data);
        }
    }

    // 获取流量统计
    function getStats() {
        return {
            bytesUp: trafficStats.bytesUp,
            bytesDown: trafficStats.bytesDown,
            connectTimeMs: trafficStats.connectTime,
            retryCount: retryCount,
            targetConnected: targetConnected
        };
    }

    // 销毁中继
    function destroy() {
        destroyed = true;
        clearConnectTimer();
        if (firstByteTimer) {
            clearTimeout(firstByteTimer);
            firstByteTimer = null;
        }
        if (halfCloseTimer) {
            clearTimeout(halfCloseTimer);
            halfCloseTimer = null;
        }
        if (backpressureCheckTimer) {
            clearTimeout(backpressureCheckTimer);
            backpressureCheckTimer = null;
        }
        if (outboundSocket) {
            outboundSocket.destroy();
            outboundSocket = null;
        }
        clientBuffer.length = 0;
    }

    // 启动连接
    establishConnection();

    return { write, destroy, getStats };
}

module.exports = { createOutboundConnector };
