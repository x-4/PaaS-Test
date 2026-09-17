// ====================================================================
// SyncFlow Inventory Sync Service - Main Entry
// 企业库存实时同步微服务 - 主程序入口
//
// 本文件为命令行启动入口，支持参数解析和多环境配置
// ====================================================================

'use strict';

// 命令行参数解析
const args = process.argv.slice(2);
const options = {
    port: null,
    env: null,
    config: null,
    help: false
};

for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
        case '--port':
        case '-p':
            options.port = args[++i];
            break;
        case '--env':
        case '-e':
            options.env = args[++i];
            break;
        case '--config':
        case '-c':
            options.config = args[++i];
            break;
        case '--help':
        case '-h':
            options.help = true;
            break;
    }
}

// 显示帮助信息
if (options.help) {
    console.log(`
SyncFlow Inventory Sync Service v1.0.0

Usage: node main.js [options]

Options:
  -p, --port <port>     Set the server port (default: 3000)
  -e, --env <env>       Set the environment (development, production)
  -c, --config <path>   Path to config file
  -h, --help            Show this help message

Examples:
  node main.js --port 8080
  node main.js --env production
  node main.js -p 8080 -e production
`);
    process.exit(0);
}

// 应用命令行参数
if (options.port) {
    process.env.PORT = options.port;
}
if (options.env) {
    process.env.NODE_ENV = options.env;
}

// 启动应用
const { app } = require('./app');

app.start().catch((err) => {
    console.error('Failed to start SyncFlow application:', err);
    process.exit(1);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down...');
    app.stop().then(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    app.stop().then(() => process.exit(0));
});
