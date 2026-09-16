// ====================================================================
// 流量混淆模块
// 借鉴 AnyTLS PaddingScheme 思路，通过多种策略控制包长与时序特征
// 支持：出站帧拆分（random/fixed/burst）、入站缓冲合并+随机延迟
// ====================================================================

const { CONFIG } = require('./config');

const SMALL_PASSTHROUGH = 512; // 小于此值直接透传，不拆分

// ---- 出站拆分策略 ----

// 策略1：随机大小拆分（默认）
function splitRandom(data) {
    const chunks = [];
    let offset = 0;
    while (offset < data.length) {
        const remaining = data.length - offset;
        if (remaining <= SMALL_PASSTHROUGH) {
            chunks.push(data.subarray(offset));
            break;
        }
        const maxSize = Math.min(remaining, CONFIG.OBFUSCATE_MAX);
        const minSize = Math.min(remaining, CONFIG.OBFUSCATE_MIN);
        const chunkSize = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
        chunks.push(data.subarray(offset, offset + chunkSize));
        offset += chunkSize;
    }
    return chunks;
}

// 策略2：固定大小拆分（模拟 HTTP/2 数据帧，如 4KB）
function splitFixed(data) {
    const chunks = [];
    let offset = 0;
    const size = CONFIG.OBFUSCATE_FIXED_SIZE;
    while (offset < data.length) {
        const remaining = data.length - offset;
        if (remaining <= SMALL_PASSTHROUGH) {
            chunks.push(data.subarray(offset));
            break;
        }
        const chunkSize = Math.min(remaining, size);
        chunks.push(data.subarray(offset, offset + chunkSize));
        offset += chunkSize;
    }
    return chunks;
}

// 策略3：突发模式（小帧+大帧交替，模拟网页浏览的请求-响应模式）
function splitBurst(data) {
    const chunks = [];
    let offset = 0;
    let useSmall = true; // 交替使用小帧和大帧
    while (offset < data.length) {
        const remaining = data.length - offset;
        if (remaining <= SMALL_PASSTHROUGH) {
            chunks.push(data.subarray(offset));
            break;
        }
        let chunkSize;
        if (useSmall) {
            // 小帧：1-4KB，模拟请求头/控制帧
            const maxS = Math.min(remaining, 4096);
            const minS = Math.min(remaining, CONFIG.OBFUSCATE_MIN);
            chunkSize = Math.floor(Math.random() * (maxS - minS + 1)) + minS;
        } else {
            // 大帧：8-16KB，模拟响应数据
            const maxL = Math.min(remaining, CONFIG.OBFUSCATE_MAX);
            const minL = Math.min(remaining, 8192);
            chunkSize = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
        }
        chunks.push(data.subarray(offset, offset + chunkSize));
        offset += chunkSize;
        useSmall = !useSmall;
    }
    return chunks;
}

// 根据配置选择拆分策略
function splitChunks(data) {
    if (!CONFIG.OBFUSCATE_ENABLED || data.length <= SMALL_PASSTHROUGH) {
        return [data];
    }
    switch (CONFIG.OBFUSCATE_MODE) {
        case 'fixed':
            return splitFixed(data);
        case 'burst':
            return splitBurst(data);
        case 'none':
            return [data];
        case 'random':
        default:
            return splitRandom(data);
    }
}

// 出站混淆发送：将数据拆分后逐帧发送
function sendObfuscated(ws, data) {
    const chunks = splitChunks(data);
    let lastResult = true;
    for (const chunk of chunks) {
        lastResult = ws.send(chunk);
    }
    return lastResult;
}

// ---- 入站混淆：缓冲 + 合并 + 随机延迟 ----
// 客户端 → WebSocket → [缓冲合并] → TCP 上游
// 通过攒批发送和随机延迟，破坏入站方向的时序特征

function createInboundObfuscator(writeFn) {
    if (!CONFIG.OBFUSCATE_ENABLED || !CONFIG.OBFUSCATE_INBOUND) {
        // 混淆未启用：直接透传
        return {
            write: (data) => writeFn(data),
            flush: () => {},
            destroy: () => {}
        };
    }

    let buffer = null;
    let bufferLength = 0;
    let flushTimer = null;
    let delayTimer = null;
    let destroyed = false;

    function doFlush() {
        if (destroyed || !buffer || bufferLength === 0) return;
        const data = bufferLength === buffer.length ? buffer : buffer.subarray(0, bufferLength);
        buffer = null;
        bufferLength = 0;
        writeFn(data);
    }

    function scheduleFlush() {
        if (destroyed) return;
        // 每次写入都安排随机延迟刷新（如果已有待处理的延迟则不重复创建）
        if (!delayTimer) {
            const delay = Math.random() * CONFIG.OBFUSCATE_DELAY_MAX;
            delayTimer = setTimeout(() => {
                delayTimer = null;
                doFlush();
            }, delay);
        }
        // 兜底：固定间隔检查，防止延迟累积导致数据滞留
        if (!flushTimer) {
            flushTimer = setInterval(() => {
                if (bufferLength > 0 && !delayTimer) doFlush();
            }, CONFIG.OBFUSCATE_FLUSH_INTERVAL);
        }
    }

    function write(data) {
        if (destroyed) return;
        if (!data || data.length === 0) return;

        // 小包直接透传（模拟控制消息/ACK）
        if (data.length <= SMALL_PASSTHROUGH) {
            // 先刷新缓冲，保持顺序
            if (bufferLength > 0) doFlush();
            writeFn(data);
            return;
        }

        // 大包加入缓冲
        if (!buffer) {
            buffer = Buffer.alloc(Math.max(data.length * 2, CONFIG.OBFUSCATE_MIN));
            bufferLength = 0;
        }

        // 缓冲不足时扩容
        if (bufferLength + data.length > buffer.length) {
            const newSize = Math.max(buffer.length * 2, bufferLength + data.length);
            const newBuffer = Buffer.alloc(newSize);
            buffer.copy(newBuffer, 0, 0, bufferLength);
            buffer = newBuffer;
        }

        if (Buffer.isBuffer(data)) {
            data.copy(buffer, bufferLength);
        } else {
            buffer.set(data, bufferLength);
        }
        bufferLength += data.length;

        // 超过缓冲上限立即刷新
        if (bufferLength >= CONFIG.OBFUSCATE_BUFFER_MAX) {
            doFlush();
        } else {
            scheduleFlush();
        }
    }

    function flush() {
        if (delayTimer) {
            clearTimeout(delayTimer);
            delayTimer = null;
        }
        doFlush();
    }

    function destroy() {
        destroyed = true;
        if (flushTimer) {
            clearInterval(flushTimer);
            flushTimer = null;
        }
        if (delayTimer) {
            clearTimeout(delayTimer);
            delayTimer = null;
        }
        // 销毁前刷新剩余数据
        if (bufferLength > 0) doFlush();
        buffer = null;
    }

    return { write, flush, destroy };
}

function isObfuscateEnabled() {
    return CONFIG.OBFUSCATE_ENABLED;
}

function isInboundObfuscateEnabled() {
    return CONFIG.OBFUSCATE_ENABLED && CONFIG.OBFUSCATE_INBOUND;
}

module.exports = {
    sendObfuscated,
    splitChunks,
    createInboundObfuscator,
    isObfuscateEnabled,
    isInboundObfuscateEnabled
};
