// ====================================================================
// dashboard 页面模块
// SyncFlow - 企业级库存同步平台
// 美化版：真实业务场景，零外部依赖
// ====================================================================

const { layout } = require('./shared');

// 页面缓存（30秒，减少CPU占用）
let _cachedHtml = null;
let _cacheTime = 0;
const CACHE_TTL = 30 * 1000; // 30秒

function renderDashboard(res) {
    // 检查缓存
    const now = Date.now();
    if (_cachedHtml && (now - _cacheTime) < CACHE_TTL) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=30' });
        res.end(_cachedHtml);
        return;
    }
    // 生成模拟数据
    const warehouses = [
        { id: 'WH-US-001', name: 'US East - New York', status: 'online', latency: 18, syncRate: 99.8 },
        { id: 'WH-US-002', name: 'US West - Los Angeles', status: 'online', latency: 24, syncRate: 99.5 },
        { id: 'WH-EU-001', name: 'EU Central - Frankfurt', status: 'online', latency: 32, syncRate: 99.9 },
        { id: 'WH-AP-001', name: 'AP South - Singapore', status: 'maintenance', latency: 0, syncRate: 0 },
        { id: 'WH-AP-002', name: 'AP East - Tokyo', status: 'online', latency: 15, syncRate: 99.7 }
    ];

    const activities = [
        { type: 'success', title: 'Full sync completed', target: 'US East - New York', time: '2 min ago', detail: '8,432 records synced' },
        { type: 'info', title: 'Delta sync started', target: 'EU Central - Frankfurt', time: '5 min ago', detail: 'In progress' },
        { type: 'warning', title: 'Warehouse entered maintenance', target: 'AP South - Singapore', time: '23 min ago', detail: 'Scheduled maintenance' },
        { type: 'info', title: 'Price adjustment synced', target: '3 warehouses', time: '1 hr ago', detail: '1,204 items updated' },
        { type: 'success', title: 'Inventory reconciliation passed', target: 'All warehouses', time: '2 hr ago', detail: '0 discrepancies found' }
    ];

    const activityIcons = {
        success: '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        info: '<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>',
        warning: '<svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
        error: '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
    };

    const activityColors = {
        success: 'bg-green-100',
        info: 'bg-blue-100',
        warning: 'bg-amber-100',
        error: 'bg-red-100'
    };

    const warehouseStatusColors = {
        online: 'bg-green-100 text-green-700',
        maintenance: 'bg-amber-100 text-amber-700',
        offline: 'bg-red-100 text-red-700'
    };

    // 生成24小时流量数据
    const trafficData = Array.from({length: 24}, (_, i) => Math.floor(Math.random() * 60) + 25);
    const maxTraffic = Math.max(...trafficData);

    const content = `
    <!-- 页面头部：欢迎区域 -->
    <div class="flex items-center justify-between mb-6">
        <div>
            <h1 class="text-2xl font-bold text-slate-800">Good morning, Admin</h1>
            <p class="text-slate-500 text-sm mt-1">Here's what's happening across your inventory network today.</p>
        </div>
        <div class="flex items-center gap-3">
            <button class="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export Report
            </button>
            <button class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                New Sync Job
            </button>
        </div>
    </div>

    <!-- 核心指标卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <!-- Total SKUs -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total SKUs</p>
                    <p class="text-3xl font-bold text-slate-800 mt-2" id="stat-skus">12,847</p>
                </div>
                <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                </div>
            </div>
            <div class="flex items-center gap-1 text-xs">
                <span class="text-green-600 font-semibold flex items-center gap-0.5">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                    3.2%
                </span>
                <span class="text-slate-400">from last week</span>
            </div>
        </div>

        <!-- Active Warehouses -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Warehouses</p>
                    <p class="text-3xl font-bold text-slate-800 mt-2">4 <span class="text-lg text-slate-400 font-normal">/ 5</span></p>
                </div>
                <div class="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                </div>
            </div>
            <div class="flex items-center gap-1 text-xs">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">
                    <span class="w-1.5 h-1.5 bg-amber-500 rounded-full pulse-dot"></span>
                    1 maintenance
                </span>
            </div>
        </div>

        <!-- Sync Success Rate -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sync Success Rate</p>
                    <p class="text-3xl font-bold text-slate-800 mt-2">99.7%</p>
                </div>
                <div class="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2">
                <div class="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full" style="width: 99.7%"></div>
            </div>
            <p class="text-xs text-slate-400 mt-2">Last 24 hours</p>
        </div>

        <!-- Avg Latency -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Latency</p>
                    <p class="text-3xl font-bold text-slate-800 mt-2" id="stat-latency">24 <span class="text-lg text-slate-400 font-normal">ms</span></p>
                </div>
                <div class="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
            </div>
            <div class="flex items-center gap-1 text-xs">
                <span class="text-green-600 font-semibold flex items-center gap-0.5">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
                    8% faster
                </span>
                <span class="text-slate-400">than avg</span>
            </div>
        </div>
    </div>

    <!-- 流量图表 + 活动流 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <!-- 流量图表 -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-5">
                <div>
                    <h2 class="font-semibold text-slate-800">Sync Traffic</h2>
                    <p class="text-xs text-slate-400 mt-0.5">Records synced per hour</p>
                </div>
                <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <button class="px-3 py-1 bg-white text-blue-700 rounded text-xs font-medium shadow-sm">24h</button>
                    <button class="px-3 py-1 text-slate-500 rounded text-xs font-medium hover:text-slate-700">7d</button>
                    <button class="px-3 py-1 text-slate-500 rounded text-xs font-medium hover:text-slate-700">30d</button>
                </div>
            </div>
            <!-- 面积图（纯CSS实现） -->
            <div class="relative h-48">
                <div class="absolute inset-0 flex items-end justify-between gap-1" id="traffic-chart">
                    ${trafficData.map((v, i) => `
                    <div class="flex-1 flex flex-col justify-end group relative" style="height: 100%">
                        <div class="bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer" style="height: ${(v / maxTraffic * 100)}%">
                            <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                ${(i * 4).toString().padStart(2, '0')}:00 - ${(v * 100).toLocaleString()} records
                            </div>
                        </div>
                    </div>
                    `).join('')}
                </div>
                <!-- 网格线 -->
                <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    <div class="border-b border-slate-100 border-dashed"></div>
                    <div class="border-b border-slate-100 border-dashed"></div>
                    <div class="border-b border-slate-100 border-dashed"></div>
                    <div class="border-b border-slate-100 border-dashed"></div>
                </div>
            </div>
            <div class="flex justify-between text-xs text-slate-400 mt-3">
                <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>Now</span>
            </div>
        </div>

        <!-- 活动流 -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-5">
                <h2 class="font-semibold text-slate-800">Recent Activity</h2>
                <span class="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <span class="w-2 h-2 bg-green-500 rounded-full pulse-dot"></span>
                    Live
                </span>
            </div>
            <div class="space-y-4" id="activity-feed">
                ${activities.map(a => `
                <div class="flex gap-3">
                    <div class="w-8 h-8 ${activityColors[a.type]} rounded-full flex items-center justify-center flex-shrink-0">
                        ${activityIcons[a.type]}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-700">${a.title} for <span class="font-medium">${a.target}</span></p>
                        <p class="text-xs text-slate-400 mt-0.5">${a.time} &middot; ${a.detail}</p>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
    </div>

    <!-- 仓库状态 + 同步任务 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <!-- 仓库状态概览 -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-4">
                <h2 class="font-semibold text-slate-800">Warehouse Status</h2>
                <a href="/warehouses" class="text-xs text-blue-600 hover:text-blue-700 font-medium">View all &rarr;</a>
            </div>
            <div class="space-y-3">
                ${warehouses.map(w => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full ${w.status === 'online' ? 'bg-green-500' : w.status === 'maintenance' ? 'bg-amber-500' : 'bg-red-500'} ${w.status === 'online' ? 'pulse-dot' : ''}"></div>
                        <div>
                            <p class="text-sm font-medium text-slate-700">${w.name}</p>
                            <p class="text-xs text-slate-400">${w.id}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${warehouseStatusColors[w.status]}">${w.status}</span>
                        ${w.status === 'online' ? `<p class="text-xs text-slate-400 mt-1">${w.latency}ms &middot; ${w.syncRate}%</p>` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
        </div>

        <!-- 最近同步任务 -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 class="font-semibold text-slate-800">Recent Sync Jobs</h2>
                <a href="/sync" class="text-sm text-blue-600 hover:text-blue-700 font-medium">View all &rarr;</a>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Job ID</th>
                            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source &rarr; Target</th>
                            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Records</th>
                        </tr>
                    </thead>
                    <tbody id="jobs-table" class="divide-y divide-slate-100">
                        <tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- 系统健康状态 -->
    <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-slate-800">System Health</h2>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                <span class="w-2 h-2 bg-green-500 rounded-full pulse-dot"></span>
                All Systems Operational
            </span>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="p-4 bg-slate-50 rounded-lg">
                <p class="text-xs text-slate-400 font-medium mb-1">API Response Time</p>
                <p class="text-xl font-bold text-slate-800">42 <span class="text-sm text-slate-400 font-normal">ms</span></p>
                <div class="w-full bg-slate-200 rounded-full h-1 mt-2">
                    <div class="bg-green-500 h-1 rounded-full" style="width: 85%"></div>
                </div>
            </div>
            <div class="p-4 bg-slate-50 rounded-lg">
                <p class="text-xs text-slate-400 font-medium mb-1">CPU Usage</p>
                <p class="text-xl font-bold text-slate-800">23 <span class="text-sm text-slate-400 font-normal">%</span></p>
                <div class="w-full bg-slate-200 rounded-full h-1 mt-2">
                    <div class="bg-green-500 h-1 rounded-full" style="width: 23%"></div>
                </div>
            </div>
            <div class="p-4 bg-slate-50 rounded-lg">
                <p class="text-xs text-slate-400 font-medium mb-1">Memory Usage</p>
                <p class="text-xl font-bold text-slate-800">128 <span class="text-sm text-slate-400 font-normal">MB</span></p>
                <div class="w-full bg-slate-200 rounded-full h-1 mt-2">
                    <div class="bg-blue-500 h-1 rounded-full" style="width: 33%"></div>
                </div>
            </div>
            <div class="p-4 bg-slate-50 rounded-lg">
                <p class="text-xs text-slate-400 font-medium mb-1">Active Connections</p>
                <p class="text-xl font-bold text-slate-800">47 <span class="text-sm text-slate-400 font-normal">/ 500</span></p>
                <div class="w-full bg-slate-200 rounded-full h-1 mt-2">
                    <div class="bg-blue-500 h-1 rounded-full" style="width: 9.4%"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function safeNum(val, decimals) {
            const n = Number(val);
            if (!isFinite(n)) return '0';
            return decimals !== undefined ? n.toFixed(decimals) : n.toLocaleString();
        }
        function safeStr(val) {
            return val == null ? '' : String(val);
        }
        // 从API加载同步任务
        fetch('/api/v1/sync/jobs?limit=6')
            .then(r => r.json())
            .then(data => {
                const tbody = document.getElementById('jobs-table');
                const statusColors = { completed: 'bg-green-100 text-green-700', in_progress: 'bg-blue-100 text-blue-700', pending: 'bg-slate-100 text-slate-600', failed: 'bg-red-100 text-red-700', retrying: 'bg-amber-100 text-amber-700' };
                const barColors = { completed: 'bg-green-500', in_progress: 'bg-blue-500', pending: 'bg-slate-400', failed: 'bg-red-500', retrying: 'bg-amber-500' };
                tbody.innerHTML = data.data.map(job => {
                    const st = safeStr(job.status);
                    const progress = job.status === 'completed' ? 100 : (Number.isFinite(Number(job.progress)) ? Number(job.progress) : Math.floor(Math.random() * 80));
                    return '<tr class="hover:bg-slate-50 transition-colors">' +
                        '<td class="px-5 py-3 font-mono text-xs text-slate-600">' + escapeHtml(job.jobId) + '</td>' +
                        '<td class="px-5 py-3 text-slate-700">' + escapeHtml(job.type).replace(/_/g, ' ') + '</td>' +
                        '<td class="px-5 py-3 text-slate-600 text-xs">' + escapeHtml(job.sourceWarehouse) + ' &rarr; ' + escapeHtml(job.targetWarehouse) + '</td>' +
                        '<td class="px-5 py-3"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ' + (statusColors[st] || 'bg-slate-100 text-slate-600') + '">' +
                        (st === 'in_progress' ? '<span class="w-1.5 h-1.5 bg-blue-500 rounded-full pulse-dot"></span>' : '') +
                        escapeHtml(st).replace(/_/g, ' ') + '</span></td>' +
                        '<td class="px-5 py-3"><div class="flex items-center gap-2"><div class="w-16 bg-slate-100 rounded-full h-1.5"><div class="' + (barColors[st] || 'bg-slate-400') + ' h-1.5 rounded-full" style="width:' + progress + '%"></div></div><span class="text-xs text-slate-500">' + progress + '%</span></div></td>' +
                        '<td class="px-5 py-3 text-slate-600">' + safeNum(job.recordsProcessed) + '</td>' +
                    '</tr>';
                }).join('');
            })
            .catch(() => {
                document.getElementById('jobs-table').innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">Unable to load jobs</td></tr>';
            });

        // 实时更新指标
        setInterval(() => {
            const skus = document.getElementById('stat-skus');
            if (skus) skus.textContent = (12847 + Math.floor(Math.random() * 20)).toLocaleString();
            const lat = document.getElementById('stat-latency');
            if (lat) lat.innerHTML = (Math.floor(Math.random() * 15) + 18) + ' <span class="text-lg text-slate-400 font-normal">ms</span>';
        }, 5000);
    </script>
    `;
    const html = layout('Dashboard', content, 'Dashboard');
    // 写入缓存
    _cachedHtml = html;
    _cacheTime = now;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=30' });
    res.end(html);
}

module.exports = { renderDashboard };
