// ====================================================================
// 中间件管道（Middleware Pipeline）
// 数据/请求经过一系列中间件处理，每个中间件只负责一个小环节
// 核心逻辑分散在多个中间件中，单个中间件看不出整体用途
// ====================================================================

const { eventBus } = require('../event-bus');

// 中间件上下文对象，在中间件之间传递
class MiddlewareContext {
    constructor(initialData = {}) {
        Object.assign(this, initialData);
        this.stopped = false;
        this.error = null;
    }

    // 停止管道执行
    stop(reason = '') {
        this.stopped = true;
        this.stopReason = reason;
    }

    // 设置错误
    setError(err) {
        this.error = err;
        this.stopped = true;
    }
}

// 中间件管道
class MiddlewarePipeline {
    constructor(name = 'default') {
        this.name = name;
        this.middlewares = [];
    }

    // 添加中间件
    use(middleware) {
        if (typeof middleware === 'function') {
            this.middlewares.push({
                name: middleware.name || `anonymous_${this.middlewares.length}`,
                handler: middleware
            });
        } else if (middleware && typeof middleware.handle === 'function') {
            this.middlewares.push({
                name: middleware.name || middleware.constructor?.name || `anonymous_${this.middlewares.length}`,
                handler: middleware.handle.bind(middleware)
            });
        }
        return this;
    }

    // 执行管道
    async execute(initialContext = {}) {
        const ctx = new MiddlewareContext(initialContext);
        const startTime = Date.now();

        eventBus.emit(`pipeline:${this.name}:start`, { ctx, startTime });

        for (const mw of this.middlewares) {
            if (ctx.stopped) break;

            const mwStart = Date.now();
            eventBus.emit(`pipeline:${this.name}:before:${mw.name}`, { ctx, mwName: mw.name });

            try {
                await mw.handler(ctx, () => {});
            } catch (err) {
                ctx.setError(err);
                eventBus.emit(`pipeline:${this.name}:error:${mw.name}`, { ctx, error: err, mwName: mw.name });
                break;
            }

            const mwDuration = Date.now() - mwStart;
            eventBus.emit(`pipeline:${this.name}:after:${mw.name}`, { ctx, mwName: mw.name, durationMs: mwDuration });
        }

        const totalDuration = Date.now() - startTime;
        eventBus.emit(`pipeline:${this.name}:end`, { ctx, totalDurationMs: totalDuration, stopped: ctx.stopped });

        return ctx;
    }

    // 同步执行管道（用于不需要异步的场景）
    executeSync(initialContext = {}) {
        const ctx = new MiddlewareContext(initialContext);

        for (const mw of this.middlewares) {
            if (ctx.stopped) break;
            try {
                mw.handler(ctx, () => {});
            } catch (err) {
                ctx.setError(err);
                break;
            }
        }

        return ctx;
    }

    // 获取中间件列表
    getMiddlewares() {
        return this.middlewares.map(mw => mw.name);
    }
}

// 常用中间件工厂

// 日志中间件
function createLoggerMiddleware(logger, level = 'debug') {
    return function loggerMiddleware(ctx, next) {
        if (ctx.eventType) {
            logger[level](`[Pipeline] ${ctx.eventType}: ${ctx.description || ''}`);
        }
        next();
    };
}

// 计时中间件
function createTimingMiddleware(eventBus, eventName) {
    return function timingMiddleware(ctx, next) {
        const start = Date.now();
        next();
        const duration = Date.now() - start;
        if (eventName) {
            eventBus.emit(eventName, { durationMs: duration, ctx });
        }
        ctx.lastDurationMs = duration;
    };
}

// 错误处理中间件
function createErrorHandlerMiddleware(errorHandler) {
    return function errorHandlerMiddleware(ctx, next) {
        try {
            next();
        } catch (err) {
            if (errorHandler) {
                errorHandler(err, ctx);
            }
            ctx.setError(err);
        }
    };
}

module.exports = {
    MiddlewarePipeline,
    MiddlewareContext,
    createLoggerMiddleware,
    createTimingMiddleware,
    createErrorHandlerMiddleware
};
