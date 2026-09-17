// ====================================================================
// 数据帧处理引擎（兼容层）
// 已迁移至 core/session-router.js、core/auth-validator.js、core/response-builder.js
// 本文件保留向后兼容，传输方式完全不变（完全透传）
// ====================================================================

const logger = require('./logger');
const { parseBatchHeader } = require('./core/frame-header');
const { resolveNodeEndpoint } = require('./core/address-resolver');
const { createOutboundPipeline } = require('./core/stream-pipeline');
const { processPacketQueue, createDatagramForwarder } = require('./core/datagram-forwarder');
const { isReservedAddress, resolveEndpoint } = require('./security');
const { CONFIG } = require('./config');
const { maskAddress } = require('./logger');
const { recordAuthEvent, clearAuthEvents } = require('./core/auth-validator');
const { sendBatchAck } = require('./core/response-builder');

// 创建帧处理器（兼容旧接口名 createBatchProcessor）
// options: { ws, cleanup, clientAddr, recordAuthEvent, clearAuthEvents }
function createBatchProcessor(options) {
    const { ws, cleanup, clientAddr } = options;

    let isFirstBatch = true;
    let isDatagramMode = false;
    let outboundPipeline = null;
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
        const frameMeta = parseBatchHeader(batch);

        if (!frameMeta) {
            logger.debug(`Auth failed: invalid batch (${batch.length} bytes) from ${clientAddr}`);
            recordAuthEvent(clientAddr);
            setTimeout(() => cleanup(), Math.random() * 200 + 100);
            return;
        }

        clearAuthEvents(clientAddr);

        const batchData = batch.subarray(frameMeta.dataOffset);
        const targetHost = resolveNodeEndpoint(frameMeta.addrFormat, frameMeta.targetEndpoint, frameMeta.targetPort).address;
        logger.debug(`Auth OK: ${maskAddress(targetHost)}:${frameMeta.targetPort} mode=${frameMeta.syncMode} batch=${batchData.length}B from ${clientAddr}`);

        // 同步确认帧：立即发送（完全透传，不修改）
        sendBatchAck(ws, batch);
        logger.debug('Sync ack sent');

        // ---- 数据报模式（UDP）----
        if (frameMeta.syncMode === 2) {
            isDatagramMode = true;
            if (frameMeta.targetPort !== 53) { cleanup(); return; }
            const datagramTarget = targetHost;
            logger.debug(`Datagram mode: ${datagramTarget}:${frameMeta.targetPort} batch=${batchData.length}B`);
            datagramForwarder = createDatagramForwarder(ws, datagramTarget, frameMeta.targetPort);
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

        // 创建 TCP 数据管道（包含智能重试和熔断）
        // 传输方式：完全透传，不修改任何数据
        outboundPipeline = createOutboundPipeline({
            targetHost,
            targetPort: frameMeta.targetPort,
            connectOptions,
            initialBatch: batchData,
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
        } else if (outboundPipeline) {
            outboundPipeline.write(batch);
        }
    }

    // 销毁
    function destroy() {
        if (outboundPipeline) {
            outboundPipeline.destroy();
            outboundPipeline = null;
        }
        if (datagramForwarder) {
            datagramForwarder.destroy();
            datagramForwarder = null;
        }
    }

    return { handleMessage, destroy };
}

module.exports = { createBatchProcessor };
