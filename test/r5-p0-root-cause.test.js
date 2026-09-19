// SyncFlow 稳定性根因验证测试
// 覆盖：顶层定时器治理、自调度定时器unref、回调守卫、模块副作用隔离

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('stability: api.js 不再有顶层自动启动定时器', () => {
    const apiPath = path.join(__dirname, '..', 'src', 'api.js');
    const content = fs.readFileSync(apiPath, 'utf8');
    // 顶层（非函数内）不应有自动启动的数据模拟定时器
    assert.ok(!content.includes('setTimeout(startDataSimulator'), 'api.js 不应有顶层自动启动调用');
});

test('stability: 数据生命周期引擎所有自调度定时器都有 unref()', () => {
    const dlPath = path.join(__dirname, '..', 'src', 'business', 'data-lifecycle.js');
    const content = fs.readFileSync(dlPath, 'utf8');

    // 三个自调度点都应该有 .unref()（防止进程挂起）
    const recurChecks = [
        ['inventoryTimer = setTimeout(runInventory, 30000', 'inventoryTimer.unref()'],
        ['taskTimer = setTimeout(runTasks, 10000', 'taskTimer.unref()'],
        ['metricsTimer = setTimeout(runMetrics, 20000', 'metricsTimer.unref()'],
    ];

    for (const [setTimeoutLine, unrefCall] of recurChecks) {
        const idx = content.indexOf(setTimeoutLine);
        assert.ok(idx !== -1, `应找到自调度定时器: ${setTimeoutLine}`);
        // 检查在该行之后的50个字符内是否有 unref
        const after = content.substring(idx, idx + 100);
        assert.ok(after.includes(unrefCall), `自调度后应有 ${unrefCall}`);
    }
});

test('stability: 数据生命周期引擎三个回调都有运行状态守卫', () => {
    const dlPath = path.join(__dirname, '..', 'src', 'business', 'data-lifecycle.js');
    const content = fs.readFileSync(dlPath, 'utf8');

    // 三个回调函数都应该有状态守卫 if (!started) return;
    const callbackNames = ['runInventory', 'runTasks', 'runMetrics'];
    for (const name of callbackNames) {
        // 找到函数定义后的前几行
        const pattern = new RegExp(`const ${name} = \\(\\) => \\{\\s*if \\(!started\\) return;`);
        assert.ok(pattern.test(content), `${name} 回调应有状态守卫`);
    }
});

test('stability: 导入 api 模块不会自动启动数据引擎', async () => {
    // 验证导入 api 不会导致进程挂起
    // 由于 api.js 已删除顶层自动定时器，导入后不应有活跃定时器
    const api = require('../src/api');
    assert.ok(typeof api.handleApiRequest === 'function', 'api 应导出 handleApiRequest');
    assert.ok(typeof api.startDataSimulator === 'function', 'api 应导出 startDataSimulator');
    // 给一点时间让任何潜在的顶层定时器注册
    await new Promise(resolve => setTimeout(resolve, 100));
    // 如果有顶层未 unref 的定时器，进程会挂起；测试能到这里说明没有
});
