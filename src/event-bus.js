// ====================================================================
// 事件总线（EventBus）
// 模块间松耦合通信中心，发布/订阅模式
// 消除模块间直接 require 依赖，静态分析无法追踪调用链
// ====================================================================

class EventBus {
    constructor() {
        this.listeners = new Map(); // eventName -> Set<callback>
        this.onceListeners = new Map(); // eventName -> Set<callback>
        this.eventHistory = []; // 事件历史（用于调试/监控）
        this.maxHistorySize = 1000;
    }

    // 订阅事件
    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(callback);
        return this;
    }

    // 订阅一次事件
    once(eventName, callback) {
        if (!this.onceListeners.has(eventName)) {
            this.onceListeners.set(eventName, new Set());
        }
        this.onceListeners.get(eventName).add(callback);
        return this;
    }

    // 取消订阅
    off(eventName, callback) {
        if (this.listeners.has(eventName)) {
            this.listeners.get(eventName).delete(callback);
        }
        if (this.onceListeners.has(eventName)) {
            this.onceListeners.get(eventName).delete(callback);
        }
        return this;
    }

    // 发布事件
    emit(eventName, ...args) {
        // 记录事件历史
        this.eventHistory.push({
            event: eventName,
            timestamp: Date.now(),
            argsCount: args.length
        });
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        // 执行普通订阅者
        if (this.listeners.has(eventName)) {
            for (const callback of this.listeners.get(eventName)) {
                try {
                    callback(...args);
                } catch (err) {
                    // 单个订阅者错误不影响其他订阅者
                    console.error(`[EventBus] Error in listener for '${eventName}':`, err.message);
                }
            }
        }

        // 执行 once 订阅者（执行后移除）
        if (this.onceListeners.has(eventName)) {
            const callbacks = this.onceListeners.get(eventName);
            for (const callback of callbacks) {
                try {
                    callback(...args);
                } catch (err) {
                    console.error(`[EventBus] Error in once listener for '${eventName}':`, err.message);
                }
            }
            this.onceListeners.delete(eventName);
        }

        return this;
    }

    // 获取某事件的订阅者数量
    listenerCount(eventName) {
        const regular = this.listeners.has(eventName) ? this.listeners.get(eventName).size : 0;
        const once = this.onceListeners.has(eventName) ? this.onceListeners.get(eventName).size : 0;
        return regular + once;
    }

    // 获取所有事件名
    eventNames() {
        return [...new Set([...this.listeners.keys(), ...this.onceListeners.keys()])];
    }

    // 清除所有订阅
    clear() {
        this.listeners.clear();
        this.onceListeners.clear();
        this.eventHistory = [];
        return this;
    }

    // 获取统计信息
    getStats() {
        return {
            totalEvents: this.eventNames().length,
            totalListeners: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
            eventHistorySize: this.eventHistory.length,
            recentEvents: this.eventHistory.slice(-10).map(e => e.event)
        };
    }
}

// 全局单例
const eventBus = new EventBus();

module.exports = { eventBus, EventBus };
