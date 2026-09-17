// ====================================================================
// API 文档模块
// 提供 OpenAPI 3.0 规范和交互式 API 文档页面（Swagger UI 风格）
// ====================================================================

// OpenAPI 3.0 规范
const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'SyncFlow Inventory Sync API',
        description: 'Enterprise-grade real-time inventory synchronization service API. Provides warehouse management, inventory tracking, and sync job orchestration.',
        version: '2.1.0',
        contact: {
            name: 'SyncFlow Engineering',
            url: 'https://syncflow.example.com',
            email: 'engineering@syncflow.example.com'
        },
        license: {
            name: 'Proprietary',
            url: 'https://syncflow.example.com/license'
        }
    },
    servers: [
        { url: '/', description: 'Current server' }
    ],
    tags: [
        { name: 'Inventory', description: 'Inventory item management' },
        { name: 'Warehouses', description: 'Warehouse management' },
        { name: 'Sync Jobs', description: 'Synchronization job management' },
        { name: 'Metrics', description: 'Service metrics and health' },
        { name: 'Events', description: 'Real-time event stream' }
    ],
    paths: {
        '/api/v1/inventory': {
            get: {
                tags: ['Inventory'],
                summary: 'List inventory items',
                description: 'Returns a paginated list of inventory items across all warehouses.',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page' },
                    { name: 'warehouse', in: 'query', schema: { type: 'string' }, description: 'Filter by warehouse ID' },
                    { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
                    { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by SKU or name' }
                ],
                responses: {
                    '200': {
                        description: 'Successful response',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        items: { type: 'array', items: { $ref: '#/components/schemas/InventoryItem' } },
                                        pagination: { $ref: '#/components/schemas/Pagination' }
                                    }
                                }
                            }
                        }
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '429': { $ref: '#/components/responses/RateLimited' }
                }
            },
            post: {
                tags: ['Inventory'],
                summary: 'Create inventory item',
                description: 'Creates a new inventory item in the specified warehouse.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/InventoryCreateRequest' }
                        }
                    }
                },
                responses: {
                    '201': {
                        description: 'Item created',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/InventoryItem' } } }
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '409': { $ref: '#/components/responses/Conflict' }
                }
            }
        },
        '/api/v1/inventory/{sku}': {
            get: {
                tags: ['Inventory'],
                summary: 'Get inventory item',
                description: 'Returns a single inventory item by SKU.',
                parameters: [
                    { name: 'sku', in: 'path', required: true, schema: { type: 'string' }, description: 'Stock Keeping Unit' }
                ],
                responses: {
                    '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/InventoryItem' } } } },
                    '404': { $ref: '#/components/responses/NotFound' }
                }
            },
            put: {
                tags: ['Inventory'],
                summary: 'Update inventory item',
                description: 'Updates an existing inventory item.',
                parameters: [
                    { name: 'sku', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/InventoryUpdateRequest' } } }
                },
                responses: {
                    '200': { description: 'Item updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/InventoryItem' } } } },
                    '404': { $ref: '#/components/responses/NotFound' }
                }
            },
            delete: {
                tags: ['Inventory'],
                summary: 'Delete inventory item',
                parameters: [
                    { name: 'sku', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    '204': { description: 'Item deleted' },
                    '404': { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/api/v1/inventory/stats': {
            get: {
                tags: ['Inventory'],
                summary: 'Inventory statistics',
                description: 'Returns aggregate inventory statistics across all warehouses.',
                responses: {
                    '200': {
                        description: 'Successful response',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        totalItems: { type: 'integer' },
                                        totalValue: { type: 'number' },
                                        lowStockCount: { type: 'integer' },
                                        outOfStockCount: { type: 'integer' },
                                        byWarehouse: { type: 'array', items: { type: 'object' } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/v1/warehouses': {
            get: {
                tags: ['Warehouses'],
                summary: 'List warehouses',
                responses: {
                    '200': { description: 'Successful response', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Warehouse' } } } } }
                }
            },
            post: {
                tags: ['Warehouses'],
                summary: 'Create warehouse',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WarehouseCreateRequest' } } } },
                responses: {
                    '201': { description: 'Warehouse created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Warehouse' } } } },
                    '400': { $ref: '#/components/responses/BadRequest' }
                }
            }
        },
        '/api/v1/warehouses/{id}': {
            get: {
                tags: ['Warehouses'],
                summary: 'Get warehouse',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/Warehouse' } } } },
                    '404': { $ref: '#/components/responses/NotFound' }
                }
            },
            put: {
                tags: ['Warehouses'],
                summary: 'Update warehouse',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WarehouseUpdateRequest' } } } },
                responses: {
                    '200': { description: 'Warehouse updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Warehouse' } } } },
                    '404': { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/api/v1/sync/jobs': {
            get: {
                tags: ['Sync Jobs'],
                summary: 'List sync jobs',
                parameters: [
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] } },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
                ],
                responses: {
                    '200': { description: 'Successful response', content: { 'application/json': { schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/SyncJob' } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } }
                }
            },
            post: {
                tags: ['Sync Jobs'],
                summary: 'Create sync job',
                description: 'Creates a new inventory synchronization job between warehouses.',
                requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncJobCreateRequest' } } } },
                responses: {
                    '201': { description: 'Job created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncJob' } } } },
                    '400': { $ref: '#/components/responses/BadRequest' }
                }
            }
        },
        '/api/v1/sync/jobs/{id}': {
            get: {
                tags: ['Sync Jobs'],
                summary: 'Get sync job',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: {
                    '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncJob' } } } },
                    '404': { $ref: '#/components/responses/NotFound' }
                }
            },
            put: {
                tags: ['Sync Jobs'],
                summary: 'Update sync job',
                description: 'Cancel, retry, or pause a sync job.',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { action: { type: 'string', enum: ['cancel', 'retry', 'pause'] } } } } } },
                responses: {
                    '200': { description: 'Job updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SyncJob' } } } },
                    '404': { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/api/v1/metrics': {
            get: {
                tags: ['Metrics'],
                summary: 'Service metrics',
                description: 'Returns real-time service metrics including connection counts, throughput, and sync job statistics.',
                responses: {
                    '200': {
                        description: 'Successful response',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        uptime: { type: 'integer', description: 'Service uptime in seconds' },
                                        activeConnections: { type: 'integer' },
                                        totalConnections: { type: 'integer' },
                                        bytesTransferred: { type: 'integer' },
                                        syncJobs: { type: 'object', properties: { running: { type: 'integer' }, completed: { type: 'integer' }, failed: { type: 'integer' } } },
                                        memory: { type: 'object', properties: { heapUsed: { type: 'integer' }, heapTotal: { type: 'integer' } } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/v1/events': {
            get: {
                tags: ['Events'],
                summary: 'Event stream (WebSocket)',
                description: 'Real-time event stream via WebSocket. Subscribe to inventory updates, sync job status changes, and warehouse events.',
                responses: {
                    '101': { description: 'Switching Protocols - WebSocket connection established' }
                }
            }
        },
        '/health': {
            get: {
                tags: ['Metrics'],
                summary: 'Health check',
                responses: { '200': { description: 'Service healthy' } }
            }
        }
    },
    components: {
        schemas: {
            InventoryItem: {
                type: 'object',
                properties: {
                    sku: { type: 'string', example: 'SKU-10001' },
                    name: { type: 'string', example: 'Wireless Mouse Pro' },
                    category: { type: 'string', example: 'Electronics' },
                    warehouseId: { type: 'string', example: 'WH-EU-001' },
                    quantity: { type: 'integer', example: 1500 },
                    reserved: { type: 'integer', example: 120 },
                    unitPrice: { type: 'number', example: 29.99 },
                    status: { type: 'string', enum: ['in_stock', 'low_stock', 'out_of_stock'], example: 'in_stock' },
                    lastUpdated: { type: 'string', format: 'date-time' }
                }
            },
            InventoryCreateRequest: {
                type: 'object',
                required: ['sku', 'name', 'warehouseId', 'quantity'],
                properties: {
                    sku: { type: 'string' },
                    name: { type: 'string' },
                    category: { type: 'string' },
                    warehouseId: { type: 'string' },
                    quantity: { type: 'integer' },
                    unitPrice: { type: 'number' }
                }
            },
            InventoryUpdateRequest: {
                type: 'object',
                properties: {
                    quantity: { type: 'integer' },
                    reserved: { type: 'integer' },
                    unitPrice: { type: 'number' },
                    status: { type: 'string', enum: ['in_stock', 'low_stock', 'out_of_stock'] }
                }
            },
            Warehouse: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'WH-EU-001' },
                    name: { type: 'string', example: 'Frankfurt Distribution Center' },
                    region: { type: 'string', example: 'eu-central-1' },
                    city: { type: 'string', example: 'Frankfurt' },
                    capacity: { type: 'integer', example: 50000 },
                    status: { type: 'string', enum: ['active', 'maintenance', 'offline'], example: 'active' }
                }
            },
            WarehouseCreateRequest: {
                type: 'object',
                required: ['name', 'region', 'city'],
                properties: {
                    name: { type: 'string' },
                    region: { type: 'string' },
                    city: { type: 'string' },
                    capacity: { type: 'integer' }
                }
            },
            WarehouseUpdateRequest: {
                type: 'object',
                properties: {
                    capacity: { type: 'integer' },
                    status: { type: 'string', enum: ['active', 'maintenance', 'offline'] }
                }
            },
            SyncJob: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'JOB-20001' },
                    type: { type: 'string', enum: ['full_inventory', 'delta_update', 'price_sync', 'stock_reconciliation'], example: 'full_inventory' },
                    sourceWarehouse: { type: 'string', example: 'WH-EU-001' },
                    targetWarehouse: { type: 'string', example: 'WH-US-001' },
                    status: { type: 'string', enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], example: 'running' },
                    progress: { type: 'integer', example: 45 },
                    recordsProcessed: { type: 'integer', example: 12500 },
                    totalRecords: { type: 'integer', example: 28000 },
                    startedAt: { type: 'string', format: 'date-time' },
                    completedAt: { type: 'string', format: 'date-time', nullable: true },
                    error: { type: 'string', nullable: true }
                }
            },
            SyncJobCreateRequest: {
                type: 'object',
                required: ['type', 'sourceWarehouse', 'targetWarehouse'],
                properties: {
                    type: { type: 'string', enum: ['full_inventory', 'delta_update', 'price_sync', 'stock_reconciliation'] },
                    sourceWarehouse: { type: 'string' },
                    targetWarehouse: { type: 'string' }
                }
            },
            Pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    totalPages: { type: 'integer' }
                }
            },
            Error: {
                type: 'object',
                properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                    details: { type: 'object' }
                }
            }
        },
        responses: {
            BadRequest: {
                description: 'Bad request',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
            },
            NotFound: {
                description: 'Resource not found',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
            },
            Conflict: {
                description: 'Resource conflict',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
            },
            RateLimited: {
                description: 'Rate limit exceeded',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
            }
        },
        securitySchemes: {
            ApiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key',
                description: 'API key for service-to-service authentication'
            },
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT token for user authentication'
            }
        }
    },
    security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }]
};

