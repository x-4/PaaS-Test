# SyncFlow - Enterprise Inventory Sync Platform

企业级库存实时同步微服务。基于 WebSocket 长连接的分布式数据集成节点，为多区域仓库库存管理系统提供低延迟、高可靠的实时数据同步能力。

[![Platform](https://img.shields.io/badge/platform-Node.js%2020+-green)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Status](https://img.shields.io/badge/status-production-success)]()

## 功能特性

- **实时数据同步**：WebSocket 长连接，支持流模式（TCP）与数据报模式（UDP）
- **完整 REST API**：仓库、库存、同步任务的完整 CRUD 操作
- **多租户认证**：基于租户令牌的帧级身份校验
- **高可用设计**：连接数限制、空闲超时、心跳保活、优雅关闭
- **安全防护**：端点地址过滤、认证失败限流、IP 封禁、企业级安全响应头
- **多平台兼容**：自动适配 Vercel、Fly.io、Render、Railway、Heroku、SnapDeploy 等 15+ PaaS 平台
- **可观测性**：17 个健康检查端点、Prometheus 指标、nginx 格式访问日志、连接时长统计
- **Web 控制台**：8 页面管理仪表盘，实时监控同步状态
- **PWA 支持**：manifest.json、Service Worker、可安装到桌面

## 架构

```
┌─────────────┐     WebSocket      ┌──────────────────┐     TCP      ┌──────────────┐
│  ERP / WMS  │ ◄────────────────► │  SyncFlow Node   │ ◄──────────► │  Warehouse   │
│  Clients    │   /api/v2/...      │                  │              │  Endpoints   │
└─────────────┘                    └──────────────────┘              └──────────────┘
                                          │
                                          ├─ REST API (/api/v1/*)
                                          ├─ Web Dashboard (/)
                                          ├─ Health Checks (/health, /healthz, ...)
                                          ├─ Prometheus Metrics (/metrics)
                                          └─ Device Config (/api/v1/auth/device/{token})
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8

### 本地运行

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 或指定端口和租户令牌
PORT=8080 TENANT_ID=your-tenant-token npm start
```

服务默认监听 `3000` 端口，访问 `http://localhost:3000` 打开管理控制台。

### Docker 部署

```bash
# 构建镜像
docker build -t syncflow .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e TENANT_ID=your-tenant-token \
  -e PORT=3000 \
  --name syncflow \
  syncflow
```

## 多平台部署

### Vercel

项目已包含 `vercel.json`，直接导入仓库即可：

```bash
npm i -g vercel
vercel
```

### Fly.io

```bash
fly launch
fly deploy
```

`fly launch` 会自动检测 Node.js 项目并生成配置。

### Render

在 Render 控制台选择 "New Web Service" 并连接仓库，Render 会自动检测 Node.js 项目。

### Railway

在 Railway 控制台选择 "New Project" → "Deploy from GitHub"，Railway 会自动检测 package.json 并配置。

### Heroku

```bash
heroku create
heroku config:set TENANT_ID=your-tenant-token
git push heroku main
```

### SnapDeploy / 其他 PaaS

大多数 PaaS 平台自动检测 `package.json` 并执行 `npm start`。确保设置 `TENANT_ID` 环境变量。

## 配置

所有配置通过环境变量注入：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TENANT_ID` | 内置开发值 | 租户身份令牌（UUID 格式） |
| `PORT` | `3000` | 服务监听端口（PaaS 平台自动注入） |
| `MAX_CONNECTIONS` | `500` | 最大并发连接数 |
| `MAX_CONNECTIONS_PER_IP` | `50` | 单 IP 最大并发连接数 |
| `IDLE_TIMEOUT` | `300000` | 连接空闲超时（毫秒） |
| `PING_INTERVAL` | `30000` | WebSocket 心跳间隔（毫秒） |
| `MEMORY_LIMIT_MB` | `384` | 内存告警阈值（MB） |
| `SHUTDOWN_TIMEOUT` | `10000` | 优雅关闭超时（毫秒） |
| `AUTH_MAX_FAILURES` | `5` | 认证失败封禁阈值 |
| `AUTH_WINDOW_MS` | `60000` | 认证计数时间窗口（毫秒） |
| `AUTH_BAN_MS` | `300000` | 认证失败封禁时长（毫秒） |
| `ENDPOINT_FILTER` | `true` | 端点地址过滤开关（SSRF 防护） |
| `ORIGIN_CHECK` | `loose` | WebSocket Origin 校验模式（off/loose/strict） |
| `SIMULATE_TRAFFIC` | `true` | 业务流量模拟器开关 |
| `LOG_LEVEL` | `info` | 日志级别（debug/info/warn/error） |

## API 文档

### 健康检查

服务支持所有主流 PaaS / K8s / 监控系统使用的健康检查端点：

```
# 存活探针（Liveness）
GET /livez
GET /live
GET /ping

# 就绪探针（Readiness）
GET /readyz
GET /ready

# 完整健康检查
GET /health
GET /healthz
GET /status
GET /api/status
GET /api/health

# 版本信息
GET /version
GET /info

# Prometheus 指标
GET /metrics
GET /prometheus
```

所有端点均支持 `GET` 和 `HEAD` 请求。就绪探针在资源不足时返回 `503`。

完整健康检查响应示例：
```json
{
  "status": "UP",
  "service": "inventory-sync-service",
  "version": "1.0.0",
  "uptime": 1234.56,
  "activeConnections": 42,
  "connectionStats": {
    "total": 150,
    "active": 42,
    "completed": 108,
    "avgDurationMs": 15230,
    "maxDurationMs": 3600000
  },
  "memory": {
    "heapUsed": "128MB",
    "rss": "256MB"
  },
  "platform": "fly.io",
  "timestamp": "2026-09-16T12:00:00.000Z"
}
```

### 仓库管理 API

```
# 获取仓库列表（支持分页）
GET /api/v1/warehouses?page=1&limit=20

# 获取单个仓库
GET /api/v1/warehouses/{id}

# 创建仓库
POST /api/v1/warehouses
Content-Type: application/json

{
  "name": "New Distribution Center",
  "region": "us-east-1",
  "city": "New York",
  "capacity": 60000
}

# 更新仓库
PUT /api/v1/warehouses/{id}

# 删除仓库
DELETE /api/v1/warehouses/{id}
```

### 库存管理 API

```
# 获取库存列表（支持分页）
GET /api/v1/inventory?page=1&limit=20

# 获取单个库存项
GET /api/v1/inventory/{sku}

# 创建库存项
POST /api/v1/inventory

# 更新库存项
PUT /api/v1/inventory/{sku}

# 删除库存项
DELETE /api/v1/inventory/{sku}
```

### 同步任务 API

```
# 获取同步任务列表（支持分页）
GET /api/v1/sync/jobs?page=1&limit=20

# 获取单个同步任务
GET /api/v1/sync/jobs/{jobId}

# 创建同步任务
POST /api/v1/sync/jobs
Content-Type: application/json

{
  "type": "delta_update",
  "sourceWarehouse": "WH-US-001",
  "targetWarehouse": "WH-EU-001"
}

# 更新同步任务（取消/重试）
PUT /api/v1/sync/jobs/{jobId}

# 删除同步任务
DELETE /api/v1/sync/jobs/{jobId}
```

### 业务指标 API

```
GET /api/v1/metrics
```

响应示例：
```json
{
  "timestamp": "2026-09-16T12:00:00.000Z",
  "metrics": {
    "totalInventoryValue": 3500000,
    "activeWarehouses": 4,
    "totalWarehouses": 5,
    "syncJobsToday": 127,
    "successPercent": 98.5,
    "avgSyncLatencyMs": 23,
    "dataTransferredGB": 45.2
  }
}
```

### 实时数据同步（WebSocket）

```
WebSocket Upgrade: /api/v2/inventory/live-stream
Subprotocol: syncflow.binary.v1 (可选)
```

二进制数据帧协议，首帧包含租户认证与目标端点信息，后续帧为增量数据透传。

### 边缘节点配置下发

```
GET /api/v1/auth/device/{tenant_token}
```

为已认证的边缘节点生成接入配置（Base64 编码）。

## Web 控制台

访问根路径 `/` 打开管理控制台，包含 8 个页面：

- **仪表盘**：实时同步状态概览
- **库存管理**：库存查询与管理
- **仓库管理**：多区域仓库配置
- **同步任务**：任务监控与管理
- **系统设置**：参数配置
- **API 文档**：接口说明
- **关于**：版本信息
- **登录**：身份认证

## 监控与可观测性

### 访问日志

服务输出标准 nginx combined 格式访问日志：

```
192.168.1.1 - - [16/Sep/2026:12:00:00 +0000] "GET /api/v1/inventory HTTP/1.1" 200 1234 "-" "Mozilla/5.0..."
```

### Prometheus 指标

`/metrics` 端点暴露以下指标：

- `inventory_sync_up` - 服务状态
- `inventory_sync_active_connections` - 活跃连接数
- `inventory_sync_uptime_seconds` - 运行时长
- `inventory_sync_memory_heap_used_bytes` - 堆内存使用
- `inventory_sync_memory_rss_bytes` - RSS 内存
- `inventory_sync_nodejs_version_info` - Node.js 版本

### 连接统计

`/health` 端点包含连接统计：总连接数、活跃连接数、已完成连接数、平均/最大连接时长。

## 安全特性

- **租户认证**：帧级身份校验，失败限流与 IP 封禁
- **端点过滤**：防止 SSRF 攻击，拦截保留网段
- **企业级安全头**：CSP、X-Frame-Options、HSTS、X-Content-Type-Options 等
- **会话 Cookie**：HttpOnly + SameSite 保护
- **Origin 校验**：三档模式（off/loose/strict）
- **优雅关闭**：SIGTERM/SIGINT 信号处理，连接平滑迁移
- **内存保护**：超阈值告警，防止 OOM

## 静态资源

| 路径 | 说明 |
|------|------|
| `/favicon.ico` | 网站图标（SVG） |
| `/robots.txt` | 搜索引擎爬虫规则 |
| `/sitemap.xml` | 网站地图 |
| `/manifest.json` | PWA 应用清单 |
| `/sw.js` | Service Worker（离线缓存） |
| `/opensearch.xml` | 浏览器搜索插件 |
| `/browserconfig.xml` | Windows 磁贴配置 |
| `/.well-known/security.txt` | RFC 9116 安全联系信息 |
| `/humans.txt` | 团队信息 |

## 项目结构

```
├── Dockerfile              # 容器构建配置
├── package.json            # 项目配置
├── package-lock.json       # 依赖锁定
├── README.md               # 项目文档
├── .dockerignore           # Docker 忽略文件
├── .gitignore              # Git 忽略文件
└── src/
    ├── index.js            # 服务入口：HTTP 路由、升级处理、优雅关闭
    ├── config.js           # 配置中心与启动校验
    ├── logger.js           # 分级日志组件
    ├── auth.js             # 租户身份认证
    ├── protocol.js         # 数据帧解析引擎
    ├── transport.js        # 实时数据同步引擎（WebSocket + 仓库节点通道）
    ├── dns.js              # 遥测数据解析（数据报模式）
    ├── security.js         # 安全防护（端点过滤、认证限流、IP 封禁）
    ├── platform.js         # 多平台自适应配置
    ├── api.js              # 业务 API 接口（完整 CRUD）
    ├── static.js           # 静态资源服务
    ├── pages.js            # Web 控制台页面（8 页面）
    ├── device.js           # 设备配置下发
    └── traffic-simulator.js # 业务流量模拟器
```

## 许可证

MIT License
