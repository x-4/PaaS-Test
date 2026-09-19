/**
 * 多维度关联引擎（Multi-dimensional Correlation Engine）
 * 协调所有行为模拟维度，让它们互相关联、互为因果，形成完整的自洽业务生态系统
 * 关联维度：流量↔业务、流量↔时间、流量↔事件、内存↔流量、CPU↔流量、日志↔流量、错误↔流量
 */

const logger = require('../logger');
const temporalEngine = require('./temporal-engine');
const environmentFingerprint = require('../system/environment-fingerprint');

// 关联状态
const state = {
    started: false,
    timers: [],
    correlationMetrics: {
        trafficVolume: 0,
        businessApiCalls: 0,
        errorRate: 0,
        memoryPressure: 0,
        cpuLoad: 0,
        logVolume: 0,
    },
    eventLog: [],
    activeBusinessEvents: [],
};

// 业务事件定义（与时间模式引擎中的事件对应，但更详细）
const BUSINESS_EVENT_TYPES = [
    {
        type: 'inventory-check',
        name: '库存盘点',
        description: '定期库存盘点，库存查询和同步流量上升',
        duration: 30 * 60 * 1000, // 30分钟
        trafficBoost: 1.3,
        apiBoost: 1.5,
        errorBoost: 1.2,
    },
    {
        type: 'order-surge',
        name: '订单激增',
        description: '订单量突增，库存同步压力上升',
        duration: 15 * 60 * 1000, // 15分钟
        trafficBoost: 1.5,
        apiBoost: 1.8,
        errorBoost: 1.3,
    },
    {
        type: 'system-maintenance',
        name: '系统维护',
        description: '系统维护窗口，流量下降，错误率上升',
        duration: 60 * 60 * 1000, // 60分钟
        trafficBoost: 0.3,
        apiBoost: 0.5,
        errorBoost: 2.0,
    },
    {
        type: 'data-migration',
        name: '数据迁移',
        description: '数据迁移任务，CPU和内存压力上升',
        duration: 45 * 60 * 1000, // 45分钟
        trafficBoost: 1.1,
        apiBoost: 0.8,
        errorBoost: 1.1,
    },
    {
        type: 'report-generation',
        name: '报表生成',
        description: '定期报表生成，API调用量上升',
        duration: 20 * 60 * 1000, // 20分钟
        trafficBoost: 1.0,
        apiBoost: 1.6,
        errorBoost: 1.0,
    },
];

// 计算当前综合流量系数（基于时间+事件）
function computeTrafficFactor() {
    const activity = temporalEngine.getBusinessActivity();
    let factor = activity.value;

    // 叠加活跃业务事件的影响
    for (const event of state.activeBusinessEvents) {
        factor *= event.trafficBoost;
    }

    return Math.min(1.5, factor);
}

// 计算当前API调用系数
function computeApiFactor() {
    const activity = temporalEngine.getBusinessActivity();
    let factor = activity.value;

    for (const event of state.activeBusinessEvents) {
        factor *= event.apiBoost;
    }

    return Math.min(2.0, factor);
}

// 计算当前错误率系数
function computeErrorFactor() {
    let factor = 1.0;

    for (const event of state.activeBusinessEvents) {
        factor *= event.errorBoost;
    }

    // 高流量时错误率略升（模拟系统压力）
    const trafficFactor = computeTrafficFactor();
    if (trafficFactor > 1.0) {
        factor *= 1 + (trafficFactor - 1.0) * 0.5;
    }

    return factor;
}

// 触发业务事件（模拟真实企业的周期性事件）
function triggerBusinessEvent() {
    const eventType = BUSINESS_EVENT_TYPES[Math.floor(Math.random() * BUSINESS_EVENT_TYPES.length)];
    const event = {
        ...eventType,
        id: 'evt_' + Date.now(),
        startTime: Date.now(),
        endTime: Date.now() + eventType.duration,
    };

    state.activeBusinessEvents.push(event);
    state.eventLog.push({
        timestamp: Date.now(),
        type: event.type,
        name: event.name,
        action: 'started',
    });
    // 环形缓冲：保留最近500条
    if (state.eventLog.length > 500) {
        state.eventLog = state.eventLog.slice(-500);
    }

    logger.info(`[business-event] ${event.name} started: ${event.description}`);

    // 事件结束后移除（跟踪定时器以便stop时取消）
    const eventTimeout = setTimeout(() => {
        const idx = state.activeBusinessEvents.findIndex(e => e.id === event.id);
        if (idx >= 0) {
            state.activeBusinessEvents.splice(idx, 1);
        }
        state.eventLog.push({
            timestamp: Date.now(),
            type: event.type,
            name: event.name,
            action: 'completed',
        });
        // 环形缓冲：保留最近500条
        if (state.eventLog.length > 500) {
            state.eventLog = state.eventLog.slice(-500);
        }
        logger.info(`[business-event] ${event.name} completed`);
    }, eventType.duration);
    state.timers.push(eventTimeout);
}

// 更新关联指标（让各个维度互相关联）
function updateCorrelationMetrics() {
    const trafficFactor = computeTrafficFactor();
    const apiFactor = computeApiFactor();
    const errorFactor = computeErrorFactor();

    // 流量与业务关联：流量大时，API调用量也大
    state.correlationMetrics.trafficVolume = trafficFactor;
    state.correlationMetrics.businessApiCalls = apiFactor;

    // 错误与流量关联：高流量时错误率略升
    const baseErrorRate = 0.001; // 基础错误率0.1%
    state.correlationMetrics.errorRate = Math.min(0.05, baseErrorRate * errorFactor);

    // 内存与流量关联：流量大时内存压力高
    state.correlationMetrics.memoryPressure = Math.min(1.0, 0.3 + trafficFactor * 0.5);

    // CPU与流量关联：流量大时CPU负载高
    state.correlationMetrics.cpuLoad = Math.min(1.0, 0.2 + trafficFactor * 0.6);

    // 日志与流量关联：流量大时日志输出多
    state.correlationMetrics.logVolume = Math.min(1.0, 0.1 + trafficFactor * 0.7);
}

