// ====================================================================
// 企业级日志组件
// 生产环境默认 info 级别，避免高频同步 I/O 阻塞事件循环
// ====================================================================

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level) {
    return LEVELS[level] <= (LEVELS[LOG_LEVEL] !== undefined ? LEVELS[LOG_LEVEL] : LEVELS.info);
}

function timestamp() {
    return new Date().toISOString();
}

const logger = {
    error: (...args) => { if (shouldLog('error')) console.error(`[${timestamp()}] [ERROR]`, ...args); },
    warn:  (...args) => { if (shouldLog('warn'))  console.warn(`[${timestamp()}] [WARN]`,  ...args); },
    info:  (...args) => { if (shouldLog('info'))  console.log(`[${timestamp()}] [INFO]`,   ...args); },
    debug: (...args) => { if (shouldLog('debug')) console.log(`[${timestamp()}] [DEBUG]`,  ...args); }
};

module.exports = logger;
