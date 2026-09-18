// ====================================================================
// inventory 页面模块
// SyncFlow - 企业级库存同步平台
// ====================================================================

const { layout } = require('./shared');

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
            <div class="relative flex-1 min-w-48 group">
                <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" id="inv-search" placeholder="Search by SKU or name..." class="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all">
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
                        '<td class="px-5 py-3 font-mono text-xs text-slate-600">' + escapeHtml(item.sku) + '</td>' +
                        '<td class="px-5 py-3 font-medium text-slate-800">' + escapeHtml(item.name) + '</td>' +
                        '<td class="px-5 py-3 text-slate-600">' + escapeHtml(item.category) + '</td>' +
                        '<td class="px-5 py-3 text-slate-600 text-xs">' + escapeHtml(item.warehouseId) + '</td>' +
                        '<td class="px-5 py-3 text-right font-medium text-slate-700">' + escapeHtml(item.quantity.toLocaleString()) + '</td>' +
                        '<td class="px-5 py-3 text-right text-slate-600">$' + escapeHtml(item.unitPrice.toFixed(2)) + '</td>' +
                        '<td class="px-5 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold ' + statusColor + '">' + escapeHtml(item.status.replace(/_/g, ' ')) + '</span></td>' +
                        '<td class="px-5 py-3 text-slate-400 text-xs">' + escapeHtml(new Date(item.lastUpdated).toLocaleString()) + '</td>' +
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

module.exports = { renderInventory };
