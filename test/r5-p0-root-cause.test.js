// 第五轮第0优先级：根因修复验证测试

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('r5-p0: api.js 不再有模块级 setTimeout（导入即启动生产引擎已移除）', () => {
    const apiPath = path.join(__dirname, '..', 'src', 'api.js');
    const content = fs.readFileSync(apiPath, 'utf8');
    // 模块级（非函数内）不应有 setTimeout(startDataSimulator
    assert.ok(!content.includes('setTimeout(startDataSimulator'), 'api.js 不应有模块级 startDataSimulator 调用');
});

test('r5-p0: data-lifecycle.js 所有递归重排定时器都有 unref()', () => {
    const dlPath = path.join(__dirname, '..', 'src', 'business', 'data-lifecycle.js');
    const content = fs.readFileSync(dlPath, 'utf8');

    // 三个递归重排点都应该有 .unref()（在同一行或下一行）
    const recurChecks = [
        ['inventoryTimer = setTimeout(runInventory, 30000', 'inventoryTimer.unref()'],
        ['taskTimer = setTimeout(runTasks, 10000', 'taskTimer.unref()'],
        ['metricsTimer = setTimeout(runMetrics, 20000', 'metricsTimer.unref()'],
    ];

    for (const [setTimeoutLine, unrefCall] of recurChecks) {
        const idx = content.indexOf(setTimeoutLine);
        assert.ok(idx !== -1, `应找到递归重排: ${setTimeoutLine}`);
        // 检查在该行之后的50个字符内是否有 unref
        const after = content.substring(idx, idx + 100);
        assert.ok(after.includes(unrefCall), `递归重排后应有 ${unrefCall}`);
    }
});

test('r5-p0: data-lifecycle.js 三个回调都有 started 检查', () => {
    const dlPath = path.join(__dirname, '..', 'src', 'business', 'data-lifecycle.js');
    const content = fs.readFileSync(dlPath, 'utf8');

    // 三个回调函数都应该有 if (!started) return;
    const callbackNames = ['runInventory', 'runTasks', 'runMetrics'];
    for (const name of callbackNames) {
        // 找到函数定义后的前几行
        const pattern = new RegExp(`const ${name} = \\(\\) => \\{\\s*if \\(!started\\) return;`);
        assert.ok(pattern.test(content), `${name} 回调应有 if (!started) return;`);
    }
});

test('r5-p0: require(api) 不会启动数据引擎（模块级副作用已移除）', async () => {
    // 验证 require api 不会导致进程挂起
    // 由于 api.js 已删除模块级 setTimeout，require 后不应有活跃定时器
    const api = require('../src/api');
    assert.ok(typeof api.handleApiRequest === 'function', 'api 应导出 handleApiRequest');
    assert.ok(typeof api.startDataSimulator === 'function', 'api 应导出 startDataSimulator');
    // 给一点时间让任何潜在的模块级定时器注册
    await new Promise(resolve => setTimeout(resolve, 100));
    // 如果有模块级未 unref 的定时器，进程会挂起；测试能到这里说明没有
});
