// ====================================================================
// 数据报转发（UDP）（兼容层）
// 已迁移至 core/datagram-forwarder.js
// 本文件保留向后兼容
// ====================================================================

const { createDatagramForwarder, createUdpForwarder, processPacketQueue } = require('./core/datagram-forwarder');

module.exports = {
    createUdpForwarder,  // 兼容旧接口
    createDatagramForwarder,
    processPacketQueue
};
