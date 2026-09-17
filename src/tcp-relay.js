// ====================================================================
// 仓库节点数据中继（TCP）
// 负责上游 TCP 连接建立、双向数据透传、智能重试
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
    MAX_RETRIES
} = require('./circuit');

// 调试用：十六进制转储前 N 字节
function hexDump(buf, n = 16) {
    const len = Math.min(n, buf.length);
    return buf.subarray(0, len).toString('hex') + (buf.length > len ? `...(+${buf.length - len}B)` : '');
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

    // 建立上游连接（支持智能重试）
    function establishConnection() {
        if (destroyed) return;

        // 熔断器检查
        if (isCircuitOpen(targetHost)) {
            logger.warn(`Circuit breaker OPEN for ${maskAddress(targetHost)}, rejecting connection`);
            cleanup();
            return;
        }

        relaySocket = net.createConnection(connectOptions, () => {
            upstreamConnected = true;
            isRetrying = false;
            recordConnectionSuccess(targetHost);
            logger.debug(`Sync node connected: ${maskAddress(targetHost)}:${targetPort} (attempt ${retryCount + 1})`);

            relaySocket.setNoDelay(true);
            relaySocket.setKeepAlive(true, 60000);
            relaySocket.setTimeout(connectOptions.idleTimeout || 300000);

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

        // 仓库节点 → 客户端：直接透传
        relaySocket.on('data', (chunk) => {
            logger.debug(`Sync node -> client: ${chunk.length} bytes | ${hexDump(chunk)}`);
            if (ws.readyState === ws.OPEN) {
                ws.send(chunk);
            }
        });

        // 仓库节点空闲超时
        relaySocket.on('timeout', () => {
            logger.debug(`Sync node timeout: ${maskAddress(targetHost)}:${targetPort}`);
            cleanup();
        });

        // 仓库节点错误（智能重试：仅连接建立前的错误重试）
        relaySocket.on('error', (err) => {
            logger.debug(`Sync node error: ${maskAddress(targetHost)}:${targetPort} - ${err.message}`);

            // 只在连接建立前的错误才重试（连接建立后的传输错误直接断开）
            if (shouldRetry(retryCount, upstreamConnected) && !destroyed) {
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
            cleanup();
        });

        // 仓库节点关闭
        relaySocket.on('close', () => {
            if (upstreamConnected && !destroyed) {
                logger.debug(`Sync node closed: ${maskAddress(targetHost)}:${targetPort}`);
                cleanup();
            }
            // 连接建立前的 close 由 error 事件处理重试逻辑
        });
    }

    // 写入客户端数据（重试期间缓冲，连接建立后直接写入）
    function write(data) {
        if (isRetrying) {
            clientBuffer.push(data);
            logger.debug(`Client data buffered during retry: ${data.length} bytes (buffer size: ${clientBuffer.length})`);
        } else if (relaySocket && !relaySocket.destroyed && upstreamConnected) {
            logger.debug(`Client -> sync node: ${data.length} bytes | ${hexDump(data)}`);
            relaySocket.write(data);
        }
    }

    // 销毁中继
    function destroy() {
        destroyed = true;
        if (relaySocket) {
            relaySocket.destroy();
            relaySocket = null;
        }
        clientBuffer.length = 0;
    }

    // 启动连接
    establishConnection();

    return { write, destroy };
}

module.exports = { createTcpRelay };
