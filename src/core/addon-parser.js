// ====================================================================
// 批次扩展元数据解析器
// 企业库存同步协议 - TLV 格式扩展字段解码
// Type(1B) + Length(1B) + Value(NB)
// ====================================================================

/**
 * 扩展元数据项类
 * 封装单个 TLV 扩展字段
 */
class BatchAddon {
    constructor(type, length, value) {
        this.type = type;
        this.length = length;
        this.value = value;  // Buffer
        this.parsedAt = Date.now();
    }

    /**
     * 获取值的字符串形式
     */
    get valueAsString() {
        return this.value.toString('utf8');
    }

    /**
     * 获取值的十六进制形式
     */
    get valueAsHex() {
        return this.value.toString('hex');
    }

    /**
     * 获取值的数值形式（小端）
     */
    get valueAsUInt16LE() {
        return this.value.length >= 2 ? this.value.readUInt16LE(0) : 0;
    }

    /**
     * 获取值的数值形式（大端）
     */
    get valueAsUInt16BE() {
        return this.value.length >= 2 ? this.value.readUInt16BE(0) : 0;
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            type: this.type,
            length: this.length,
            value: this.valueAsHex,
            parsedAt: new Date(this.parsedAt).toISOString()
        };
    }
}

/**
 * 扩展字段类型常量（业务语义）
 */
const AddonType = {
    FLOW_CONTROL: 0x01,       // 流量控制参数
    SEED_CLIENT: 0x02,        // 客户端标识
    SEED_SECURITY: 0x03,      // 安全参数
    PADDING: 0x04,            // 填充数据
    CUSTOM_METADATA: 0x05,    // 自定义元数据
    PRIORITY: 0x06,           // 同步优先级
    TIMESTAMP: 0x07,          // 时间戳
    CHECKSUM: 0x08            // 校验和
};

/**
 * 扩展字段类型名称映射
 */
const AddonTypeName = {
    [AddonType.FLOW_CONTROL]: 'flow_control',
    [AddonType.SEED_CLIENT]: 'client_identity',
    [AddonType.SEED_SECURITY]: 'security_params',
    [AddonType.PADDING]: 'padding',
    [AddonType.CUSTOM_METADATA]: 'custom_metadata',
    [AddonType.PRIORITY]: 'sync_priority',
    [AddonType.TIMESTAMP]: 'timestamp',
    [AddonType.CHECKSUM]: 'checksum'
};

/**
 * TLV 解析器
 * 解析 Type-Length-Value 格式的扩展元数据
 */
class TLVParser {
    static HEADER_SIZE = 2;  // Type(1) + Length(1)

    /**
     * 从缓冲区解析 TLV 数据
     * @param {Buffer} buffer - 原始缓冲区
     * @param {number} offset - 起始偏移
     * @param {number} length - 总长度
     * @returns {BatchAddon[]} 解析后的扩展字段数组
     */
    static parse(buffer, offset, length) {
        const addons = [];
        let pos = offset;
        const end = offset + length;

        while (pos < end) {
            // 确保有足够的字节读取 TLV 头
            if (pos + this.HEADER_SIZE > end) break;

            const type = buffer[pos];
            const len = buffer[pos + 1];

            // 确保有足够的字节读取 Value
            if (pos + this.HEADER_SIZE + len > end) break;

            const value = buffer.subarray(pos + this.HEADER_SIZE, pos + this.HEADER_SIZE + len);
            addons.push(new BatchAddon(type, len, value));

            pos += this.HEADER_SIZE + len;
        }

        return addons;
    }

    /**
     * 按类型查找扩展字段
     */
    static findByType(addons, type) {
        return addons.find(addon => addon.type === type);
    }

    /**
     * 获取类型名称
     */
    static getTypeName(type) {
        return AddonTypeName[type] || `unknown_0x${type.toString(16)}`;
    }
}

/**
 * 解析批次扩展元数据
 * 兼容旧接口名
 * @param {Buffer} buffer - 原始缓冲区
 * @param {number} offset - 起始偏移
 * @param {number} length - 总长度
 * @returns {BatchAddon[]} 解析后的扩展字段数组
 */
function parseBatchAddons(buffer, offset, length) {
    return TLVParser.parse(buffer, offset, length);
}

/**
 * 扩展元数据收集器
 * 用于统计和分析扩展字段使用情况
 */
class AddonCollector {
    constructor() {
        this.stats = new Map();  // type -> count
        this.totalParsed = 0;
    }

    /**
     * 记录一批扩展字段
     */
    record(addons) {
        for (const addon of addons) {
            const name = TLVParser.getTypeName(addon.type);
            this.stats.set(name, (this.stats.get(name) || 0) + 1);
            this.totalParsed++;
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            total: this.totalParsed,
            byType: Object.fromEntries(this.stats)
        };
    }

    /**
     * 重置统计
     */
    reset() {
        this.stats.clear();
        this.totalParsed = 0;
    }
}

module.exports = {
    BatchAddon,
    AddonType,
    AddonTypeName,
    TLVParser,
    parseBatchAddons,
    AddonCollector
};
