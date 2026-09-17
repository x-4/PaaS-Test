// ====================================================================
// 前端页面模块
// 完整的企业级 Web 控制台：仪表盘、登录、库存、仓库、同步、设置、文档、关于
// 品牌：SyncFlow - 企业级库存同步平台
// ====================================================================

const PRODUCT_NAME = 'SyncFlow';
const PRODUCT_VERSION = '1.0.0';
const PRODUCT_TAGLINE = 'Enterprise Inventory Synchronization Platform';

// ---- 共享布局 ----
function layout(title, content, activeNav) {
    const navItems = [
        { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { path: '/inventory', label: 'Inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
        { path: '/warehouses', label: 'Warehouses', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { path: '/sync', label: 'Sync Jobs', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
        { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
        { path: '/docs', label: 'API Docs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        { path: '/about', label: 'About', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
    ];

    const navHtml = navItems.map(item => `
        <a href="${item.path}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeNav === item.label ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"/></svg>
            ${item.label}
        </a>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} | ${PRODUCT_NAME}</title>
    <meta name="description" content="${PRODUCT_TAGLINE}">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
    </script>
    <script defer src="/_vercel/speed-insights/script.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .sidebar { width: 240px; }
        .main-content { margin-left: 240px; }
        @media (max-width: 768px) { .sidebar { display: none; } .main-content { margin-left: 0; } }
        .fade-in { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-dot { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    </style>
</head>
<body class="bg-slate-50 min-h-screen">
    <!-- Sidebar -->
    <aside class="sidebar fixed inset-y-0 left-0 bg-white border-r border-slate-200 flex flex-col z-30">
        <div class="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
            <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </div>
            <div>
                <div class="font-bold text-slate-800 text-base">${PRODUCT_NAME}</div>
                <div class="text-xs text-slate-400">v${PRODUCT_VERSION}</div>
            </div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            ${navHtml}
        </nav>
        <div class="px-3 py-4 border-t border-slate-100">
            <div class="flex items-center gap-3 px-3 py-2">
                <div class="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600">A</div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-slate-700 truncate">Admin</div>
                    <div class="text-xs text-slate-400 truncate">Enterprise Plan</div>
                </div>
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </div>
        </div>
    </aside>

    <!-- Main Content -->
    <div class="main-content">
        <!-- Top Bar -->
        <header class="bg-white border-b border-slate-200 sticky top-0 z-20">
            <div class="flex items-center justify-between px-8 py-3.5">
                <div class="flex items-center gap-4 flex-1 max-w-xl">
                    <div class="relative flex-1">
                        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input type="text" placeholder="Search inventory, warehouses, jobs..." class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <button class="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                        <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full pulse-dot"></span>
                    </button>
                    <div class="h-6 w-px bg-slate-200"></div>
                    <div class="flex items-center gap-2">
                        <span class="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-xs font-semibold text-green-700">
                            <span class="w-1.5 h-1.5 bg-green-500 rounded-full pulse-dot"></span>
                            All Systems Operational
                        </span>
                    </div>
                </div>
            </div>
        </header>

        <!-- Page Content -->
        <main class="p-8 fade-in">
            ${content}
        </main>

        <!-- Footer -->
        <footer class="px-8 py-4 border-t border-slate-200 bg-white">
            <div class="flex items-center justify-between text-xs text-slate-400">
                <div>&copy; 2026 ${PRODUCT_NAME} Inc. All rights reserved.</div>
                <div class="flex items-center gap-4">
                    <a href="/docs" class="hover:text-slate-600 transition-colors">Documentation</a>
                    <a href="/about" class="hover:text-slate-600 transition-colors">About</a>
                    <span>v${PRODUCT_VERSION}</span>
                </div>
            </div>
        </footer>
    </div>

    <!-- 实时数据刷新（模拟企业级监控仪表盘） -->
    <script>
    (function() {
        // 仅在仪表盘页面启用实时刷新
        const isDashboard = document.querySelector('.stat-card') || document.querySelector('[data-metric]');
        if (!isDashboard) return;

        function formatNumber(n) {
            if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
            return n.toString();
        }

        function updateMetrics() {
            fetch('/api/v1/metrics')
                .then(r => r.json())
                .then(data => {
                    const m = data.metrics || {};
                    document.querySelectorAll('[data-metric]').forEach(el => {
                        const key = el.getAttribute('data-metric');
                        if (m[key] !== undefined) {
                            let value = m[key];
                            const decimals = el.getAttribute('data-decimals');
                            const suffix = el.getAttribute('data-suffix') || '';
                            if (decimals) {
                                value = parseFloat(value).toFixed(parseInt(decimals));
                            }
                            el.textContent = value + suffix;
                            el.style.transition = 'color 0.3s';
                            el.style.color = '#2563eb';
                            setTimeout(() => { el.style.color = ''; }, 300);
                        }
                    });
                })
                .catch(() => {});
        }

        // 每 5 秒刷新一次
        setInterval(updateMetrics, 5000);
        // 页面加载后立即刷新一次
        setTimeout(updateMetrics, 1000);
    })();
    </script>
</body>
</html>`;
}

// ---- 仪表盘页面 ----
function renderDashboard(res) {
    const content = `
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p class="text-slate-500 text-sm mt-1">Real-time overview of your inventory synchronization network</p>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total SKUs</span>
                <div class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                </div>
            </div>
            <div class="text-3xl font-bold text-slate-800" id="stat-skus">12,847</div>
            <div class="text-xs text-green-600 font-medium mt-1">&uarr; 3.2% from last week</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Warehouses</span>
                <div class="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                </div>
            </div>
            <div class="text-3xl font-bold text-slate-800" id="stat-warehouses">4 / 5</div>
            <div class="text-xs text-slate-500 font-medium mt-1">1 under maintenance</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sync Success Rate</span>
                <div class="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
            </div>
            <div class="text-3xl font-bold text-slate-800" data-metric="successPercent" data-suffix="%" data-decimals="1">99.7%</div>
            <div class="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div class="bg-emerald-500 h-1.5 rounded-full" style="width: 99.7%"></div>
            </div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Latency</span>
                <div class="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
            </div>
            <div class="text-3xl font-bold text-slate-800" data-metric="avgSyncLatencyMs" data-suffix=" ms">24 ms</div>
            <div class="text-xs text-green-600 font-medium mt-1">&darr; 8% faster than avg</div>
        </div>
    </div>

    <!-- Charts + Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <!-- Traffic Chart -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-4">
                <h2 class="font-semibold text-slate-800">Sync Traffic</h2>
                <div class="flex items-center gap-2 text-xs">
                    <button class="px-2.5 py-1 bg-blue-50 text-blue-700 rounded font-medium">24h</button>
                    <button class="px-2.5 py-1 text-slate-500 hover:bg-slate-50 rounded font-medium">7d</button>
                    <button class="px-2.5 py-1 text-slate-500 hover:bg-slate-50 rounded font-medium">30d</button>
                </div>
            </div>
            <div class="h-48 flex items-end justify-between gap-1" id="traffic-chart">
                <!-- Bars generated by JS -->
            </div>
            <div class="flex justify-between text-xs text-slate-400 mt-2">
                <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>Now</span>
            </div>
        </div>

        <!-- Activity Feed -->
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 class="font-semibold text-slate-800 mb-4">Recent Activity</h2>
            <div class="space-y-4" id="activity-feed">
                <div class="flex gap-3">
                    <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-700">Full sync completed for <span class="font-medium">US-East</span></p>
                        <p class="text-xs text-slate-400 mt-0.5">2 min ago &middot; 8,432 records</p>
                    </div>
                </div>
                <div class="flex gap-3">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-700">Delta sync started for <span class="font-medium">EU-Central</span></p>
                        <p class="text-xs text-slate-400 mt-0.5">5 min ago &middot; In progress</p>
                    </div>
                </div>
                <div class="flex gap-3">
                    <div class="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-700">AP-South warehouse entered maintenance</p>
                        <p class="text-xs text-slate-400 mt-0.5">23 min ago</p>
                    </div>
                </div>
                <div class="flex gap-3">
                    <div class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-700">Price adjustment synced across 3 warehouses</p>
                        <p class="text-xs text-slate-400 mt-0.5">1 hr ago &middot; 1,204 items</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Recent Sync Jobs -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 class="font-semibold text-slate-800">Recent Sync Jobs</h2>
            <a href="/sync" class="text-sm text-blue-600 hover:text-blue-700 font-medium">View all &rarr;</a>
        </div>
        <table class="w-full text-sm">
            <thead class="bg-slate-50">
                <tr>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Job ID</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source &rarr; Target</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Records</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                </tr>
            </thead>
            <tbody id="jobs-table" class="divide-y divide-slate-100">
                <!-- Populated by JS -->
            </tbody>
        </table>
    </div>

    <script>
        // Generate traffic chart bars
        const chart = document.getElementById('traffic-chart');
        for (let i = 0; i < 24; i++) {
            const h = Math.floor(Math.random() * 60) + 20;
            const bar = document.createElement('div');
            bar.className = 'flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t opacity-80 hover:opacity-100 transition-opacity';
            bar.style.height = h + '%';
            bar.title = (i * 4) + ':00 - ' + (Math.floor(Math.random() * 5000) + 1000) + ' records';
            chart.appendChild(bar);
        }

        // Populate jobs table from API
        fetch('/api/v1/sync/jobs?limit=6')
            .then(r => r.json())
            .then(data => {
                const tbody = document.getElementById('jobs-table');
                tbody.innerHTML = data.data.map(job => {
                    const statusColors = { completed: 'bg-green-100 text-green-700', in_progress: 'bg-blue-100 text-blue-700', pending: 'bg-slate-100 text-slate-600', failed: 'bg-red-100 text-red-700', retrying: 'bg-amber-100 text-amber-700' };
                    return '<tr class="hover:bg-slate-50 transition-colors">' +
                        '<td class="px-5 py-3 font-mono text-xs text-slate-600">' + job.jobId + '</td>' +
                        '<td class="px-5 py-3 text-slate-700">' + job.type.replace(/_/g, ' ') + '</td>' +
                        '<td class="px-5 py-3 text-slate-600 text-xs">' + job.sourceWarehouse + ' &rarr; ' + job.targetWarehouse + '</td>' +
                        '<td class="px-5 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ' + (statusColors[job.status] || 'bg-slate-100 text-slate-600') + '">' + job.status.replace(/_/g, ' ') + '</span></td>' +
                        '<td class="px-5 py-3 text-slate-600">' + job.recordsProcessed.toLocaleString() + '</td>' +
                        '<td class="px-5 py-3 text-slate-500 text-xs">' + (job.durationMs ? Math.round(job.durationMs/1000) + 's' : '-') + '</td>' +
                    '</tr>';
                }).join('');
            })
            .catch(() => {
                document.getElementById('jobs-table').innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-slate-400">Loading...</td></tr>';
            });

        // Live update stats
        setInterval(() => {
            const skus = document.getElementById('stat-skus');
            if (skus) skus.textContent = (12847 + Math.floor(Math.random() * 20)).toLocaleString();
            const lat = document.getElementById('stat-latency');
            if (lat) lat.textContent = (Math.floor(Math.random() * 15) + 18) + ' ms';
        }, 5000);
    </script>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(layout('Dashboard', content, 'Dashboard'));
}

// ---- 登录页面 ----
function renderLogin(res) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign In | ${PRODUCT_NAME}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }</style>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">
        <div class="text-center mb-8">
            <div class="inline-flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                </div>
            </div>
            <h1 class="text-2xl font-bold text-slate-800">Welcome back</h1>
            <p class="text-slate-500 text-sm mt-1">Sign in to your ${PRODUCT_NAME} account</p>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <form action="/login" method="POST" class="space-y-5">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
                    <input type="email" name="email" required placeholder="you@company.com" class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <label class="block text-sm font-medium text-slate-700">Password</label>
                        <a href="#" class="text-sm text-blue-600 hover:text-blue-700 font-medium">Forgot password?</a>
                    </div>
                    <input type="password" name="password" required placeholder="Enter your password" class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="remember" class="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500">
                    <label for="remember" class="ml-2 text-sm text-slate-600">Remember me for 30 days</label>
                </div>
                <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">Sign in</button>
            </form>

            <div class="relative my-6">
                <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200"></div></div>
                <div class="relative flex justify-center text-xs"><span class="px-3 bg-white text-slate-400">OR CONTINUE WITH</span></div>
            </div>

            <div class="grid grid-cols-3 gap-3">
                <button class="flex items-center justify-center py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                    <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                </button>
                <button class="flex items-center justify-center py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                    <svg class="w-5 h-5" viewBox="0 0 23 23"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
                </button>
                <button class="flex items-center justify-center py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                    <svg class="w-5 h-5 text-slate-800" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </button>
            </div>
        </div>

        <p class="text-center text-sm text-slate-500 mt-6">
            Don't have an account? <a href="#" class="text-blue-600 hover:text-blue-700 font-medium">Contact sales</a>
        </p>
        <p class="text-center text-xs text-slate-400 mt-4">
            By signing in, you agree to our <a href="#" class="hover:underline">Terms of Service</a> and <a href="#" class="hover:underline">Privacy Policy</a>
        </p>
    </div>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

// ---- 库存管理页面 ----
function renderInventory(res) {
    const content = `
    <div class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-slate-800">Inventory</h1>
            <p class="text-slate-500 text-sm mt-1">Manage and track all SKUs across your warehouse network</p>
        </div>
        <div class="flex gap-2">
            <button class="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export CSV
            </button>
            <button class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                Add Item
            </button>
        </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl border border-slate-200 p-4 mb-5 shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
            <div class="relative flex-1 min-w-48">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="inv-search" placeholder="Search by SKU or name..." class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <select class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Categories</option>
                <option>Electronics</option>
                <option>Apparel</option>
                <option>Home & Garden</option>
                <option>Sports</option>
            </select>
            <select class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Warehouses</option>
                <option>EU-Central</option>
                <option>US-East</option>
                <option>US-West</option>
            </select>
            <select class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Status</option>
                <option>In Stock</option>
                <option>Out of Stock</option>
            </select>
        </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table class="w-full text-sm">
            <thead class="bg-slate-50">
                <tr>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product Name</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Warehouse</th>
                    <th class="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quantity</th>
                    <th class="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Updated</th>
                </tr>
            </thead>
            <tbody id="inventory-table" class="divide-y divide-slate-100">
                <tr><td colspan="8" class="px-5 py-8 text-center text-slate-400">Loading inventory...</td></tr>
            </tbody>
        </table>
        <div class="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <span id="inv-count">Showing 0 items</span>
            <div class="flex gap-1">
                <button class="px-3 py-1 border border-slate-200 rounded text-slate-400 cursor-not-allowed">Previous</button>
                <button class="px-3 py-1 bg-blue-600 text-white rounded">1</button>
                <button class="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">2</button>
                <button class="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">3</button>
                <button class="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50">Next</button>
            </div>
        </div>
    </div>

    <script>
        fetch('/api/v1/inventory?limit=20')
            .then(r => r.json())
            .then(data => {
                const tbody = document.getElementById('inventory-table');
                tbody.innerHTML = data.data.map(item => {
                    const statusColor = item.status === 'in_stock' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
                    return '<tr class="hover:bg-slate-50 transition-colors">' +
                        '<td class="px-5 py-3 font-mono text-xs text-slate-600">' + item.sku + '</td>' +
                        '<td class="px-5 py-3 font-medium text-slate-800">' + item.name + '</td>' +
                        '<td class="px-5 py-3 text-slate-600">' + item.category + '</td>' +
                        '<td class="px-5 py-3 text-slate-600 text-xs">' + item.warehouseId + '</td>' +
                        '<td class="px-5 py-3 text-right font-medium text-slate-700">' + item.quantity.toLocaleString() + '</td>' +
                        '<td class="px-5 py-3 text-right text-slate-600">$' + item.unitPrice.toFixed(2) + '</td>' +
                        '<td class="px-5 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ' + statusColor + '">' + item.status.replace(/_/g, ' ') + '</span></td>' +
                        '<td class="px-5 py-3 text-slate-400 text-xs">' + new Date(item.lastUpdated).toLocaleString() + '</td>' +
                    '</tr>';
                }).join('');
                document.getElementById('inv-count').textContent = 'Showing ' + data.data.length + ' of ' + data.pagination.total + ' items';
            })
            .catch(() => {
                document.getElementById('inventory-table').innerHTML = '<tr><td colspan="8" class="px-5 py-8 text-center text-red-400">Failed to load inventory</td></tr>';
            });
    </script>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(layout('Inventory', content, 'Inventory'));
}

// ---- 仓库管理页面 ----
function renderWarehouses(res) {
    const content = `
    <div class="mb-6 flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold text-slate-800">Warehouses</h1>
            <p class="text-slate-500 text-sm mt-1">Monitor and manage your distribution network</p>
        </div>
        <button class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Add Warehouse
        </button>
    </div>

    <div id="warehouse-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div class="col-span-full text-center text-slate-400 py-12">Loading warehouses...</div>
    </div>

    <script>
        fetch('/api/v1/warehouses')
            .then(r => r.json())
            .then(data => {
                const grid = document.getElementById('warehouse-grid');
                grid.innerHTML = data.data.map(wh => {
                    const statusColor = wh.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700';
                    const statusDot = wh.status === 'active' ? 'bg-green-500' : 'bg-amber-500';
                    const fillPercent = Math.min(100, Math.floor(Math.random() * 60) + 20);
                    return '<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">' +
                        '<div class="flex items-start justify-between mb-4">' +
                            '<div class="flex items-center gap-3">' +
                                '<div class="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">' +
                                    '<svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>' +
                                '</div>' +
                                '<div>' +
                                    '<h3 class="font-semibold text-slate-800">' + wh.name + '</h3>' +
                                    '<p class="text-xs text-slate-400">' + wh.city + ', ' + wh.region + '</p>' +
                                '</div>' +
                            '</div>' +
                            '<span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ' + statusColor + '">' +
                                '<span class="w-1.5 h-1.5 rounded-full ' + statusDot + ' pulse-dot"></span>' + wh.status +
                            '</span>' +
                        '</div>' +
                        '<div class="space-y-3 text-sm">' +
                            '<div class="flex justify-between"><span class="text-slate-500">Warehouse ID</span><span class="font-mono text-xs text-slate-600">' + wh.id + '</span></div>' +
                            '<div class="flex justify-between"><span class="text-slate-500">Capacity</span><span class="text-slate-700 font-medium">' + wh.capacity.toLocaleString() + ' units</span></div>' +
                            '<div>' +
                                '<div class="flex justify-between text-xs mb-1"><span class="text-slate-500">Utilization</span><span class="text-slate-600 font-medium">' + fillPercent + '%</span></div>' +
                                '<div class="w-full bg-slate-100 rounded-full h-2"><div class="bg-blue-500 h-2 rounded-full" style="width:' + fillPercent + '%"></div></div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="mt-4 pt-4 border-t border-slate-100 flex gap-2">' +
                            '<button class="flex-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors">View Details</button>' +
                            '<button class="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded hover:bg-slate-100 transition-colors">Sync Now</button>' +
                        '</div>' +
                    '</div>';
                }).join('');
            })
            .catch(() => {
                document.getElementById('warehouse-grid').innerHTML = '<div class="col-span-full text-center text-red-400 py-12">Failed to load warehouses</div>';
            });
    </script>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(layout('Warehouses', content, 'Warehouses'));
}

// ---- 同步任务页面 ----
function renderSyncJobs(res) {
    const content = `
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Sync Jobs</h1>
        <p class="text-slate-500 text-sm mt-1">Track and manage all inventory synchronization tasks</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-400 font-semibold uppercase">Total Today</div>
            <div class="text-2xl font-bold text-slate-800 mt-1">147</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-400 font-semibold uppercase">In Progress</div>
            <div class="text-2xl font-bold text-blue-600 mt-1">3</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-400 font-semibold uppercase">Completed</div>
            <div class="text-2xl font-bold text-green-600 mt-1">142</div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-400 font-semibold uppercase">Failed</div>
            <div class="text-2xl font-bold text-red-600 mt-1">2</div>
        </div>
    </div>

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex gap-2">
                <button class="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">All</button>
                <button class="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded">In Progress</button>
                <button class="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded">Completed</button>
                <button class="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded">Failed</button>
            </div>
            <button class="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded">Run Full Sync</button>
        </div>
        <table class="w-full text-sm">
            <thead class="bg-slate-50">
                <tr>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Job ID</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Source</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Target</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Progress</th>
                    <th class="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Records</th>
                    <th class="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">Started</th>
                </tr>
            </thead>
            <tbody id="jobs-full-table" class="divide-y divide-slate-100">
                <tr><td colspan="8" class="px-5 py-8 text-center text-slate-400">Loading jobs...</td></tr>
            </tbody>
        </table>
    </div>

    <script>
        fetch('/api/v1/sync/jobs?limit=25')
            .then(r => r.json())
            .then(data => {
                const tbody = document.getElementById('jobs-full-table');
                const statusColors = { completed: 'bg-green-100 text-green-700', in_progress: 'bg-blue-100 text-blue-700', pending: 'bg-slate-100 text-slate-600', failed: 'bg-red-100 text-red-700', retrying: 'bg-amber-100 text-amber-700' };
                tbody.innerHTML = data.data.map(job => {
                    const barColor = job.status === 'failed' ? 'bg-red-500' : job.status === 'in_progress' ? 'bg-blue-500' : 'bg-green-500';
                    return '<tr class="hover:bg-slate-50 transition-colors">' +
                        '<td class="px-5 py-3 font-mono text-xs text-slate-600">' + job.jobId + '</td>' +
                        '<td class="px-5 py-3 text-slate-700">' + job.type.replace(/_/g, ' ') + '</td>' +
                        '<td class="px-5 py-3 text-slate-600 text-xs">' + job.sourceWarehouse + '</td>' +
                        '<td class="px-5 py-3 text-slate-600 text-xs">' + job.targetWarehouse + '</td>' +
                        '<td class="px-5 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ' + (statusColors[job.status] || 'bg-slate-100') + '">' + job.status.replace(/_/g, ' ') + '</span></td>' +
                        '<td class="px-5 py-3"><div class="flex items-center gap-2"><div class="w-16 bg-slate-100 rounded-full h-1.5"><div class="' + barColor + ' h-1.5 rounded-full" style="width:' + job.progress + '%"></div></div><span class="text-xs text-slate-500">' + job.progress + '%</span></div></td>' +
                        '<td class="px-5 py-3 text-right text-slate-600">' + job.recordsProcessed.toLocaleString() + '</td>' +
                        '<td class="px-5 py-3 text-slate-400 text-xs">' + new Date(job.startedAt).toLocaleString() + '</td>' +
                    '</tr>';
                }).join('');
            })
            .catch(() => {
                document.getElementById('jobs-full-table').innerHTML = '<tr><td colspan="8" class="px-5 py-8 text-center text-red-400">Failed to load jobs</td></tr>';
            });
    </script>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(layout('Sync Jobs', content, 'Sync Jobs'));
}

// ---- 设置页面 ----
function renderSettings(res) {
    const content = `
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-800">Settings</h1>
        <p class="text-slate-500 text-sm mt-1">Configure your workspace preferences and integrations</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class="lg:col-span-1">
            <nav class="space-y-1">
                <a href="#general" class="block px-4 py-2.5 text-sm font-medium bg-blue-50 text-blue-700 rounded-lg">General</a>
                <a href="#sync" class="block px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Sync Configuration</a>
                <a href="#notifications" class="block px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Notifications</a>
                <a href="#security" class="block px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Security</a>
                <a href="#integrations" class="block px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Integrations</a>
                <a href="#billing" class="block px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Billing</a>
            </nav>
        </div>

        <div class="lg:col-span-3 space-y-6">
            <div id="general" class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 class="font-semibold text-slate-800 mb-4">General Settings</h2>
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1.5">Organization Name</label>
                        <input type="text" value="Acme Corporation" class="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1.5">Timezone</label>
                        <select class="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option>UTC-08:00 Pacific Time</option>
                            <option selected>UTC+00:00 GMT</option>
                            <option>UTC+08:00 China Standard Time</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1.5">Default Language</label>
                        <select class="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option selected>English (US)</option>
                            <option>简体中文</option>
                            <option>日本語</option>
                            <option>Deutsch</option>
                        </select>
                    </div>
                </div>
            </div>

            <div id="sync" class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 class="font-semibold text-slate-800 mb-4">Sync Configuration</h2>
                <div class="space-y-4">
                    <div class="flex items-center justify-between py-2">
                        <div>
                            <div class="text-sm font-medium text-slate-700">Auto-sync enabled</div>
                            <div class="text-xs text-slate-400">Automatically sync inventory changes across warehouses</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    <div class="flex items-center justify-between py-2">
                        <div>
                            <div class="text-sm font-medium text-slate-700">Real-time delta sync</div>
                            <div class="text-xs text-slate-400">Stream changes immediately instead of batch processing</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1.5">Sync Interval (minutes)</label>
                        <input type="number" value="15" class="w-32 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                </div>
            </div>

            <div id="security" class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 class="font-semibold text-slate-800 mb-4">Security</h2>
                <div class="space-y-4">
                    <div class="flex items-center justify-between py-2">
                        <div>
                            <div class="text-sm font-medium text-slate-700">Two-factor authentication</div>
                            <div class="text-xs text-slate-400">Require 2FA for all admin accounts</div>
                        </div>
                        <span class="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">Enabled</span>
                    </div>
                    <div class="flex items-center justify-between py-2">
                        <div>
                            <div class="text-sm font-medium text-slate-700">API key rotation</div>
                            <div class="text-xs text-slate-400">Automatically rotate API keys every 90 days</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>

            <div class="flex justify-end gap-3">
                <button class="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button class="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Save Changes</button>
            </div>
        </div>
    </div>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(layout('Settings', content, 'Settings'));
}

// ---- API 文档页面 ----
function renderDocs(res) {
    const content = `
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-800">API Documentation</h1>
        <p class="text-slate-500 text-sm mt-1">Integrate with SyncFlow using our REST API</p>
    </div>

    <div class="bg-white rounded-xl border border-slate-200 p-6 mb-5 shadow-sm">
        <h2 class="font-semibold text-slate-800 mb-3">Authentication</h2>
        <p class="text-sm text-slate-600 mb-3">All API requests require a bearer token in the Authorization header.</p>
        <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-300 overflow-x-auto">
            <span class="text-purple-400">Authorization</span>: Bearer YOUR_API_TOKEN
        </div>
    </div>

    <div class="space-y-4">
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">GET</span>
                <code class="text-sm font-mono text-slate-700">/api/v1/warehouses</code>
                <span class="text-xs text-slate-400 ml-auto">List all warehouses</span>
            </div>
            <div class="px-6 py-4">
                <h3 class="text-xs font-semibold text-slate-500 uppercase mb-2">Response Example</h3>
                <pre class="bg-slate-50 rounded-lg p-4 text-xs font-mono text-slate-600 overflow-x-auto">{
  "data": [
    {
      "id": "WH-EU-001",
      "name": "EU-Central Distribution Center",
      "region": "eu-central-1",
      "city": "Frankfurt",
      "capacity": 50000,
      "status": "active"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}</pre>
            </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">GET</span>
                <code class="text-sm font-mono text-slate-700">/api/v1/inventory</code>
                <span class="text-xs text-slate-400 ml-auto">List inventory items</span>
            </div>
            <div class="px-6 py-4">
                <h3 class="text-xs font-semibold text-slate-500 uppercase mb-2">Query Parameters</h3>
                <div class="grid grid-cols-3 gap-3 text-sm">
                    <div><code class="text-blue-600">page</code> <span class="text-slate-400 text-xs">Page number</span></div>
                    <div><code class="text-blue-600">limit</code> <span class="text-slate-400 text-xs">Items per page</span></div>
                    <div><code class="text-blue-600">warehouse</code> <span class="text-slate-400 text-xs">Filter by warehouse ID</span></div>
                </div>
            </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">GET</span>
                <code class="text-sm font-mono text-slate-700">/api/v1/sync/jobs</code>
                <span class="text-xs text-slate-400 ml-auto">List sync jobs</span>
            </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">GET</span>
                <code class="text-sm font-mono text-slate-700">/api/v1/metrics</code>
                <span class="text-xs text-slate-400 ml-auto">Get service metrics</span>
            </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                <span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">POST</span>
                <code class="text-sm font-mono text-slate-700">/api/v1/sync/trigger</code>
                <span class="text-xs text-slate-400 ml-auto">Trigger a sync job</span>
            </div>
        </div>
    </div>

    <div class="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 class="font-semibold text-blue-800 mb-2">Need help?</h3>
        <p class="text-sm text-blue-700">Check out our <a href="#" class="underline font-medium">full API reference</a> or <a href="#" class="underline font-medium">contact support</a> for integration assistance.</p>
    </div>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(layout('API Docs', content, 'API Docs'));
}

// ---- 关于页面 ----
function renderAbout(res) {
    const content = `
    <div class="max-w-3xl mx-auto">
        <div class="text-center mb-10">
            <div class="inline-flex items-center gap-3 mb-4">
                <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                </div>
            </div>
            <h1 class="text-3xl font-bold text-slate-800">${PRODUCT_NAME}</h1>
            <p class="text-slate-500 mt-2">${PRODUCT_TAGLINE}</p>
            <p class="text-sm text-slate-400 mt-1">Version ${PRODUCT_VERSION}</p>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-6 mb-5 shadow-sm">
            <h2 class="font-semibold text-slate-800 mb-3">About ${PRODUCT_NAME}</h2>
            <p class="text-sm text-slate-600 leading-relaxed mb-3">
                ${PRODUCT_NAME} is an enterprise-grade inventory synchronization platform designed for distributed warehouse networks. Our real-time data integration engine ensures that inventory levels, pricing, and product information stay consistent across all your distribution centers worldwide.
            </p>
            <p class="text-sm text-slate-600 leading-relaxed">
                Built with reliability and performance in mind, ${PRODUCT_NAME} processes millions of inventory updates daily with sub-50ms latency and 99.99% uptime guarantee.
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div class="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-sm">
                <div class="text-3xl font-bold text-blue-600">99.99%</div>
                <div class="text-xs text-slate-500 mt-1">Uptime SLA</div>
            </div>
            <div class="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-sm">
                <div class="text-3xl font-bold text-emerald-600">&lt;50ms</div>
                <div class="text-xs text-slate-500 mt-1">Avg Sync Latency</div>
            </div>
            <div class="bg-white rounded-xl border border-slate-200 p-5 text-center shadow-sm">
                <div class="text-3xl font-bold text-purple-600">50M+</div>
                <div class="text-xs text-slate-500 mt-1">Daily Records Synced</div>
            </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-6 mb-5 shadow-sm">
            <h2 class="font-semibold text-slate-800 mb-3">Technology Stack</h2>
            <div class="flex flex-wrap gap-2">
                <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Node.js</span>
                <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">WebSocket</span>
                <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Docker</span>
                <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Kubernetes</span>
                <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">PostgreSQL</span>
                <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Redis</span>
                <span class="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Tailwind CSS</span>
            </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 class="font-semibold text-slate-800 mb-3">Contact</h2>
            <div class="space-y-2 text-sm text-slate-600">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    support@syncflow.example.com
                </div>
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    +1 (555) 123-4567
                </div>
            </div>
        </div>
    </div>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(layout('About', content, 'About'));
}

// ---- 路由处理 ----
function handlePageRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method === 'GET') {
        if (path === '/') return renderDashboard(res), true;
        if (path === '/login') return renderLogin(res), true;
        if (path === '/inventory') return renderInventory(res), true;
        if (path === '/warehouses') return renderWarehouses(res), true;
        if (path === '/sync') return renderSyncJobs(res), true;
        if (path === '/settings') return renderSettings(res), true;
        if (path === '/docs') return renderDocs(res), true;
        if (path === '/about') return renderAbout(res), true;
    }

    if (req.method === 'POST' && path === '/login') {
        res.writeHead(302, { 'Location': '/' });
        res.end();
        return true;
    }

    return false; // 未匹配
}

module.exports = { handlePageRequest, renderDashboard, renderLogin };
