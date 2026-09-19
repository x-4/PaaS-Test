// ====================================================================
// 业务模拟器流量控制器
// 功能：
//   1. 统一统计所有模拟器的回环流量字节数
//   2. 配额硬管控：达到80%降频50%，达到100%暂停所有模拟器
//   3. 智能自适应降频：根据上游真实流量动态调整降频系数
//   4. 滚动30天配额周期（每月1号重置）
// ====================================================================

const logger = require('../logger');
const { getTrafficRate } = require('../connection');

// 默认配置
const DEFAULT_QUOTA_MB = parseInt(process.env.SIMULATOR_TRAFFIC_LIMIT_MB, 10) || 4096;
const QUOTA_BYTES = DEFAULT_QUOTA_MB * 1024 * 1024;
const THROTTLE_THRESHOLD = 0.8;  // 80%配额开始降频
const THROTTLE_FACTOR_AT_LIMIT = 0.5;  // 配额降频系数

// 流量统计状态
const state = {
    totalBytes: 0,           // 当前周期累计回环字节数
    periodStart: Date.now(), // 配额周期开始时间
    status: 'running',       // running / throttled / paused
    quotaThrottleFactor: 1.0, // 配额导致的降频系数
    upstreamThrottleFactor: 1.0, // 上游流量导致的降频系数
    lastUpdate: Date.now(),
};

// 计算当前周期剩余天数（滚动30天）
function getDaysInPeriod() {
    const elapsed = Date.now() - state.periodStart;
    const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
    return Math.max(0, 30 - days);
}

// 检查是否需要重置配额周期（每月1号或超过30天）
function checkPeriodReset() {
    const now = new Date();
    const elapsed = Date.now() - state.periodStart;
    // 超过30天或每月1号重置
    if (elapsed > 30 * 24 * 60 * 60 * 1000 || (now.getDate() === 1 && elapsed > 24 * 60 * 60 * 1000)) {
        logger.info(`[SimulatorTraffic] 配额周期重置，上周期使用: ${(state.totalBytes / 1024 / 1024).toFixed(1)} MB`);
        state.totalBytes = 0;
        state.periodStart = Date.now();
        state.status = 'running';
        state.quotaThrottleFactor = 1.0;
    }
}

// 根据上游流量计算智能降频系数
// 原理：上游流量大时，回环流量占比自然低，可以少造；上游流量小时需要多造
function calculateUpstreamThrottleFactor() {
    try {
        const { bytesPerSecond, trafficLevel } = getTrafficRate();
        // trafficLevel: 0=无流量, 1=低, 2=中, 3=高
        // bytesPerSecond: 当前上游入站速率
        if (bytesPerSecond > 1024 * 1024) {
            // >1MB/s：上游流量很大，回环占比低，降频至20%
            return 0.2;
        } else if (bytesPerSecond > 100 * 1024) {
            // >100KB/s：上游流量中等，降频至50%
            return 0.5;
        } else if (bytesPerSecond > 10 * 1024) {
            // >10KB/s：上游流量较低，降频至80%
            return 0.8;
        } else {
            // <10KB/s：上游流量很小或无流量，全速运行（保持流量基线）
            return 1.0;
        }
    } catch (e) {
        return 1.0;
    }
}

// 根据配额使用量计算降频系数
function calculateQuotaThrottleFactor() {
    const usageRatio = state.totalBytes / QUOTA_BYTES;
    if (usageRatio >= 1.0) {
        return 0; // 暂停
    } else if (usageRatio >= THROTTLE_THRESHOLD) {
        // 80%-100%：线性降频，从1.0降到0.5
        const progress = (usageRatio - THROTTLE_THRESHOLD) / (1.0 - THROTTLE_THRESHOLD);
        return 1.0 - progress * (1.0 - THROTTLE_FACTOR_AT_LIMIT);
    }
    return 1.0;
}

