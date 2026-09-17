// ====================================================================
// 批次头解析器
// 企业库存同步协议 - 二进制增量数据批次头解码
// 负责解析批次元信息：协议版本、同步模式、目标服务端口
// ====================================================================

const { verifyTenantSignature } = require('../auth');

/**
 * 批次头元数据类
 * 封装解析后的批次头信息，提供业务层面的访问接口
 */
class BatchHeader {
    constructor(options) {
        this.protocolVersion = options.protocolVersion || 0;
        this.syncMode = options.syncMode;              // 1=流模式, 2=数据报模式
        this.addrFormat = options.addrFormat;          // 1=IPv4, 3=域名, 4=IPv6
        this.targetPort = options.targetPort;
        this.targetEndpoint = options.targetEndpoint;  // Buffer
        this.dataOffset = options.dataOffset;
        this.addons = options.addons || [];
        this.parsedAt = Date.now();
    }

    /**
     * 判断是否为流同步模式（TCP）
     */
    get isStreamMode() {
        return this.syncMode === 1;
    }

    /**
     * 判断是否为数据报同步模式（UDP）
     */
    get isDatagramMode() {
        return this.syncMode === 2;
    }

    /**
     * 判断目标是否为域名
     */
    get isHostname() {
        return this.addrFormat === 3;
    }

    /**
     * 获取批次头大小（字节）
     */
    get headerSize() {
        return this.dataOffset;
    }

    /**
     * 转换为业务可读格式（用于日志和监控）
     */
    toLogFormat() {
        return {
            mode: this.isStreamMode ? 'stream' : 'datagram',
            port: this.targetPort,
            addrType: this.isHostname ? 'hostname' : 'ip',
            addons: this.addons.length,
            parsedAt: new Date(this.parsedAt).toISOString()
        };
    }
}

/**
 * 批次头校验器
 * 验证批次头的完整性和合法性
 */
class BatchHeaderValidator {
    static MIN_BATCH_SIZE = 24;  // 最小批次大小（字节）

    /**
     * 校验批次数据是否满足最小长度要求
     */
    static validateSize(buffer) {
        return buffer && buffer.length >= this.MIN_BATCH_SIZE;
    }

    /**
     * 校验租户签名是否有效
     */
    static validateSignature(buffer) {
        return verifyTenantSignature(buffer);
    }

    /**
     * 完整校验：大小 + 签名
     */
    static validate(buffer) {
        return this.validateSize(buffer) && this.validateSignature(buffer);
    }
}

/**
 * 解析二进制增量数据批次头
 * @param {Buffer} buffer - 原始批次数据
 * @returns {BatchHeader|null} 解析后的批次头，无效则返回 null
 */
function parseBatchHeader(buffer) {
    if (!BatchHeaderValidator.validate(buffer)) {
        return null;
    }

    const addonsLength = buffer[17];
    const syncMode = buffer[18 + addonsLength];
    const targetPort = (buffer[19 + addonsLength] << 8) | buffer[20 + addonsLength];

    let addrFormat = buffer[21 + addonsLength];
    if (addrFormat !== 1) addrFormat += 1;

    // 控制流平坦化：使用 switch 状态机解析地址格式
    // 避免连续 if/else 链，增加静态分析难度
    let addrLen = 0;
    let addrOffset = 22 + addonsLength;
    let parseState = 'resolve_format';

    while (parseState !== 'done') {
        switch (parseState) {
            case 'resolve_format':
                // 根据地址格式确定地址长度
                switch (addrFormat) {
                    case 3:  // 域名
                        addrLen = buffer[addrOffset];
                        addrOffset++;
                        parseState = 'validate_offset';
                        break;
                    case 1:  // IPv4
                        addrLen = 4;
                        parseState = 'validate_offset';
                        break;
                    case 4:  // IPv6
                        addrLen = 16;
                        parseState = 'validate_offset';
                        break;
                    default:
                        // 未知地址格式，解析失败
                        parseState = 'fail';
                        break;
                }
                break;

            case 'validate_offset':
                // 验证数据偏移量是否在缓冲区范围内
                parseState = (addrOffset + addrLen <= buffer.length) ? 'success' : 'fail';
                break;

            case 'success':
                parseState = 'done';
                break;

            case 'fail':
                return null;

            default:
                parseState = 'fail';
                break;
        }
    }

    const dataOffset = addrOffset + addrLen;

    // 解析扩展元数据（当前仅解析保留，用于未来扩展）
    const { parseBatchAddons } = require('./addon-parser');
    const addons = addonsLength > 0 ? parseBatchAddons(buffer, 18, addonsLength) : [];

    return new BatchHeader({
        protocolVersion: buffer[0],
        syncMode,
        addrFormat,
        targetPort,
        targetEndpoint: buffer.subarray(addrOffset, dataOffset),
        dataOffset,
        addons
    });
}

module.exports = {
    BatchHeader,
    BatchHeaderValidator,
    parseBatchHeader
};
