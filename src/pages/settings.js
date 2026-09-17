// ====================================================================
// settings 页面模块
// SyncFlow - 企业级库存同步平台
// ====================================================================

const { layout } = require('./shared');

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

module.exports = { renderSettings };