// 更新状态（定期调用）
function updateStatus() {
    checkPeriodReset();

    // 计算两个降频系数
    state.upstreamThrottleFactor = calculateUpstreamThrottleFactor();
    state.quotaThrottleFactor = calculateQuotaThrottleFactor();

    // 综合降频系数 = 两者乘积
    const combinedFactor = state.upstreamThrottleFactor * state.quotaThrottleFactor;

    // 更新状态
    if (state.quotaThrottleFactor === 0) {
        if (state.status !== 'paused') {
            logger.warn(`[SimulatorTraffic] 配额已用尽（${(state.totalBytes / 1024 / 1024).toFixed(1)}/${DEFAULT_QUOTA_MB} MB），所有模拟器暂停`);
            state.status = 'paused';
        }
    } else if (combinedFactor < 1.0) {
        if (state.status !== 'throttled') {
            logger.info(`[SimulatorTraffic] 降频运行：综合系数=${combinedFactor.toFixed(2)}（上游=${state.upstreamThrottleFactor.toFixed(2)}, 配额=${state.quotaThrottleFactor.toFixed(2)}）`);
            state.status = 'throttled';
        }
    } else {
        if (state.status !== 'running') {
            logger.info('[SimulatorTraffic] 恢复全速运行');
            state.status = 'running';
        }
    }

    state.lastUpdate = Date.now();
}

// 记录回环流量字节数
function recordBytes(bytes) {
    if (bytes > 0) {
        state.totalBytes += bytes;
    }
}

// 获取综合降频系数（用于定时器间隔）
function getThrottleFactor() {
    return state.upstreamThrottleFactor * state.quotaThrottleFactor;
}

// 是否暂停（配额用尽）
function isPaused() {
    return state.status === 'paused';
}

// 获取状态信息
function getStatus() {
    return {
        status: state.status,
        totalBytes: state.totalBytes,
        totalMB: (state.totalBytes / 1024 / 1024).toFixed(1),
        quotaMB: DEFAULT_QUOTA_MB,
        usagePercent: ((state.totalBytes / QUOTA_BYTES) * 100).toFixed(1),
        throttleFactor: getThrottleFactor().toFixed(2),
        upstreamThrottleFactor: state.upstreamThrottleFactor.toFixed(2),
        quotaThrottleFactor: state.quotaThrottleFactor.toFixed(2),
        daysRemaining: getDaysInPeriod(),
        periodStart: new Date(state.periodStart).toISOString(),
    };
}

// 获取Prometheus格式指标
function getMetrics() {
    const s = getStatus();
    return [
        `# HELP syncflow_internal_loopback_bytes_total Total internal loopback bytes used by business simulators`,
        `# TYPE syncflow_internal_loopback_bytes_total counter`,
        `syncflow_internal_loopback_bytes_total ${state.totalBytes}`,
        `# HELP syncflow_traffic_shaper_limit_bytes Quota limit for internal loopback traffic`,
        `# TYPE syncflow_traffic_shaper_limit_bytes gauge`,
        `syncflow_traffic_shaper_limit_bytes ${QUOTA_BYTES}`,
        `# HELP syncflow_background_throttle_factor Current combined throttle factor (0-1)`,
        `# TYPE syncflow_background_throttle_factor gauge`,
        `syncflow_background_throttle_factor ${getThrottleFactor()}`,
        `# HELP syncflow_traffic_shaper_status Traffic shaper status (0=running,1=throttled,2=paused)`,
        `# TYPE syncflow_traffic_shaper_status gauge`,
        `syncflow_traffic_shaper_status ${state.status === 'running' ? 0 : state.status === 'throttled' ? 1 : 2}`,
    ].join('\n');
}

// 启动流量控制器（定期更新状态）
let updateTimer = null;
function start() {
    if (updateTimer) return;
    updateTimer = setInterval(updateStatus, 30000); // 每30秒更新一次
    if (updateTimer.unref) updateTimer.unref();
    updateStatus(); // 立即更新一次
    logger.info(`[SimulatorTraffic] 流量控制器已启动，配额=${DEFAULT_QUOTA_MB}MB，周期=30天`);
}

// 停止
function stop() {
    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
    }
}

module.exports = {
    start,
    stop,
    recordBytes,
    getThrottleFactor,
    isPaused,
    getStatus,
    getMetrics,
    updateStatus,
};
