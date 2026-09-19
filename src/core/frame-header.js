// ====================================================================
// 鎵规澶磋В鏋愬櫒
// 企业库存同协 - 二进制量数捉次头解码
// 负责解析批元信恼协版本、同步模式目标服务?
// ====================================================================

const { verifyTenantSignature, zeroizeSensitiveBuffer } = require('../auth');

/**
 * 鎵规澶村厓鏁版嵁绫?
 * 封解析后的批头信恼提供业务层面的闎?
 */
class BatchHeader {
    constructor(options) {
        this.protocolVersion = options.protocolVersion || 0;
        this.syncMode = options.syncMode;              // 1=流模式 2=数据报模式
        this.addrFormat = options.addrFormat;          // 1=IPv4, 3=域名, 4=IPv6
        this.targetPort = options.targetPort;
        this.targetEndpoint = options.targetEndpoint;  // Buffer
        this.dataOffset = options.dataOffset;
        this.addons = options.addons || [];
        this.parsedAt = Date.now();
    }

    /**
     * 判断昐为流同模式（TCP?
     */
    get isStreamMode() {
        return this.syncMode === 1;
    }

    /**
     * 判断昐为数捊同模式（UDP?
     */
    get isDatagramMode() {
        return this.syncMode === 2;
    }

    /**
     * 鍒ゆ柇鐩爣鏄惁涓哄煙鍚?
     */
    get isHostname() {
        return this.addrFormat === 3;
    }

    /**
     * 获取批头大小（字节?
     */
    get headerSize() {
        return this.dataOffset;
    }

    /**
     * 轍为业务可读格式（用于日志和监控）
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
 * 鎵规澶存牎楠屽櫒
 * 验证批头的完整性和合法?
 */
class BatchHeaderValidator {
    static MIN_BATCH_SIZE = 24;  // 小批次大小（字节?

    /**
     * 校验批数据昐满足小长度?
     */
    static validateSize(buffer) {
        return buffer && buffer.length >= this.MIN_BATCH_SIZE;
    }

    /**
     * 鏍￠獙绉熸埛绛惧悕鏄惁鏈夋晥
     */
    static validateSignature(buffer) {
        return verifyTenantSignature(buffer);
    }

    /**
     * 完整校验：大?+ 签名
     */
    static validate(buffer) {
        return this.validateSize(buffer) && this.validateSignature(buffer);
    }
}

/**
 * 解析二进制量数捉次头
 * @param {Buffer} buffer - 鍘熷鎵规鏁版嵁
 * @returns {BatchHeader|null} 解析后的批头，无效则返?null
 */
function parseBatchHeader(buffer) {
    if (!BatchHeaderValidator.validate(buffer)) {
        return null;
    }

    // 认证通过后，立即安全清零 UUID 缓冲区（字节1-16），防止内存 dump 泄露
    // 后续解析仅读取字节17及以后，ACK 仅读取字节0，数据载荷从 dataOffset 开始，不受影响
    zeroizeSensitiveBuffer(buffer, 1, 16);

    const addonsLength = buffer[17];
    const syncMode = buffer[18 + addonsLength];
    // syncMode 枚举校验: 1=TCP流模式，2=UDP数据报模式，其他值拒绝
    if (syncMode !== 1 && syncMode !== 2) {
        return null;
    }
    const targetPort = (buffer[19 + addonsLength] << 8) | buffer[20 + addonsLength];

    let addrFormat = buffer[21 + addonsLength];
    // 线协议地址类型白名单：1=IPv4, 2=域名, 3=IPv6（拒绝 0 和其他无效值）
    if (addrFormat !== 1 && addrFormat !== 2 && addrFormat !== 3) return null;
    if (addrFormat !== 1) addrFormat += 1;

    // 控制流平坦化：使?switch 状机解析地址格式
    // 避免连续 if/else 链，增加静分析难?
    let addrLen = 0;
    let addrOffset = 22 + addonsLength;
    let parseState = 'resolve_format';

    while (parseState !== 'done') {
        switch (parseState) {
            case 'resolve_format':
                // 根据地址格式确地址长度
                switch (addrFormat) {
                    case 3:  // 鍩熷悕
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
                        // 期地址格式，解析失?
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

    // 解析扩展元数捼当前仅解析保留，用于朝扩展?
    const { parseBatchAddons } = require('./addon-parser');
    const addons = addonsLength > 0 ? parseBatchAddons(buffer, 18, addonsLength) : [];

    // 端口范围校验: 1-65535，0为保留口不允许
    if (targetPort <= 0 || targetPort > 65535) {
        return null;
    }

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
