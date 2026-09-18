// ====================================================================
// 企业级日志组件
// 支持文本/JSON 双格式、模块标签、请求 ID 追踪、错误堆栈、慢请求记录
// 生产环境默认 info 级别，避免高频同步 I/O 阻塞事件循环
// ====================================================================

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const LOG_FORMAT = (process.env.LOG_FORMAT || 'text').toLowerCase(); // text | json
const LOG_SENSITIVE = process.env.LOG_SENSITIVE === 'true'; // 默认 false，目标地址脱敏
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };

let currentLevel = LEVELS[LOG_LEVEL] !== undefined ? LEVELS[LOG_LEVEL] : LEVELS.info;

function shouldLog(level) {
    return LEVELS[level] <= currentLevel;
}

function timestamp() {
    return new Date().toISOString();
}

// 生成请求 ID（用于全链路追踪）
function generateRequestId() {
    return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
}

// 地址脱敏：默认隐藏目标地址，仅保留前 3 个字符
// 只有 LOG_SENSITIVE=true 时才返回完整地址（仅用于本地调试）
function maskAddress(host) {
    if (LOG_SENSITIVE) return host;
    if (!host) return 'unknown';
    if (host.length <= 4) return host[0] + '***';
    return host.substring(0, 3) + '***';
}

// 创建带模块标签的日志器
function forModule(moduleName) {
    return {
        error: (...args) => log('error', moduleName, null, ...args),
        warn:  (...args) => log('warn',  moduleName, null, ...args),
        info:  (...args) => log('info',  moduleName, null, ...args),
        debug: (...args) => log('debug', moduleName, null, ...args),
        trace: (...args) => log('trace', moduleName, null, ...args),
        // 带请求 ID 的日志
        withRequest: (requestId) => ({
            error: (...args) => log('error', moduleName, requestId, ...args),
            warn:  (...args) => log('warn',  moduleName, requestId, ...args),
            info:  (...args) => log('info',  moduleName, requestId, ...args),
            debug: (...args) => log('debug', moduleName, requestId, ...args),
        })
    };
}

// 核心日志函数
function log(level, module, requestId, ...args) {
    if (!shouldLog(level)) return;

    const ts = timestamp();
    const levelUpper = level.toUpperCase();

    if (LOG_FORMAT === 'json') {
        // 结构化 JSON 日志（生产环境标准，便于 ELK/Loki 等日志收集系统解析）
        const entry = {
            timestamp: ts,
            level: levelUpper,
            service: 'inventory-sync-service',
            version: process.env.npm_package_version || '1.0.0',
            pid: process.pid,
            hostname: require('os').hostname(),
            module: module || 'app',
            message: '',
            ...(requestId ? { requestId } : {})
        };

        // 处理参数：提取 Error 对象的堆栈，其余合并为消息
        const parts = [];
        for (const arg of args) {
            if (arg instanceof Error) {
                entry.error = { name: arg.name, message: arg.message, stack: arg.stack };
                parts.push(arg.message);
            } else if (typeof arg === 'object') {
                // 防止日志注入：用户对象放到 extra 字段，不覆盖核心字段
                if (!entry.extra) entry.extra = {};
                for (const key of Object.keys(arg)) {
                    // 禁止覆盖核心字段
                    if (!['timestamp', 'level', 'service', 'pid', 'message', 'requestId'].includes(key)) {
                        entry.extra[key] = arg[key];
                    }
                }
            } else {
                parts.push(String(arg));
            }
        }
        entry.message = parts.join(' ');

        const output = JSON.stringify(entry);
        if (level === 'error') console.error(output);
        else console.log(output);
    } else {
        // 文本格式（开发环境，人类可读）
        const prefix = `[${ts}] [${levelUpper}]` +
            (module ? ` [${module}]` : '') +
            (requestId ? ` [${requestId}]` : '');

        if (level === 'error') console.error(prefix, ...args);
        else if (level === 'warn') console.warn(prefix, ...args);
        else console.log(prefix, ...args);
    }
}

// 动态调整日志级别（运行时通过 API 调用）
function setLevel(level) {
    const l = level.toLowerCase();
    if (LEVELS[l] !== undefined) {
        currentLevel = LEVELS[l];
        log('warn', 'logger', null, `Log level changed to: ${l}`);
        return true;
    }
    return false;
}

function getLevel() {
    return Object.keys(LEVELS).find(k => LEVELS[k] === currentLevel) || 'info';
}

// 慢请求记录
function logSlowRequest(requestId, method, path, durationMs, thresholdMs = 1000) {
    if (durationMs > thresholdMs) {
        log('warn', 'access', requestId, `Slow request: ${method} ${path} took ${durationMs}ms (threshold: ${thresholdMs}ms)`);
    }
}

// 访问日志（nginx combined 格式 + 请求 ID）
function logAccess(requestId, method, path, statusCode, durationMs, bytes, userAgent, referer, remoteAddr) {
    const duration = `${durationMs}ms`;
    const ua = userAgent ? `"${userAgent}"` : '"-"';
    const ref = referer ? `"${referer}"` : '"-"';
    const addr = remoteAddr || '-';
    log('info', 'access', requestId, `${addr} - - [${new Date().toISOString()}] "${method} ${path} HTTP/1.1" ${statusCode} ${bytes} ${ref} ${ua} ${duration}`);
}

// 启动环境信息输出
function logStartupInfo(config) {
    log('info', 'startup', null, '=== Service Starting ===');
    log('info', 'startup', null, `Service: ${config.serviceName}`);
    log('info', 'startup', null, `Version: ${config.version}`);
    log('info', 'startup', null, `Port: ${config.port}`);
    log('info', 'startup', null, `Platform: ${config.platform}`);
    log('info', 'startup', null, `Node.js: ${process.version}`);
    log('info', 'startup', null, `Log level: ${getLevel()}`);
    log('info', 'startup', null, `Log format: ${LOG_FORMAT}`);
    log('info', 'startup', null, `Max connections: ${config.maxConnections}`);
    log('info', 'startup', null, `Idle timeout: ${config.idleTimeout}ms`);
    log('info', 'startup', null, `Memory limit: ${config.memoryLimitMB}MB`);
    log('info', 'startup', null, `Tenant ID: ${config.tenantId.substring(0, 8)}... (configured)`);
    log('info', 'startup', null, '========================');
}

const logger = {
    error: (...args) => log('error', null, null, ...args),
    warn:  (...args) => log('warn',  null, null, ...args),
    info:  (...args) => log('info',  null, null, ...args),
    debug: (...args) => log('debug', null, null, ...args),
    trace: (...args) => log('trace', null, null, ...args),
    forModule,
    generateRequestId,
    maskAddress,
    setLevel,
    getLevel,
    logSlowRequest,
    logAccess,
    logStartupInfo
};

module.exports = logger;
