// ====================================================================
// 静态资源模块
// 提供 favicon、robots.txt、sitemap.xml 等标准网站资源
// ====================================================================

// SVG 格式网站图标（蓝色圆角方块 + 白色 E 字母）
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2563eb"/><rect x="6" y="8" width="20" height="3" rx="1.5" fill="white"/><rect x="6" y="14.5" width="14" height="3" rx="1.5" fill="white"/><rect x="6" y="21" width="20" height="3" rx="1.5" fill="white"/></svg>`;

// robots.txt - 标准搜索引擎爬虫规则
const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /health
Disallow: /healthz

Sitemap: /sitemap.xml
`;

// sitemap.xml - 网站地图
const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>/api/v1/warehouses</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>/api/v1/inventory</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>/api/v1/metrics</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>always</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
`;

// 404 页面（与仪表盘风格一致）
const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>404 - Page Not Found | Inventory Sync</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #f8fafc; color: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center">
    <div class="text-center">
        <div class="text-8xl font-bold text-blue-600 mb-4">404</div>
        <h1 class="text-2xl font-bold text-slate-800 mb-2">Page Not Found</h1>
        <p class="text-slate-500 mb-6">The resource you are looking for does not exist or has been moved.</p>
        <a href="/" class="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Return to Dashboard</a>
    </div>
</body>
</html>`;

function handleStaticRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    if (req.method !== 'GET') return null;

    if (path === '/favicon.ico') {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
        res.end(FAVICON_SVG);
        return true;
    }

    if (path === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(ROBOTS_TXT);
        return true;
    }

    if (path === '/sitemap.xml') {
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(SITEMAP_XML);
        return true;
    }

    return null; // 未匹配
}

function sendNotFound(res) {
    res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(NOT_FOUND_HTML);
}

module.exports = { handleStaticRequest, sendNotFound };
