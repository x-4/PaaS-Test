// ====================================================================
// 静态资源模块
// 提供 favicon、robots.txt、sitemap.xml、manifest.json 等标准网站资源
// ====================================================================

// SVG 格式网站图标（蓝色圆角方块 + 白色同步图标）
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#2563eb"/><rect x="6" y="8" width="20" height="3" rx="1.5" fill="white"/><rect x="6" y="14.5" width="14" height="3" rx="1.5" fill="white"/><rect x="6" y="21" width="20" height="3" rx="1.5" fill="white"/></svg>`;

// robots.txt - 标准搜索引擎爬虫规则
const ROBOTS_TXT = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /health
Disallow: /healthz
Disallow: /metrics

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
    <loc>/dashboard</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>/inventory</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>/warehouses</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>/sync</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>/docs</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>/api/v1/warehouses</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>/api/v1/inventory</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>
`;

// manifest.json - PWA 应用清单
const MANIFEST_JSON = JSON.stringify({
    name: 'SyncFlow - Inventory Sync Platform',
    short_name: 'SyncFlow',
    description: 'Enterprise-grade real-time inventory synchronization platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [
        { src: '/favicon.ico', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
    ],
    categories: ['business', 'productivity', 'utilities']
}, null, 2);

// sw.js - Service Worker（基础离线缓存，模拟真实 PWA 应用）
const SERVICE_WORKER_JS = `const CACHE_NAME = 'syncflow-v1';
const STATIC_ASSETS = ['/', '/favicon.ico', '/manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then((cached) =>
            cached || fetch(event.request).then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            }).catch(() => cached)
        )
    );
});
`;

// opensearch.xml - 浏览器搜索插件描述
const OPENSEARCH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>SyncFlow</ShortName>
  <Description>Search SyncFlow inventory and sync jobs</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/svg+xml">/favicon.ico</Image>
  <Url type="text/html" template="/inventory?q={searchTerms}"/>
</OpenSearchDescription>
`;

// browserconfig.xml - Windows 磁贴配置
const BROWSERCONFIG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/favicon.ico"/>
      <TileColor>#2563eb</TileColor>
    </tile>
  </msapplication>
</browserconfig>
`;

// security.txt - 标准安全联系信息（RFC 9116）
const SECURITY_TXT = `Contact: mailto:security@syncflow.example.com
Expires: ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()}
Encoding: utf-8
Preferred-Languages: en
Canonical: https://syncflow.example.com/.well-known/security.txt
`;

// humans.txt - 团队信息文件
const HUMANS_TXT = `/* TEAM */
Product: SyncFlow
Role: Enterprise Inventory Synchronization
Status: Production

/* SOFTWARE */
Stack: Node.js, WebSocket, REST API
Server: nginx / Express-compatible
`;

// 404 页面（与仪表盘风格一致）
const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <link rel="icon" href="/favicon.ico">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#2563eb">
    <title>404 - Page Not Found | SyncFlow</title>
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

    const staticFiles = {
        '/favicon.ico': { content: FAVICON_SVG, type: 'image/svg+xml', cache: 'public, max-age=86400' },
        '/robots.txt': { content: ROBOTS_TXT, type: 'text/plain; charset=utf-8', cache: 'public, max-age=3600' },
        '/sitemap.xml': { content: SITEMAP_XML, type: 'application/xml; charset=utf-8', cache: 'public, max-age=3600' },
        '/manifest.json': { content: MANIFEST_JSON, type: 'application/manifest+json', cache: 'public, max-age=86400' },
        '/sw.js': { content: SERVICE_WORKER_JS, type: 'application/javascript; charset=utf-8', cache: 'public, max-age=3600' },
        '/opensearch.xml': { content: OPENSEARCH_XML, type: 'application/opensearchdescription+xml', cache: 'public, max-age=86400' },
        '/browserconfig.xml': { content: BROWSERCONFIG_XML, type: 'application/xml', cache: 'public, max-age=86400' },
        '/.well-known/security.txt': { content: SECURITY_TXT, type: 'text/plain; charset=utf-8', cache: 'public, max-age=86400' },
        '/humans.txt': { content: HUMANS_TXT, type: 'text/plain; charset=utf-8', cache: 'public, max-age=86400' },
    };

    const file = staticFiles[path];
    if (file) {
        res.writeHead(200, {
            'Content-Type': file.type,
            'Cache-Control': file.cache,
        });
        res.end(file.content);
        return true;
    }

    return null;
}

function sendNotFound(res) {
    res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
    });
    res.end(NOT_FOUND_HTML);
}

module.exports = { handleStaticRequest, sendNotFound };
