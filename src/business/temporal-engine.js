/**
 * 时间模式引擎（Temporal Pattern Engine）
 * 模拟真实企业的业务流量时间分布特征
 * 包括：工作日/周末模式、日内高峰低谷、节假日效应、特殊业务事件
 * 所有时间特征基于真实企业运营规律，用于驱动各模拟器的行为调整
 */

const logger = require('../logger');

// 企业运营时间段定义（模拟真实企业）
const BUSINESS_HOURS = {
    morningStart: 9,      // 上午上班时间
    morningEnd: 12,       // 上午下班时间
    afternoonStart: 14,   // 下午上班时间
    afternoonEnd: 18,     // 下午下班时间
};

// 日内活跃度曲线（基于真实企业办公规律）
// 0 = 完全空闲（深夜），1 = 最高峰（上午10点/下午3点）
function getHourlyActivity(hour) {
    // 深夜 0-6点：极低活跃度（只有定时任务）
    if (hour >= 0 && hour < 6) return 0.05 + Math.random() * 0.03;

    // 早晨 6-9点：逐渐上升（员工陆续上班）
    if (hour >= 6 && hour < 9) {
        const progress = (hour - 6) / 3;
        return 0.1 + progress * 0.5 + Math.random() * 0.05;
    }

    // 上午高峰 9-12点：高活跃度
    if (hour >= 9 && hour < 12) {
        // 10点左右达到最高峰
        const peakOffset = Math.abs(hour - 10.5);
        return 0.85 - peakOffset * 0.1 + Math.random() * 0.08;
    }

    // 午休 12-14点：中低活跃度
    if (hour >= 12 && hour < 14) {
        return 0.35 + Math.random() * 0.1;
    }

    // 下午高峰 14-18点：高活跃度
    if (hour >= 14 && hour < 18) {
        // 15-16点达到最高峰
        const peakOffset = Math.abs(hour - 15.5);
        return 0.88 - peakOffset * 0.08 + Math.random() * 0.07;
    }

    // 傍晚 18-21点：逐渐下降（员工陆续下班）
    if (hour >= 18 && hour < 21) {
        const progress = (hour - 18) / 3;
        return 0.6 - progress * 0.45 + Math.random() * 0.05;
    }

    // 夜间 21-24点：低活跃度（只有加班和定时任务）
    return 0.1 + Math.random() * 0.05;
}

// 工作日/周末系数
function getDayFactor(date) {
    const day = date.getDay(); // 0=周日, 6=周六

    // 周末：活跃度大幅降低
    if (day === 0 || day === 6) {
        return 0.15 + Math.random() * 0.1;
    }

    // 工作日
    return 1.0;
}

// 月度效应（月末/季末盘点，流量上升）
function getMonthlyFactor(date) {
    const day = date.getDate();
    const month = date.getMonth();

    // 月末最后3天：库存盘点，流量上升
    if (day >= 28) {
        return 1.15 + Math.random() * 0.1;
    }

    // 季末（3/6/9/12月）额外上升
    if ([2, 5, 8, 11].includes(month) && day >= 25) {
        return 1.2 + Math.random() * 0.1;
    }

    // 月初：系统初始化，流量略低
    if (day <= 3) {
        return 0.9 + Math.random() * 0.05;
    }

    return 1.0;
}

// 特殊业务事件（模拟真实企业的周期性事件）
const BUSINESS_EVENTS = [
    { name: 'weekly-inventory-check', day: 1, hour: 10, duration: 2, boost: 1.3 },  // 每周一上午盘点
    { name: 'weekly-report', day: 5, hour: 16, duration: 2, boost: 1.2 },              // 每周五下午周报
    { name: 'monthly-settlement', day: 28, hour: 9, duration: 4, boost: 1.4 },         // 月末结算
    { name: 'system-maintenance', day: 0, hour: 3, duration: 2, boost: 0.3 },          // 周日凌晨维护
];

function getEventBoost(date) {
    const day = date.getDay();
    const hour = date.getHours();

    for (const event of BUSINESS_EVENTS) {
        if (event.day === day && hour >= event.hour && hour < event.hour + event.duration) {
            return event.boost;
        }
    }
    return 1.0;
}

