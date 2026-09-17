// ====================================================================
// 仓库节点数据中继（TCP）（兼容层）
// 已迁移至 core/stream-pipeline.js、core/outbound-connector.js、core/buffer-pool.js、core/backpressure-controller.js
// 本文件保留向后兼容，传输方式完全不变（完全透传）
// ====================================================================

const { createOutboundPipeline, createOutboundConnector } = require('./core/stream-pipeline');
const { isRetryableError, describeError } = require('./core/outbound-connector');

module.exports = {
    createOutboundConnector,  // 兼容旧接口
    createOutboundPipeline,
    isRetryableError,
    describeError
};
