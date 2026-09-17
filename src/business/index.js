// ====================================================================
// 业务模块统一导出
// SyncFlow 企业库存同步平台 - 业务逻辑入口
// ====================================================================

const constants = require('./constants');
const models = require('./models');
const rules = require('./rules');
const algorithms = require('./algorithms');
const metrics = require('./metrics');

module.exports = {
    ...constants,
    ...models,
    ...rules,
    ...algorithms,
    ...metrics,
    // 命名空间导出
    constants,
    models,
    rules,
    algorithms,
    metrics
};