// 综合业务活跃度（0-1，1为最高峰）
function getBusinessActivity(date = new Date()) {
    const hour = date.getHours() + date.getMinutes() / 60;

    const hourly = getHourlyActivity(hour);
    const dayFactor = getDayFactor(date);
    const monthlyFactor = getMonthlyFactor(date);
    const eventBoost = getEventBoost(date);

    // 综合计算，限制在0-1.2之间
    const activity = Math.min(1.2, hourly * dayFactor * monthlyFactor * eventBoost);

    return {
        value: activity,
        level: activity > 0.7 ? 'high' : activity > 0.4 ? 'medium' : activity > 0.15 ? 'low' : 'idle',
        isWorkHour: hour >= 9 && hour < 18 && date.getDay() >= 1 && date.getDay() <= 5,
        isPeakHour: (hour >= 9.5 && hour <= 11.5) || (hour >= 14.5 && hour <= 16.5),
        isLunchBreak: hour >= 12 && hour < 14,
        isAfterHours: hour >= 18 || hour < 9,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        isMonthEnd: date.getDate() >= 28,
        hourly,
        dayFactor,
        monthlyFactor,
        eventBoost
    };
}

// 获取推荐的模拟器间隔（根据活跃度动态调整）
function getSimulatorInterval(baseInterval = 30000) {
    const activity = getBusinessActivity();
    // 活跃度越高，间隔越短（请求更频繁）
    const factor = 1.5 - activity.value * 0.8; // 0.7-1.5倍
    return Math.max(5000, baseInterval * factor);
}

// 获取推荐的并发用户数（根据活跃度动态调整）
function getActiveUserCount(baseMin = 2, baseMax = 5) {
    const activity = getBusinessActivity();
    const range = baseMax - baseMin;
    return Math.floor(baseMin + range * activity.value);
}

// 获取推荐的流量强度（0-1）
function getTrafficIntensity() {
    return getBusinessActivity().value;
}

// 时间模式引擎状态
let started = false;
let currentActivity = null;
let activityHistory = [];
let activityTimer = null;

// 启动时间模式引擎
function start() {
    if (started) return;
    started = true;

    // 每分钟更新一次活跃度
    const updateActivity = () => {
        currentActivity = getBusinessActivity();
        activityHistory.push({
            timestamp: Date.now(),
            value: currentActivity.value,
            level: currentActivity.level
        });
        // 只保留最近24小时的记录
        if (activityHistory.length > 1440) {
            activityHistory = activityHistory.slice(-1440);
        }
    };

    updateActivity();
    if (activityTimer) clearInterval(activityTimer);
    activityTimer = setInterval(updateActivity, 60000);
    if (activityTimer.unref) activityTimer.unref();

    logger.info('Temporal pattern engine started (business activity tracking)');
}

// 停止时间模式引擎
function stop() {
    if (!started) return;
    started = false;
    if (activityTimer) {
        clearInterval(activityTimer);
        activityTimer = null;
    }
    logger.info('Temporal pattern engine stopped');
}

// 获取当前活跃度
function getCurrentActivity() {
    return currentActivity || getBusinessActivity();
}

// 获取活跃度历史
function getActivityHistory() {
    return activityHistory;
}

// 获取时间模式指标（用于Prometheus）
function getMetrics() {
    const activity = getCurrentActivity();
    return {
        business_activity: parseFloat(activity.value.toFixed(4)),
        business_activity_level: activity.level === 'high' ? 3 : activity.level === 'medium' ? 2 : activity.level === 'low' ? 1 : 0,
        is_work_hour: activity.isWorkHour ? 1 : 0,
        is_peak_hour: activity.isPeakHour ? 1 : 0,
        is_lunch_break: activity.isLunchBreak ? 1 : 0,
        is_after_hours: activity.isAfterHours ? 1 : 0,
        is_weekend: activity.isWeekend ? 1 : 0,
        is_month_end: activity.isMonthEnd ? 1 : 0,
        hourly_activity: parseFloat(activity.hourly.toFixed(4)),
        day_factor: parseFloat(activity.dayFactor.toFixed(4)),
        monthly_factor: parseFloat(activity.monthlyFactor.toFixed(4))
    };
}

module.exports = {
    start,
    stop,
    getBusinessActivity,
    getCurrentActivity,
    getActivityHistory,
    getSimulatorInterval,
    getActiveUserCount,
    getTrafficIntensity,
    getMetrics
};
