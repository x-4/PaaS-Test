// ====================================================================
// 数据帧解析引擎（兼容层）
// 已迁移至 core/frame-header.js、core/address-resolver.js、core/addon-parser.js
// 本文件保留向后兼容
// ====================================================================

const { parseBatchHeader } = require('./core/frame-header');
const { resolveNodeEndpoint } = require('./core/address-resolver');
const { parseBatchAddons } = require('./core/addon-parser');

// 兼容旧接口名
function parseFrameHeader(buffer) {
    return parseBatchHeader(buffer);
}

function parseTargetAddress(formatType, buffer) {
    const endpoint = resolveNodeEndpoint(formatType, buffer, 0);
    return endpoint.address;
}

function parseAddons(buffer, offset, length) {
    return parseBatchAddons(buffer, offset, length);
}

module.exports = {
    parseTargetAddress,
    parseFrameHeader,
    parseAddons
};
