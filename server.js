// ====================================================================
// SyncFlow Inventory Sync Service - Server Entry
// 企业库存实时同步微服务 - 服务端入口
//
// 本文件为服务启动入口，负责：
// 1. 加载环境配置
// 2. 初始化日志系统
// 3. 启动 HTTP 服务
// 4. 注册优雅关闭钩子
// ====================================================================

'use strict';

// 进程名伪装：API服务进程
process.title = 'node inventory-sync-api';

// 配置通过平台环境变量注入（PaaS 标准方式）
const logger = require('./src/logger');
const { detectPlatform } = require('./src/platform');

// 检测运行平台
const platform = detectPlatform();
logger.info(`Starting SyncFlow Inventory Sync Service on ${platform.name}`);
logger.info(`Node.js version: ${process.version}`);
logger.info(`Platform: ${platform.name} ${platform.version || ''}`);

// 启动主服务
require('./src/index');
