// ====================================================================
// docs 页面模块
// SyncFlow - 企业级库存同步平台
// ====================================================================

const { layout } = require('./shared');

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

module.exports = { renderDocs };
