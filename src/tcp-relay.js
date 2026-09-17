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
function createTcpRelay(options) {
    const { targetHost, targetPort, connectOptions, batchData, ws, cleanup, clientAddr } = options;

    let relaySocket = null;
    let retryCount = 0;
    let isRetrying = false;
    let upstreamConnected = false;
    let firstBatchSent = false;
    const clientBuffer = []; // 重试期间缓冲的客户端数据
    let destroyed = false;
    let connectTimer = null;  // 连接建立超时定时器

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

        // 熔断器检查
        if (isCircuitOpen(targetHost)) {
            logger.warn(`Circuit breaker OPEN for ${maskAddress(targetHost)}, rejecting connection`);
            cleanup();
            return;
        }

        trafficStats.connectStart = Date.now();
        relaySocket = net.createConnection(connectOptions);

        // ---- 连接建立超时（10秒）----
        connectTimer = setTimeout(() => {
            if (!upstreamConnected && !destroyed) {
                logger.warn(`Connection timeout (${CONNECT_TIMEOUT_MS}ms) to ${maskAddress(targetHost)}:${targetPort}`);
                if (relaySocket) {
                    relaySocket.destroy();
                    relaySocket = null;
                }
                // 超时也走重试逻辑
                handleConnectionError({ code: 'ETIMEDOUT', message: 'Connection timed out' });
            }
        }, CONNECT_TIMEOUT_MS);

        // 连接建立成功
        relaySocket.on('connect', () => {
            clearConnectTimer();
            upstreamConnected = true;
            isRetrying = false;
            trafficStats.connectTime = Date.now() - trafficStats.connectStart;
            recordConnectionSuccess(targetHost);
            if (retryCount > 0) recordRetry(true); // 记录重试成功
            logger.debug(`Sync node connected: ${maskAddress(targetHost)}:${targetPort} (attempt ${retryCount + 1}, ${trafficStats.connectTime}ms)`);

            // TCP 参数优化
            relaySocket.setNoDelay(true);  // 禁用 Nagle 算法，降低延迟
            relaySocket.setKeepAlive(true, KEEPALIVE_INITIAL_DELAY); // Keepalive 探针
            relaySocket.setTimeout(connectOptions.idleTimeout || IDLE_TIMEOUT_MS); // 空闲超时

            // 先发送首帧数据（如果还没发送）
            if (!firstBatchSent && batchData.length > 0) {
                logger.debug(`First batch -> sync node: ${hexDump(batchData)}`);
                relaySocket.write(batchData);
                firstBatchSent = true;
            }

            // 再发送重试期间缓冲的客户端数据
            if (clientBuffer.length > 0) {
                logger.debug(`Flushing ${clientBuffer.length} buffered client frames`);
                clientBuffer.forEach(data => relaySocket.write(data));
                clientBuffer.length = 0;
            }
        });

        // 仓库节点 → 客户端：直接透传（完全不修改数据）
        relaySocket.on('data', (chunk) => {
            trafficStats.bytesDown += chunk.length;
            logger.debug(`Sync node -> client: ${chunk.length} bytes | ${hexDump(chunk)}`);
            if (ws.readyState === ws.OPEN) {
                ws.send(chunk);
            }
        });

        // 半关闭处理：上游发送 FIN（正常关闭）
        relaySocket.on('end', () => {
            logger.debug(`Sync node half-closed (FIN): ${maskAddress(targetHost)}:${targetPort}`);
            // 上游已关闭，不再有数据，直接清理
            cleanup();
        });

        // 仓库节点空闲超时
        relaySocket.on('timeout', () => {
            logger.debug(`Sync node idle timeout: ${maskAddress(targetHost)}:${targetPort}`);
            cleanup();
        });

        // 仓库节点错误（智能重试：仅连接建立前的错误重试）
        relaySocket.on('error', (err) => {
            clearConnectTimer();
            handleConnectionError(err);
        });

        // 仓库节点关闭
        relaySocket.on('close', (hadError) => {
            if (upstreamConnected && !destroyed) {
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
        if (shouldRetry(retryCount, upstreamConnected) && !destroyed && isConnectError(err)) {
            retryCount++;
            isRetrying = true;
            const delay = getRetryDelay(retryCount);
            logger.debug(`Retrying connection to ${maskAddress(targetHost)} (attempt ${retryCount}/${MAX_RETRIES}) in ${delay}ms`);

            // 销毁旧 socket，延迟后重新连接
            if (relaySocket) {
                relaySocket.destroy();
                relaySocket = null;
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
            clientBuffer.push(data);
            logger.debug(`Client data buffered during retry: ${data.length} bytes (buffer size: ${clientBuffer.length})`);
        } else if (relaySocket && !relaySocket.destroyed && upstreamConnected) {
            trafficStats.bytesUp += data.length;
            logger.debug(`Client -> sync node: ${data.length} bytes | ${hexDump(data)}`);
            relaySocket.write(data);
        }
    }

    // 获取流量统计
    function getStats() {
        return {
            bytesUp: trafficStats.bytesUp,
            bytesDown: trafficStats.bytesDown,
            connectTimeMs: trafficStats.connectTime,
            retryCount: retryCount,
            upstreamConnected: upstreamConnected
        };
    }

    // 销毁中继
    function destroy() {
        destroyed = true;
        clearConnectTimer();
        if (relaySocket) {
            relaySocket.destroy();
            relaySocket = null;
        }
        clientBuffer.length = 0;
    }

    // 启动连接
    establishConnection();

    return { write, destroy, getStats };
}

module.exports = { createTcpRelay };
