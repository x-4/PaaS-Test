// ====================================================================
// dashboard 页面模块
// SyncFlow - 企业级库存同步平台
// ====================================================================

const { layout } = require('./shared');

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

module.exports = { renderDashboard };
