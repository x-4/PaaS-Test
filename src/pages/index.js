// ====================================================================
// 页面模块主入口
// 路由分发：根据 URL 路径调用对应页面模块
// 品牌：SyncFlow - 企业级库存同步平台
// ====================================================================

const { renderDashboard } = require('./dashboard');
const { renderLogin } = require('./login');
const { renderInventory } = require('./inventory');
const { renderWarehouses } = require('./warehouses');
const { renderSyncJobs } = require('./sync');
const { renderSettings } = require('./settings');
const { renderDocs } = require('./docs');
const { renderAbout } = require('./about');

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

module.exports = {
    handlePageRequest,
    renderDashboard,
    renderLogin,
    renderInventory,
    renderWarehouses,
    renderSyncJobs,
    renderSettings,
    renderDocs,
    renderAbout
};