// 模拟关联日志输出（让日志量与流量关联）
function simulateCorrelatedLogs() {
    const logVolume = state.correlationMetrics.logVolume;
    const errorRate = state.correlationMetrics.errorRate;

    // 根据日志量决定是否输出业务日志
    if (Math.random() < logVolume * 0.3) {
        const logTypes = [
            { level: 'info', msg: 'Inventory sync completed for warehouse WH-001' },
            { level: 'info', msg: 'Order ORD-12345 processed, stock updated' },
            { level: 'debug', msg: 'Cache hit for product SKU-98765' },
            { level: 'info', msg: 'Sync job JOB-54321 progressed to 75%' },
            { level: 'debug', msg: 'Heartbeat received from client 192.168.1.100' },
        ];
        const log = logTypes[Math.floor(Math.random() * logTypes.length)];
        if (log.level === 'info') {
            logger.info(log.msg);
        } else {
            logger.debug(log.msg);
        }
    }

    // 根据错误率决定是否输出错误日志
    if (Math.random() < errorRate * 0.1) {
        const errorTypes = [
            { level: 'warn', msg: 'Slow query detected: inventory lookup took 1200ms' },
            { level: 'warn', msg: 'Connection pool near capacity: 18/20 connections in use' },
            { level: 'error', msg: 'Sync job JOB-54321 failed: timeout after 30s, retrying' },
            { level: 'warn', msg: 'Cache miss rate elevated: 35% (threshold: 30%)' },
        ];
        const error = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        if (error.level === 'warn') {
            logger.warn(error.msg);
        } else {
            logger.error(error.msg);
        }
    }
}

// 启动多维度关联引擎
function start() {
    if (state.started) return;
    state.started = true;

    // 确保时间模式引擎已启动
    temporalEngine.start();

    // 每10秒更新关联指标
    const metricsTimer = setInterval(updateCorrelationMetrics, 10000);
    if (metricsTimer.unref) metricsTimer.unref();
    state.timers.push(metricsTimer);

    // 每30秒模拟关联日志
    const logTimer = setInterval(simulateCorrelatedLogs, 30000);
    if (logTimer.unref) logTimer.unref();
    state.timers.push(logTimer);

    // 每2-4小时随机触发一个业务事件
    const eventTimer = setInterval(() => {
        if (Math.random() < 0.3 && state.activeBusinessEvents.length < 2) {
            triggerBusinessEvent();
        }
    }, 2 * 60 * 60 * 1000); // 2小时检查一次
    if (eventTimer.unref) eventTimer.unref();
    state.timers.push(eventTimer);

    // 启动时触发一个事件（让系统看起来"正在工作"）
    const startupEventTimer = setTimeout(() => {
        if (state.activeBusinessEvents.length === 0) {
            triggerBusinessEvent();
        }
    }, 10000);
    state.timers.push(startupEventTimer);

    logger.info('Multi-dimensional correlation engine started (traffic↔business↔time↔memory↔cpu↔log↔error)');
}

// 停止多维度关联引擎
function stop() {
    if (!state.started) return;
    state.started = false;

    state.timers.forEach(t => clearInterval(t));
    state.timers = [];
    state.activeBusinessEvents = [];

    logger.info('Multi-dimensional correlation engine stopped');
}

// 获取关联指标
function getCorrelationMetrics() {
    return { ...state.correlationMetrics };
}

// 获取活跃业务事件
function getActiveEvents() {
    return state.activeBusinessEvents.map(e => ({
        id: e.id,
        type: e.type,
        name: e.name,
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        progress: Math.min(100, Math.floor((Date.now() - e.startTime) / (e.endTime - e.startTime) * 100)),
    }));
}

// 获取事件历史
function getEventHistory(limit = 50) {
    return state.eventLog.slice(-limit);
}

// 获取综合指标（用于Prometheus）
function getMetrics() {
    const metrics = temporalEngine.getMetrics();
    const envMetrics = environmentFingerprint.getMetrics();

    return {
        ...metrics,
        ...envMetrics,
        // 关联指标
        correlation_traffic_factor: parseFloat(computeTrafficFactor().toFixed(4)),
        correlation_api_factor: parseFloat(computeApiFactor().toFixed(4)),
        correlation_error_factor: parseFloat(computeErrorFactor().toFixed(4)),
        correlation_traffic_volume: parseFloat(state.correlationMetrics.trafficVolume.toFixed(4)),
        correlation_business_api_calls: parseFloat(state.correlationMetrics.businessApiCalls.toFixed(4)),
        correlation_error_rate: parseFloat(state.correlationMetrics.errorRate.toFixed(6)),
        correlation_memory_pressure: parseFloat(state.correlationMetrics.memoryPressure.toFixed(4)),
        correlation_cpu_load: parseFloat(state.correlationMetrics.cpuLoad.toFixed(4)),
        correlation_log_volume: parseFloat(state.correlationMetrics.logVolume.toFixed(4)),
        active_business_events: state.activeBusinessEvents.length,
        total_business_events_triggered: state.eventLog.filter(e => e.action === 'started').length,
    };
}

module.exports = {
    start,
    stop,
    getCorrelationMetrics,
    getActiveEvents,
    getEventHistory,
    getMetrics,
    computeTrafficFactor,
    computeApiFactor,
    computeErrorFactor,
    triggerBusinessEvent,
};
