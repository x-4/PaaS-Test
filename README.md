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
- **智能异常自愈**：异常分级处理，非致命异常自动恢复，致命异常优雅关闭
- **内存自适应管理**：实时内存监控，超阈值自动清理空闲连接、触发垃圾回收
- **性能实时监控**：事件循环延迟检测、连接健康巡检、慢请求自动告警
- **安全防护**：端点地址过滤、认证失败限流、IP 封禁、企业级安全响应头
- **多平台兼容**：自动适配 Vercel、Fly.io、Render、Railway、Heroku、SnapDeploy 等 15+ PaaS 平台
- **可观测性**：22+ 个健康检查端点、Prometheus 指标、结构化访问日志、请求 ID 全链路追踪
- **Web 控制台**：8 页面管理仪表盘，实时监控同步状态
- **PWA 支持**：manifest.json、Service Worker、可安装到桌面
- **生产构建优化**：terser 压缩混淆，代码体积减少 33%，提升部署效率与代码安全性

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

## 高可用与稳定性

SyncFlow 采用多层防护机制，确保服务在各种异常情况下都能长期稳定运行。

### 智能异常自愈

服务内置异常分级处理引擎，能够智能识别异常严重程度并采取相应措施：

- **非致命异常**：单个请求或连接中的异常（如数据解析错误、临时网络波动），仅记录详细日志，服务继续运行，不影响其他连接
- **连续异常**：短时间内（5秒）连续出现3次以上异常，判定为系统性故障，触发优雅关闭流程，由平台自动重启恢复
- **致命异常**：内存不足、端口冲突、HTTP 头已发送等不可恢复错误，立即触发优雅关闭

### 内存自适应管理

实时监控内存使用情况，根据负载自动调整资源分配：

| 内存使用率 | 处理策略 |
|-----------|---------|
| < 80% | 正常运行，每30秒采样一次 |
| 80% - 90% | 输出警告日志，提示资源紧张 |
| > 90% | 自动清理空闲连接（空闲超过5分钟），触发垃圾回收释放内存 |
| 持续增长趋势 | 内存泄漏检测，最近10次采样增长超过50%时输出告警 |

### 性能实时监控

- **事件循环延迟检测**：每5秒检测一次，延迟超过1秒时输出警告，提示可能存在阻塞操作
- **连接健康巡检**：每分钟巡检连接状态，连接数超过上限80%时输出警告，长连接（超过1小时）记录调试日志
- **慢请求自动告警**：HTTP 请求处理时间超过1秒时自动记录，便于性能优化

### 请求超时保护

| 配置项 | 默认值 | 说明 |
|-------|-------|------|
| 请求超时 | 120秒 | 防止慢请求长期占用连接资源 |
| Keep-Alive 超时 | 65秒 | 略大于常见负载均衡器的60秒，避免连接被中间件意外断开 |
| 请求头超时 | 60秒 | 防止慢连接攻击，限制请求头读取时间 |
| 最大请求头数 | 100 | 限制请求头数量，防止恶意请求 |

### 连接生命周期管理

- **连接数限制**：全局最大500并发连接，单IP最大50并发连接，防止资源耗尽
- **空闲超时**：连接空闲超过5分钟自动断开，释放资源
- **心跳保活**：每30秒发送心跳帧，检测连接可用性
- **优雅关闭**：收到关闭信号后，停止接受新连接，等待现有连接完成后再退出

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8

### 本地运行

```bash
# 安装依赖
npm install

# 开发模式（直接运行源码，不压缩，便于调试）
npm run dev

# 生产模式（先压缩混淆，再运行构建产物）
npm run build
npm start

# 或指定端口和租户令牌
PORT=8080 TENANT_ID=your-tenant-token npm run dev
```

服务默认监听 `3000` 端口，访问 `http://localhost:3000` 打开管理控制台。

> **说明**：`npm start` 会自动检查 `dist/` 目录是否存在，不存在则自动运行构建。开发调试推荐使用 `npm run dev` 直接运行源码。

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

### 通用配置（所有 PaaS 平台）

大多数 PaaS 平台支持手动配置 **Build Command** 和 **Start Command**。推荐配置如下：

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| **Build Command** | `npm run build` | 安装依赖后用 terser 压缩混淆源码到 `dist/` |
| **Start Command** | `npm start` | 运行 `dist/index.js`（压缩后代码） |
| **Root Directory** | `./` | 项目根目录 |
| **Node Version** | `20.x` 或 `18.x` | 推荐 Node.js 20 |

> **兜底机制**：即使平台不运行 Build Command，`npm start` 的 `prestart` 钩子会自动检查 `dist/` 是否存在，不存在则自动运行构建。因此 Start Command 设为 `npm start` 即可兼容所有平台。

### 环境变量（必选）

| 变量 | 说明 |
|------|------|
| `TENANT_ID` | 租户身份令牌（UUID 格式），未设置则使用内置默认值 |
| `PORT` | 服务端口（大多数 PaaS 自动注入，无需手动设置） |

---

### Vercel

