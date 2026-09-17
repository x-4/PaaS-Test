// ====================================================================
// about 页面模块
// SyncFlow - 企业级库存同步平台
// ====================================================================

const { layout, PRODUCT_NAME, PRODUCT_VERSION, PRODUCT_TAGLINE } = require('./shared');

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

module.exports = { renderAbout };