// 生成 Swagger UI 风格的 API 文档页面（纯静态，不依赖外部 CDN）
function generateDocsPage() {
    const specJson = JSON.stringify(openApiSpec, null, 2);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SyncFlow API Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; color: #3b4151; line-height: 1.5; }
        .header { background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%); color: white; padding: 32px 48px; }
        .header h1 { font-size: 28px; font-weight: 600; margin-bottom: 8px; }
        .header p { font-size: 14px; opacity: 0.9; max-width: 800px; }
        .header .version { display: inline-block; background: rgba(255,255,255,0.2); padding: 2px 10px; border-radius: 12px; font-size: 12px; margin-top: 8px; }
        .container { max-width: 1200px; margin: 0 auto; padding: 24px 48px; }
        .info-card { background: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .info-card h2 { font-size: 18px; color: #1a73e8; margin-bottom: 12px; }
        .info-card p { font-size: 14px; color: #555; margin-bottom: 8px; }
        .tag-section { margin-bottom: 32px; }
        .tag-title { font-size: 20px; font-weight: 600; color: #1a73e8; padding-bottom: 8px; border-bottom: 2px solid #e8f0fe; margin-bottom: 16px; }
        .endpoint { background: white; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden; }
        .endpoint-header { display: flex; align-items: center; padding: 14px 20px; cursor: pointer; transition: background 0.15s; }
        .endpoint-header:hover { background: #f8f9fa; }
        .method { display: inline-block; min-width: 80px; text-align: center; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 700; color: white; margin-right: 16px; text-transform: uppercase; }
        .method.get { background: #61affe; }
        .method.post { background: #49cc90; }
        .method.put { background: #fca130; }
        .method.delete { background: #f93e3e; }
        .path { font-family: 'Courier New', monospace; font-size: 14px; color: #3b4151; flex: 1; }
        .summary { font-size: 13px; color: #666; margin-left: 16px; }
        .endpoint-body { padding: 0 20px 20px; display: none; border-top: 1px solid #eee; }
        .endpoint.open .endpoint-body { display: block; }
        .endpoint-body h4 { font-size: 14px; color: #1a73e8; margin: 16px 0 8px; }
        .endpoint-body p { font-size: 13px; color: #555; margin-bottom: 8px; }
        .param-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .param-table th { text-align: left; padding: 8px 12px; background: #f8f9fa; border-bottom: 2px solid #e9ecef; font-weight: 600; }
        .param-table td { padding: 8px 12px; border-bottom: 1px solid #eee; }
        .param-table code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
        .response-code { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 8px; }
        .response-code.success { background: #e6f4ea; color: #137333; }
        .response-code.error { background: #fce8e6; color: #c5221f; }
        .response-code.redirect { background: #e8f0fe; color: #1967d2; }
        pre { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 16px; overflow-x: auto; font-size: 13px; line-height: 1.4; }
        pre code { font-family: 'Courier New', monospace; }
        .footer { text-align: center; padding: 32px; color: #999; font-size: 12px; }
        .spec-link { display: inline-block; margin-top: 16px; padding: 8px 20px; background: #1a73e8; color: white; text-decoration: none; border-radius: 4px; font-size: 13px; }
        .spec-link:hover { background: #1557b0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${openApiSpec.info.title}</h1>
        <p>${openApiSpec.info.description}</p>
        <span class="version">v${openApiSpec.info.version}</span>
    </div>
    <div class="container">
        <div class="info-card">
            <h2>Base URL</h2>
            <p><code>/</code> (relative to current server)</p>
            <h2 style="margin-top:16px;">Authentication</h2>
            <p>This API supports API Key authentication (<code>X-API-Key</code> header) and Bearer JWT tokens.</p>
            <a href="/api/docs/openapi.json" class="spec-link">Download OpenAPI 3.0 Spec (JSON)</a>
        </div>
        ${renderEndpoints()}
    </div>
    <div class="footer">
        <p>${openApiSpec.info.title} v${openApiSpec.info.version} | Generated by SyncFlow Engineering</p>
    </div>
    <script>
        document.querySelectorAll('.endpoint-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('open');
            });
        });
    </script>
</body>
</html>`;
}

// 渲染所有端点（按 tag 分组）
function renderEndpoints() {
    const tags = openApiSpec.tags || [];
    let html = '';

    for (const tag of tags) {
        const tagPaths = [];
        for (const [path, methods] of Object.entries(openApiSpec.paths)) {
            for (const [method, spec] of Object.entries(methods)) {
                if (spec.tags && spec.tags.includes(tag.name)) {
                    tagPaths.push({ path, method, spec });
                }
            }
        }

        if (tagPaths.length === 0) continue;

        html += `<div class="tag-section">
            <div class="tag-title">${tag.name} <span style="font-size:14px;color:#999;font-weight:normal;">(${tag.description || ''})</span></div>`;

        for (const ep of tagPaths) {
            html += `<div class="endpoint">
                <div class="endpoint-header">
                    <span class="method ${ep.method}">${ep.method}</span>
                    <span class="path">${ep.path}</span>
                    <span class="summary">${ep.spec.summary || ''}</span>
                </div>
                <div class="endpoint-body">
                    ${ep.spec.description ? `<p>${ep.spec.description}</p>` : ''}
                    ${renderParameters(ep.spec.parameters)}
                    ${renderRequestBody(ep.spec.requestBody)}
                    ${renderResponses(ep.spec.responses)}
                </div>
            </div>`;
        }

        html += '</div>';
    }

    return html;
}

function renderParameters(params) {
    if (!params || params.length === 0) return '';
    let html = '<h4>Parameters</h4><table class="param-table"><tr><th>Name</th><th>Located in</th><th>Type</th><th>Required</th><th>Description</th></tr>';
    for (const p of params) {
        html += `<tr>
            <td><code>${p.name}</code></td>
            <td>${p.in}</td>
            <td><code>${p.schema?.type || 'string'}</code></td>
            <td>${p.required ? 'Yes' : 'No'}</td>
            <td>${p.description || ''}</td>
        </tr>`;
    }
    html += '</table>';
    return html;
}

function renderRequestBody(body) {
    if (!body) return '';
    const json = body.content?.['application/json'];
    if (!json) return '';
    return `<h4>Request Body</h4><p>${body.required ? 'Required' : 'Optional'}</p>
    <pre><code>${JSON.stringify(json.schema?.properties || json.schema, null, 2).substring(0, 500)}</code></pre>`;
}

function renderResponses(responses) {
    if (!responses) return '';
    let html = '<h4>Responses</h4>';
    for (const [code, resp] of Object.entries(responses)) {
        const cls = code.startsWith('2') ? 'success' : code.startsWith('3') ? 'redirect' : 'error';
        html += `<p><span class="response-code ${cls}">${code}</span>${resp.description || ''}</p>`;
    }
    return html;
}

// 处理 API 文档请求
function handleDocsRequest(req, res, pathname) {
    if (pathname === '/api/docs' || pathname === '/api/docs/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(generateDocsPage());
        return true;
    }
    if (pathname === '/api/docs/openapi.json') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(openApiSpec, null, 2));
        return true;
    }
    return false;
}

module.exports = { handleDocsRequest, openApiSpec };
