// ====================================================================
// 批次确认响应构建器
// 企业库存同步协议 - 同步确认帧编码
// 负责构建批次确认响应、状态响应、错误响应
// ====================================================================

/**
 * 响应类型常量
 */
const ResponseType = {
    BATCH_ACK: 0x00,           // 批次确认
    SUCCESS: 0x00,             // 成功
    ERROR_INVALID_BATCH: 0x01, // 无效批次
    ERROR_AUTH_FAILED: 0x02,   // 认证失败
    ERROR_TARGET_UNREACHABLE: 0x03, // 目标不可达
    ERROR_INTERNAL: 0x04       // 内部错误
};

/**
 * 同步确认帧类
 * 封装批次确认响应数据
 */
class SyncAckFrame {
    constructor(version, status) {
        this.version = version;
        this.status = status;
        this.createdAt = Date.now();
    }

    /**
     * 编码为二进制 Buffer
     */
    encode() {
        return Buffer.from([this.version, this.status]);
    }

    /**
     * 是否为成功响应
     */
    get isSuccess() {
        return this.status === ResponseType.SUCCESS;
    }

    /**
     * 获取响应大小
     */
    get size() {
        return 2;
    }

    /**
     * 转换为十六进制字符串
     */
    toHex() {
        return this.encode().toString('hex');
    }
}

/**
 * 批次确认构建器
 * 构建各种类型的同步响应
 */
class BatchAckBuilder {
    /**
     * 构建成功确认帧
     * @param {number} version - 协议版本
     * @returns {SyncAckFrame} 确认帧
     */
    static buildSuccess(version = 0) {
        return new SyncAckFrame(version, ResponseType.SUCCESS);
    }

    /**
     * 构建错误响应
     * @param {number} version - 协议版本
     * @param {number} errorCode - 错误码
     * @returns {SyncAckFrame} 错误响应帧
     */
    static buildError(version, errorCode) {
        return new SyncAckFrame(version, errorCode);
    }

    /**
     * 从批次数据构建确认帧
     * @param {Buffer} batchData - 原始批次数据
     * @returns {SyncAckFrame} 确认帧
     */
    static fromBatch(batchData) {
        const version = batchData && batchData.length > 0 ? batchData[0] : 0;
        return this.buildSuccess(version);
    }
}

/**
 * 响应发送器
 * 通过 WebSocket 发送同步响应
 */
class ResponseSender {
    constructor(ws) {
        this.ws = ws;
        this.sentCount = 0;
        this.totalBytes = 0;
    }

    /**
     * 发送确认帧
     * @param {SyncAckFrame} frame - 确认帧
     * @returns {boolean} 是否发送成功
     */
    sendAck(frame) {
        if (!this.ws || this.ws.readyState !== 1) {
            return false;
        }
        const data = frame.encode();
        this.ws.send(data);
        this.sentCount++;
        this.totalBytes += data.length;
        return true;
    }

    /**
     * 发送成功确认（便捷方法）
     * @param {Buffer} batchData - 原始批次数据
     * @returns {boolean} 是否发送成功
     */
    sendSuccessAck(batchData) {
        const frame = BatchAckBuilder.fromBatch(batchData);
        return this.sendAck(frame);
    }

    /**
     * 发送错误响应
     * @param {number} errorCode - 错误码
     * @returns {boolean} 是否发送成功
     */
    sendError(errorCode) {
        const frame = BatchAckBuilder.buildError(0, errorCode);
        return this.sendAck(frame);
    }

    /**
     * 获取发送统计
     */
    getStats() {
        return {
            sentCount: this.sentCount,
            totalBytes: this.totalBytes
        };
    }
}

/**
 * 兼容旧接口：构建并发送确认帧
 * @param {WebSocket} ws - WebSocket 连接
 * @param {Buffer} batchData - 原始批次数据
 */
function sendBatchAck(ws, batchData) {
    const sender = new ResponseSender(ws);
    return sender.sendSuccessAck(batchData);
}

module.exports = {
    ResponseType,
    SyncAckFrame,
    BatchAckBuilder,
    ResponseSender,
    sendBatchAck
};
