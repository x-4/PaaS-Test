// ====================================================================
// 页面共享模块
// 产品信息、共享布局、导航组件
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

module.exports = {
    PRODUCT_NAME,
    PRODUCT_VERSION,
    PRODUCT_TAGLINE,
    layout
};
