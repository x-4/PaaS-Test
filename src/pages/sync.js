// ====================================================================
// sync 页面模块
// SyncFlow - 企业级库存同步平台
// ====================================================================

const { layout } = require('./shared');

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

module.exports = { renderSyncJobs };
