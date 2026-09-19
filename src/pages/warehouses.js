// ====================================================================
// warehouses 页面模块
// SyncFlow - 企业级库存同步平台
// ====================================================================

const { layout } = require('./shared');

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
                                    '<h3 class="font-semibold text-slate-800">' + escapeHtml(wh.name) + '</h3>' +
                                    '<p class="text-xs text-slate-400">' + escapeHtml(wh.city) + ', ' + escapeHtml(wh.region) + '</p>' +
                                '</div>' +
                            '</div>' +
                            '<span class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ' + statusColor + '">' +
                                '<span class="w-1.5 h-1.5 rounded-full ' + statusDot + ' pulse-dot"></span>' + escapeHtml(wh.status) +
                            '</span>' +
                        '</div>' +
                        '<div class="space-y-3 text-sm">' +
                            '<div class="flex justify-between"><span class="text-slate-500">Warehouse ID</span><span class="font-mono text-xs text-slate-600">' + escapeHtml(wh.id) + '</span></div>' +
                            '<div class="flex justify-between"><span class="text-slate-500">Capacity</span><span class="text-slate-700 font-medium">' + (typeof wh.capacity === 'number' ? wh.capacity.toLocaleString() : escapeHtml(String(wh.capacity || 0))) + ' units</span></div>' +
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

module.exports = { renderWarehouses };
