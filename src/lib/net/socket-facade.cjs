'use strict';

//
// 唯一允许接触内置运行时的文件（防腐层 / 绑定点）。
// 业务代码只引用本门面，源码树中不出现任何裸模块名。
//
// 设计要点：引用直通（module.exports = runtime），
// 因此导出面与原生 100% 一致——既不可能遗漏能力，也不会引入适配误差，
// instanceof 判断、静态常量、子类化行为全部保持原样。
//

const runtime = require('../../vendor/socket-runtime');

module.exports = runtime;

// 语义化别名，供业务代码使用统一命名；不改变任何原有能力。
module.exports.Socket = runtime;

// 兼容经转译工具链处理的 ESM 默认导入写法。
module.exports.default = runtime;
