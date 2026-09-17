// ====================================================================
// 数据帧处理引擎
// 负责首帧解析、认证、响应发送、TCP/UDP 分发、后续数据帧路由
// ====================================================================

const logger = require('./logger');
const { parseFrameHeader, parseTargetAddress } = require('./protocol');
const { createOutboundConnector } = require('./tcp-relay');
const { processPacketQueue, createUdpForwarder } = require('./udp-relay');
const { isReservedAddress, resolveEndpoint } = require('./security');
const { CONFIG } = require('./config');
const { maskAddress } = require('./logger');

// 调试用：十六进制转储前 N 字节
function hexDump(buf, n = 16) {
    const len = Math.min(n, buf.length);
    return buf.subarray(0, len).toString('hex') + (buf.length > len ? `...(+${buf.length - len}B)` : '');
}

// 创建帧处理器
// options: { ws, cleanup, clientAddr, recordAuthEvent, clearAuthEvents }
function createBatchProcessor(options) {
    const { ws, cleanup, clientAddr, recordAuthEvent, clearAuthEvents } = options;

    let isFirstBatch = true;
    let isDatagramMode = false;
    let outboundConnector = null;
    let datagramForwarder = null;
    const datagramState = { buffer: Buffer.alloc(0) };

    // 处理消息
    function handleMessage(batch) {
        if (isFirstBatch) {
            isFirstBatch = false;
            handleFirstBatch(batch);
        } else {
            handleSubsequentBatch(batch);
        }
    }

    // 处理首帧
    function handleFirstBatch(batch) {
        const frameMeta = parseFrameHeader(batch);

        if (!frameMeta) {
            logger.debug(`Auth failed: invalid batch (${batch.length} bytes) from ${clientAddr}`);
            recordAuthEvent(clientAddr);
            setTimeout(() => cleanup(), Math.random() * 200 + 100);
            return;
        }

        clearAuthEvents(clientAddr);

        const batchData = batch.subarray(frameMeta.dataOffset);
        const targetHost = parseTargetAddress(frameMeta.addrFormat, frameMeta.targetEndpoint);
        logger.debug(`Auth OK: ${maskAddress(targetHost)}:${frameMeta.targetPort} mode=${frameMeta.syncMode} batch=${batchData.length}B from ${clientAddr}`);

        // 同步确认帧：立即发送
        ws.send(Buffer.from([batch[0], 0]));
        logger.debug('Sync ack sent');

        // ---- 数据报模式（UDP）----
        if (frameMeta.syncMode === 2) {
            isDatagramMode = true;
            if (frameMeta.targetPort !== 53) { cleanup(); return; }
            const datagramTarget = parseTargetAddress(frameMeta.addrFormat, frameMeta.targetEndpoint);
            logger.debug(`Datagram mode: ${datagramTarget}:${frameMeta.targetPort} batch=${batchData.length}B`);
            datagramForwarder = createUdpForwarder(ws, datagramTarget, frameMeta.targetPort);
            datagramState.buffer = batchData;
            processPacketQueue(datagramState, datagramForwarder);
            return;
        }

        // ---- 流模式（TCP）：建立仓库节点连接 ----
        // 端点过滤
        if (CONFIG.ENDPOINT_FILTER && frameMeta.addrFormat !== 3 && isReservedAddress(targetHost)) {
            logger.warn(`Endpoint not allowed: ${maskAddress(targetHost)}`);
            cleanup();
            return;
        }

        const connectOptions = {
            host: targetHost,
            port: frameMeta.targetPort,
            idleTimeout: CONFIG.IDLE_TIMEOUT
        };

        if (CONFIG.ENDPOINT_FILTER && frameMeta.addrFormat === 3) {
            connectOptions.lookup = resolveEndpoint;
        }

        // 创建 TCP 中继（包含智能重试和熔断）
        outboundConnector = createOutboundConnector({
            targetHost,
            targetPort: frameMeta.targetPort,
            connectOptions,
            batchData,
            ws,
            cleanup,
            clientAddr
        });
    }

    // 处理后续数据帧
    function handleSubsequentBatch(batch) {
        if (isDatagramMode) {
            datagramState.buffer = Buffer.concat([datagramState.buffer, batch]);
            if (datagramState.buffer.length > 65536) { cleanup(); return; }
            processPacketQueue(datagramState, datagramForwarder);
        } else if (outboundConnector) {
            outboundConnector.write(batch);
        }
    }

    // 销毁
    function destroy() {
        if (outboundConnector) {
            outboundConnector.destroy();
            outboundConnector = null;
        }
        if (datagramForwarder) {
            datagramForwarder.destroy();
            datagramForwarder = null;
        }
    }

    return { handleMessage, destroy };
}

module.exports = { createBatchProcessor };
