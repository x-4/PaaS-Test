// ====================================================================
// 节点地址解析器
// 企业库存同步协议 - 目标仓库节点地址解码
// 支持 IPv4 / 主机名 / IPv6 三种地址格式
// ====================================================================

/**
 * 仓库节点端点类
 * 封装目标节点地址信息，提供统一的访问接口
 */
class NodeEndpoint {
    constructor(address, port, formatType) {
        this.address = address;
        this.port = port;
        this.formatType = formatType;  // 1=IPv4, 3=主机名, 4=IPv6
        this.resolvedAt = Date.now();
    }

    /**
     * 是否为 IPv4 地址
     */
    get isIPv4() {
        return this.formatType === 1;
    }

    /**
     * 是否为主机名
     */
    get isHostname() {
        return this.formatType === 3;
    }

    /**
     * 是否为 IPv6 地址
     */
    get isIPv6() {
        return this.formatType === 4;
    }

    /**
     * 获取完整的 host:port 格式
     */
    get hostPort() {
        return `${this.address}:${this.port}`;
    }

    /**
     * 获取用于连接的选项
     */
    toConnectOptions() {
        return {
            host: this.address,
            port: this.port,
            family: this.isIPv6 ? 6 : 4
        };
    }

    /**
     * 转换为日志格式（脱敏）
     */
    toMaskedFormat() {
        const masked = this.address.length > 3
            ? this.address.substring(0, 3) + '***'
            : '***';
        return `${masked}:${this.port}`;
    }

    /**
     * 转换为 JSON
     */
    toJSON() {
        return {
            address: this.address,
            port: this.port,
            type: this.isIPv4 ? 'ipv4' : this.isHostname ? 'hostname' : 'ipv6',
            resolvedAt: new Date(this.resolvedAt).toISOString()
        };
    }
}

/**
 * 节点地址格式常量
 */
const AddressFormat = {
    IPv4: 1,
    HOSTNAME: 3,
    IPv6: 4
};

/**
 * 解析 IPv4 地址
 * @param {Buffer} buffer - 4字节 IPv4 地址
 * @returns {string} 点分十进制格式
 */
function parseIPv4(buffer) {
    return `${buffer[0]}.${buffer[1]}.${buffer[2]}.${buffer[3]}`;
}

/**
 * 解析主机名
 * @param {Buffer} buffer - 主机名字节
 * @returns {string} UTF-8 主机名
 */
function parseHostname(buffer) {
    return buffer.toString('utf8');
}

/**
 * 解析 IPv6 地址
 * @param {Buffer} buffer - 16字节 IPv6 地址
 * @returns {string} 冒号十六进制格式
 */
function parseIPv6(buffer) {
    const groups = [];
    for (let i = 0; i < 8; i++) {
        groups.push(((buffer[i * 2] << 8) | buffer[i * 2 + 1]).toString(16));
    }
    return groups.join(':');
}

/**
 * 根据格式类型解析目标节点地址
 * @param {number} formatType - 地址格式类型
 * @param {Buffer} buffer - 地址数据
 * @param {number} port - 目标端口
 * @returns {NodeEndpoint} 节点端点对象
 */
function resolveNodeEndpoint(formatType, buffer, port) {
    let address;

    switch (formatType) {
        case AddressFormat.IPv4:
            address = parseIPv4(buffer);
            break;
        case AddressFormat.HOSTNAME:
            address = parseHostname(buffer);
            break;
        case AddressFormat.IPv6:
            address = parseIPv6(buffer);
            break;
        default:
            address = parseHostname(buffer);
    }

    return new NodeEndpoint(address, port, formatType);
}

/**
 * 端点验证器
 * 验证节点地址的合法性
 */
class EndpointValidator {
    /**
     * 验证是否为保留地址（内网/回环等）
     */
    static isReserved(address) {
        if (!address) return true;
        const reservedPatterns = [
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[01])\./,
            /^192\.168\./,
            /^127\./,
            /^0\./,
            /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./,
            /^169\.254\./,
            /^::1$/,
            /^fe80:/i,
            /^fc00:/i
        ];
        return reservedPatterns.some(pattern => pattern.test(address));
    }

    /**
     * 验证端口是否在有效范围内
     */
    static isValidPort(port) {
        return Number.isInteger(port) && port > 0 && port <= 65535;
    }

    /**
     * 完整验证端点
     */
    static validate(endpoint) {
        return endpoint &&
               endpoint.address &&
               this.isValidPort(endpoint.port) &&
               !this.isReserved(endpoint.address);
    }
}

module.exports = {
    NodeEndpoint,
    AddressFormat,
    parseIPv4,
    parseHostname,
    parseIPv6,
    resolveNodeEndpoint,
    EndpointValidator
};
