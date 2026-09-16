// ====================================================================
// 数据帧解析引擎
// 负责企业库存同步协议的帧头解析与目标节点地址解码
// ====================================================================

const { verifyTenantSignature } = require('./auth');

// 解析目标节点地址（IPv4 / 主机名 / IPv6）
function parseTargetAddress(formatType, buffer) {
    if (formatType === 1) return `${buffer[0]}.${buffer[1]}.${buffer[2]}.${buffer[3]}`;
    if (formatType === 3) return buffer.toString('utf8');
    const ipv6 = [];
    for (let i = 0; i < 8; i++) {
        ipv6.push(((buffer[i * 2] << 8) | buffer[i * 2 + 1]).toString(16));
    }
    return ipv6.join(':');
}

// 解析附加信息层（TLV 格式：Type 1B + Length 1B + Value）
function parseAddons(buffer, offset, length) {
    const addons = [];
    let pos = offset;
    const end = offset + length;

    while (pos < end) {
        if (pos + 2 > end) break;
        const type = buffer[pos];
        const len = buffer[pos + 1];
        if (pos + 2 + len > end) break;
        const value = buffer.subarray(pos + 2, pos + 2 + len);
        addons.push({ type, length: len, value });
        pos += 2 + len;
    }

    return addons;
}

// 解析二进制增量数据帧头
function parseFrameHeader(buffer) {
    if (buffer.length < 24 || !verifyTenantSignature(buffer)) return null;

    const addonsLength = buffer[17];
    const syncMode = buffer[18 + addonsLength];
    const targetPort = (buffer[19 + addonsLength] << 8) | buffer[20 + addonsLength];

    let addrFormat = buffer[21 + addonsLength];
    if (addrFormat !== 1) addrFormat += 1;

    let addrLen = 0;
    let addrOffset = 22 + addonsLength;

    if (addrFormat === 3) {
        addrLen = buffer[addrOffset];
        addrOffset++;
    } else if (addrFormat === 1) {
        addrLen = 4;
    } else if (addrFormat === 4) {
        addrLen = 16;
    }

    const dataOffset = addrOffset + addrLen;
    if (dataOffset > buffer.length) return null;

    // 解析附加信息（当前仅解析不处理，保留扩展能力）
    const addons = addonsLength > 0 ? parseAddons(buffer, 18, addonsLength) : [];

    return {
        syncMode,
        addrFormat,
        targetPort,
        targetEndpoint: buffer.subarray(addrOffset, dataOffset),
        dataOffset,
        addons
    };
}

module.exports = { parseTargetAddress, parseFrameHeader, parseAddons };