项目已包含 `vercel.json`，直接导入仓库即可。Vercel 会自动运行 `npm run build` 并启动服务。

```bash
npm i -g vercel
vercel
```

**手动配置**（如需要）：
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### Fly.io

```bash
fly launch
fly deploy
```

`fly launch` 会自动检测 Node.js 项目并生成 `fly.toml`。Dockerfile 已配置多阶段构建，自动完成压缩混淆。

**fly.toml 关键配置**：
```toml
[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"
  TENANT_ID = "your-tenant-token"
```

### Render

在 Render 控制台选择 "New Web Service" 并连接仓库。

**手动配置**：
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: Node 20

**环境变量**：
- `TENANT_ID`: your-tenant-token

### Railway

在 Railway 控制台选择 "New Project" → "Deploy from GitHub"。

**手动配置**（Settings → Config）：
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

Railway 会自动检测 `package.json` 并安装依赖。

### Heroku

```bash
heroku create
heroku config:set TENANT_ID=your-tenant-token
git push heroku main
```

Heroku 会自动运行 `npm run build`（如果存在），然后执行 `npm start`。

**Procfile**（如需要）：
```
web: npm start
```

### SnapDeploy

在 SnapDeploy 控制台连接仓库，平台自动检测 Node.js 项目。

**手动配置**（如平台支持自定义启动命令）：
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### Northflank

在 Northflank 创建 Service，选择 "Build and deploy"。

**配置**：
- **Build Type**: Dockerfile（自动使用项目中的 Dockerfile）
- **Port**: `3000`（或平台注入的 PORT）

**环境变量**：
- `TENANT_ID`: your-tenant-token

### 其他 PaaS 平台

对于任何支持 Node.js 的 PaaS 平台，通用配置：

1. 设置 **Build Command** 为 `npm run build`
2. 设置 **Start Command** 为 `npm start`
3. 设置环境变量 `TENANT_ID`
4. 确保平台安装了 Node.js 18+

如果平台不支持自定义 Build Command，只需将 Start Command 设为 `npm start`，`prestart` 钩子会自动完成构建。

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
| `LOG_LEVEL` | `info` | 日志级别（debug/info/warn/error/trace） |
| `LOG_FORMAT` | `text` | 日志格式（`text` 人类可读 / `json` 结构化，便于 ELK/Loki 收集） |
| `LOG_SENSITIVE` | `false` | 敏感日志开关（`true` 时日志中记录完整目标地址，默认脱敏仅显示前3字符） |
| `ADMIN_TOKEN` | 自动生成 | 管理端点认证令牌（用于 `/admin/log-level` 动态调整日志级别，未设置时启动自动生成并输出到日志） |

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
GET /healthcheck
GET /api/v1/health
GET /api/v1/status
GET /internal/health
GET /_status
GET /_health

# 版本信息
GET /version
GET /info

# Prometheus 指标 / 调试
GET /metrics
GET /prometheus
GET /debug/vars
GET /stats
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
├── Dockerfile              # 容器构建配置（多阶段构建，生产环境压缩混淆）
├── build.js                # 生产构建脚本（terser 压缩混淆）
├── package.json            # 项目配置
├── package-lock.json       # 依赖锁定
├── README.md               # 项目文档
├── .dockerignore           # Docker 忽略文件
├── .gitignore              # Git 忽略文件
└── src/
    ├── index.js            # 服务入口：HTTP 路由、升级处理、优雅关闭、稳定性模块集成
    ├── config.js           # 配置中心与启动校验
    ├── logger.js           # 企业级日志组件（双格式、5级别、请求ID、脱敏）
    ├── auth.js             # 租户身份认证
    ├── protocol.js         # 数据帧解析引擎
    ├── connection.js       # WebSocket 连接管理（生命周期、心跳、统计、空闲清理）
    ├── frame.js            # 数据帧处理（首帧解析、认证、响应、TCP/UDP 分发）
    ├── tcp-relay.js        # TCP 数据转发（上游连接、双向透传、重试缓冲）
    ├── udp-relay.js        # UDP 数据转发（数据报模式）
    ├── circuit.js          # 智能重试与熔断机制
    ├── resilience.js       # 服务韧性模块（异常自愈、内存管理、性能监控、连接巡检）
    ├── security.js         # 安全防护（端点过滤、认证限流、IP 封禁、DNS 缓存）
    ├── platform.js         # 多平台自适应配置（15+ PaaS 平台）
    ├── api.js              # 业务 API 接口（仓库/库存/同步任务完整 CRUD）
    ├── static.js           # 静态资源服务（favicon/robots/manifest/sw.js 等）
    ├── pages.js            # Web 控制台页面（8 页面管理仪表盘）
    ├── device.js           # 设备配置下发
    ├── traffic-simulator.js # 业务流量模拟器（自适应间隔、用户会话、事件流模拟）
    ├── event-stream.js     # 业务事件推送引擎（SSE 实时事件流）
    └── swagger.js          # OpenAPI 3.0 规范与 API 文档页面
```

## 许可证

MIT License
