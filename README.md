# SyncFlow - Enterprise Inventory Sync Platform

企业级库存实时同步微服务。基于 WebSocket 长连接的分布式数据集成节点，为多区域仓库库存管理系统提供低延迟、高可靠的实时数据同步能力。

[![Platform](https://img.shields.io/badge/platform-Node.js%2020+-green)]()
[![License](https://img.shields.io/badge/license-Proprietary-red)]()
[![Status](https://img.shields.io/badge/status-production-success)]()
[![Architecture](https://img.shields.io/badge/architecture-modular-blue)]()

## 功能特性

- **实时数据同步**：WebSocket 长连接，支持流模式（TCP）与数据报模式（UDP）
- **完整 REST API**：仓库、库存、同步任务的完整 CRUD 操作
- **多租户认证**：基于租户令牌的帧级身份校验
- **模块化架构**：核心引擎 12 个细粒度模块 + 业务逻辑 11 个模块 + 页面 10 个模块 + 系统模拟 3 个模块
- **业务规则引擎**：库存分配、同步优先级、仓库路由、库存预警、任务调度
- **业务算法库**：库存周转率、同步延迟分析、ABC 分类、需求预测、安全库存计算
- **高可用设计**：连接数限制、空闲超时、心跳保活、优雅关闭
- **智能异常自愈**：异常分级处理，非致命异常自动恢复，致命异常优雅关闭
- **内存自适应管理**：实时内存监控，超阈值自动清理空闲连接、触发垃圾回收
- **性能实时监控**：事件循环延迟检测、连接健康巡检、慢请求自动告警
- **安全防护**：端点地址过滤、认证失败限流、IP 封禁、企业级安全响应头
- **多平台兼容**：自动适配 Vercel、Fly.io、Render、Railway、Heroku、SnapDeploy 等 15+ PaaS 平台
- **可观测性**：22+ 个健康检查端点、Prometheus 指标、结构化访问日志、请求 ID 全链路追踪、分布式追踪诊断端点（Tracing）
- **Web 控制台**：8 页面管理仪表盘，实时监控同步状态
- **PWA 支持**：manifest.json、Service Worker、可安装到桌面
- **生产构建优化**：terser 压缩混淆，代码体积减少 41%，提升部署效率与代码安全性
- **流量特征模拟**：上下行流量比、连接时长分布、请求方法分布统计
- **配置分散管理**：应用/安全/同步/日志四类配置独立管理
- **多入口设计**：server.js / app.js / main.js / worker.js / cli.js 多入口文件，模拟微服务架构
- **多进程名伪装**：API服务/应用服务/工作进程/CLI工具，进程列表显示多个独立业务进程
- **DNS缓存优化**：预解析、乐观刷新、stale-while-revalidate、双引擎解析（resolve4优先+lookup回退）
- **内存安全**：敏感数据自动清零、认证后立即覆盖UUID区域、内存dump防护
- **堆栈跟踪伪装**：错误堆栈自动替换为业务函数名，不暴露核心模块路径
- **多级缓冲区池**：11个大小桶分类存储，预分配支持，减少GC压力

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
                                          ├─ Readiness Probe (/ready, /readyz)
                                          ├─ Prometheus Metrics (/metrics)
                                          ├─ Distributed Tracing (/debug/trace)
                                          └─ Device Config (/api/v1/auth/device/{token})
```

### 核心模块分层

```
┌─────────────────────────────────────────────────────────┐
│                     Web 控制台层                          │
│  pages/ (10 modules) - Dashboard, Login, Inventory...    │
├─────────────────────────────────────────────────────────┤
│                     业务逻辑层                            │
│  business/ (11 modules) - Models, Rules, Algorithms...   │
├─────────────────────────────────────────────────────────┤
│                     核心引擎层                            │
│  core/ (12 modules) - Frame, Pipeline, Circuit, Metrics  │
├─────────────────────────────────────────────────────────┤
│                     基础设施层                            │
│  config/, logger, security, resilience, platform         │
└─────────────────────────────────────────────────────────┘
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
- **空闲超时**：连接空闲超时随机化（4-6分钟），避免固定特征
- **心跳保活**：每30秒发送心跳帧，携带业务数据伪装
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

### 多入口启动

项目提供多个入口文件，适用于不同场景：

```bash
# 标准入口（推荐）
npm start

# 服务端入口（带平台检测和环境变量加载）
node server.js

# 应用入口（编程式启动，支持 start/stop/getStatus）
node app.js

# 主程序入口（支持命令行参数 --port/--env/--help）
node main.js --port 8080 --env production
```

### Docker 部署

详见下方「部署 -> Docker 部署」章节，包含 Dockerfile 多阶段构建、docker-compose 编排、健康检查等完整说明。

## 部署

### 通用 PaaS 部署

大多数 PaaS 平台支持手动配置 **Build Command** 和 **Start Command**。推荐配置如下：

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| **Build Command** | `npm run build` | 用 terser 压缩混淆源码到 `dist/` |
| **Start Command** | `npm start` | 运行 `dist/index.js`（压缩后代码） |
| **Root Directory** | `./` | 项目根目录 |
| **Node Version** | `20.x` 或 `18.x` | 推荐 Node.js 20 |

> **兜底机制**：即使平台不运行 Build Command，`npm start` 的 `prestart` 钩子会自动检查 `dist/` 是否存在，不存在则自动运行构建。因此 Start Command 设为 `npm start` 即可兼容所有平台。

**必选环境变量**：

| 变量 | 说明 |
|------|------|
| `TENANT_ID` / `ENTERPRISE_TOKEN` | 租户身份令牌（UUID 格式） |
| `PORT` | 服务端口（大多数 PaaS 自动注入，无需手动设置） |

对于任何支持 Node.js 的 PaaS 平台：
1. 设置 **Build Command** 为 `npm run build`
2. 设置 **Start Command** 为 `npm start`
3. 设置环境变量 `TENANT_ID`
4. 确保平台安装了 Node.js 18+

### Docker 部署

项目已提供完整的 Docker 多阶段构建配置。

**使用 Dockerfile 构建运行**：

```bash
# 构建镜像
docker build -t syncflow .

# 运行容器
docker run -d \
  --name syncflow \
  -p 3000:3000 \
  -e TENANT_ID=your-tenant-token \
  --restart unless-stopped \
  syncflow
```

**使用 docker-compose**：

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

Docker 镜像特性：
- 多阶段构建（builder + runtime）
- 生产环境 `--omit=dev`，仅含运行时依赖
- 非 root 用户运行（`appuser`）
- 内置健康检查（`/readyz`）
- 代码体积压缩 44%（terser 混淆）


## 配置

所有配置通过环境变量注入，配置文件分散在 `config/` 目录：

| 配置文件 | 说明 |
|---------|------|
| `config/app.config.js` | 应用配置（端口、服务名、租户ID） |
| `config/security.config.js` | 安全配置（限流、SSRF、脱敏） |
| `config/sync.config.js` | 同步配置（端点、超时、重试、熔断） |
| `config/logging.config.js` | 日志配置（级别、格式、慢请求） |
| `config/index.js` | 配置合并入口 |

### 环境变量列表

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
| `ADMIN_TOKEN` | 自动生成 | 管理端点认证令牌（用于 `/admin/log-level` 动态调整日志级别，未设置时启动自动生成且**不会**输出到日志，如需固定请显式设置环境变量） |
| `EXTRA_SYNC_PATHS` | 空 | 额外的同步端点路径（逗号分隔） |

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

# 分布式追踪与诊断（APM 风格）
GET /debug/trace
GET /debug/traces
GET /api/v1/debug/trace
GET /api/v1/diagnostics
GET /internal/trace
GET /_trace
```

所有端点均支持 `GET` 和 `HEAD` 请求。就绪探针在资源不足或启动预热未完成时返回 `503`。

### 分布式追踪（Tracing）

服务内置分布式追踪系统，为每个 HTTP 请求生成唯一的 Trace ID 和 Span ID，并注入响应头，便于全链路追踪与问题诊断。

**追踪响应头**：
```
X-Trace-ID: trace_abc123_def456
X-Span-ID: span_xyz789
X-Request-ID: req_abc123_xyz789
```

**追踪端点**：
```
GET /debug/trace?limit=50&connections=true&system=true
```

**查询参数**：
| 参数 | 默认值 | 说明 |
|------|--------|------|
| `limit` | 50 | 返回最近的请求追踪数量 |
| `connections` | true | 是否包含连接追踪信息 |
| `system` | true | 是否包含系统资源统计（CPU、内存、事件循环） |

**安全说明**：追踪端点包含详细的请求与系统信息，生产环境建议通过 `DEBUG_TOKEN` 或 `ADMIN_TOKEN` 环境变量设置访问令牌：
```bash
DEBUG_TOKEN=your-secure-debug-token
```
请求时需携带 `X-Debug-Token` 请求头。

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

可用同步端点（5个，客户端可任选其一）：
- `/api/v2/inventory/live-stream`（默认）
- `/api/v2/orders/updates`
- `/api/v2/warehouses/sync`
- `/api/v2/products/realtime`
- `/api/v2/shipments/track`

二进制数据帧协议，首帧包含租户认证与目标端点信息，后续帧为增量数据透传。

### 业务事件推送（WebSocket）

```
WebSocket Upgrade: /api/v1/events
```

实时推送 12 种业务事件：库存更新、库存预警、订单创建、订单发货、仓库上下线、同步任务状态变更等。

### 实时业务消息（WebSocket）

```
WebSocket Upgrade: /api/v1/realtime
```

双向业务消息通道，支持 5 种消息类型：inventory.update、order.update、sync.progress、system.notification、warehouse.alert，3-8秒随机推送。

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

所有页面零外部依赖，完全内联 CSS，确保在任何网络环境下都能正常渲染。

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

### 流量特征统计

服务内置流量特征分析，记录：
- **上下行流量比**：出站/入站字节比例
- **帧大小分布**：0-128B / 128-1024B / 1024-8192B / 8192+B 四档统计
- **连接时长分布**：0-10s / 10s-1m / 1m-5m / 5m-30m / 30m+ 五档统计
- **HTTP 请求方法分布**：GET / POST / PUT / DELETE / HEAD / OPTIONS / PATCH 七种方法统计

## 安全特性

- **租户认证**：帧级身份校验，失败限流与 IP 封禁
- **端点过滤**：防止 SSRF 攻击，拦截保留网段
- **企业级安全头**：CSP、X-Frame-Options、HSTS、X-Content-Type-Options 等
- **会话 Cookie**：HttpOnly + SameSite 保护
- **Origin 校验**：三档模式（off/loose/strict）
- **优雅关闭**：SIGTERM/SIGINT 信号处理，连接平滑迁移
- **内存保护**：超阈值告警，防止 OOM
- **日志脱敏**：默认目标地址仅显示前3字符，需 `LOG_SENSITIVE=true` 才显示完整
- **客户端 IP 脱敏**：内存中仅存储 SHA256 哈希，不存储原始 IP
- **连接记录即时清除**：连接关闭后立即清零所有敏感字段

## 业务规则引擎

服务内置完整的业务规则引擎，模拟真实企业库存管理系统：

### 库存分配器（InventoryAllocator）
- 贪心算法，多仓库智能分配
- 支持优先仓库、库存充足度、使用率排序
- 可获取某 SKU 的总可用库存

### 同步优先级计算器（SyncPriorityCalculator）
- 6 维度评分：同步类型、数据量、紧急程度、重试次数、仓库状态
- 分数转换为 4 级优先级（LOW/NORMAL/HIGH/CRITICAL）

### 仓库路由选择器（WarehouseRouter）
- 根据区域、容量、使用率选择最优仓库
- 负载均衡，避免选择已满仓库

### 库存预警引擎（InventoryAlertEngine）
- 基于可售天数、补货周期计算预警
- 4 级预警（NORMAL/WARNING/CRITICAL/OUT_OF_STOCK）
- 建议补货量计算

### 同步任务调度器（SyncJobScheduler）
- 优先级队列，最大并发控制
- 任务状态管理（PENDING/IN_PROGRESS/COMPLETED/FAILED）

## 业务算法库

### 库存周转率计算（InventoryTurnoverCalculator）
- 周转率、周转天数、持有成本
- 支持自定义时间段

### 同步延迟分析（SyncLatencyAnalyzer）
- P50/P90/P99 延迟统计
- 吞吐量计算（items/sec, bytes/sec）
- 延迟趋势检测（degrading/improving/stable）

### ABC 分类器（ABCClassifier）
- 80/15/5 法则分类
- A/B/C 三类商品统计

### 需求预测器（DemandForecaster）
- 简单移动平均、加权移动平均
- 预测误差（MAE）计算

### 安全库存计算器（SafetyStockCalculator）
- 基于服务水平、需求波动、补货周期
- 再订货点计算

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
| `/cdn/css/app.css` | CDN 样式资源（7天长缓存） |
| `/cdn/js/app.js` | CDN 脚本资源（7天长缓存） |
| `/cdn/img/logo.svg` | CDN 图片资源（7天长缓存） |

## 项目结构

```
├── Dockerfile              # 容器构建配置（多阶段构建，生产环境压缩混淆）
├── docker-compose.yml      # Docker Compose 编排（主服务，资源限制+健康检查）
├── build.js                # 生产构建脚本（terser 压缩混淆）
├── server.js               # 服务端入口（平台检测+环境变量加载）
├── app.js                  # 应用入口（SyncFlowApp 类，编程式启动）
├── main.js                 # 主程序入口（命令行参数解析）
├── package.json            # 项目配置
├── package-lock.json       # 依赖锁定
├── README.md               # 项目文档
├── .dockerignore           # Docker 忽略文件
├── .gitignore              # Git 忽略文件
├── config/                 # 配置文件（分散管理）
│   ├── index.js            # 配置合并入口
│   ├── app.config.js       # 应用配置
│   ├── security.config.js  # 安全配置
│   ├── sync.config.js      # 同步配置
│   └── logging.config.js   # 日志配置
└── src/
    ├── index.js            # 服务入口：HTTP 路由、升级处理、优雅关闭、稳定性模块集成
    ├── config.js           # 配置中心与启动校验（引用 config/ 目录）
    ├── logger.js           # 企业级日志组件（双格式、5级别、请求ID、脱敏）
    ├── auth.js             # 租户身份认证
    ├── connection.js       # WebSocket 连接管理（生命周期、心跳、统计、空闲清理）
    ├── frame.js            # 数据帧处理（首帧解析、认证、响应、TCP/UDP 分发）
    ├── circuit.js          # 智能重试与熔断机制（兼容层）
    ├── resilience.js       # 服务韧性模块（异常自愈、内存管理、性能监控、连接巡检）
    ├── security.js         # 安全防护（端点过滤、认证限流、IP 封禁、DNS 缓存）
    ├── platform.js         # 多平台自适应配置（15+ PaaS 平台）
    ├── api.js              # 业务 API 接口（仓库/库存/同步任务完整 CRUD）
    ├── static.js           # 静态资源服务（favicon/robots/manifest/sw.js 等）
    ├── device.js           # 设备配置下发
    ├── traffic-simulator.js # 业务流量模拟器（自适应间隔、用户会话、事件流模拟）
    ├── event-stream.js     # 业务事件推送引擎（SSE 实时事件流）
    ├── swagger.js          # OpenAPI 3.0 规范与 API 文档页面
    ├── event-bus.js        # 事件总线（发布/订阅模式）
    ├── sync-facade.js      # 同步服务门面（门面模式，封装核心引擎）
    ├── realtime-ws.js      # 实时业务消息 WebSocket
    ├── tracing.js          # 分布式追踪模块
    ├── lib/                # 防腐层（Anti-Corruption Layer）
    │   └── net/
    │       ├── socket-facade.cjs  # Socket 运行时门面（CJS 绑定点）
    │       └── socket-facade.mjs  # Socket 运行时门面（ESM 绑定点）
    ├── vendor/             # 内置运行时（Vendored Runtime，零外部依赖）
    │   ├── VENDORED.json   # 内置件清单（版本、来源、许可、sha256 校验）
    │   └── socket-runtime/ # Socket 运行时（纯 JS 实现，18 个文件）
    ├── core/               # 核心引擎层（12 个细粒度模块）
    │   ├── frame-header.js # 批次头解析器
    │   ├── address-resolver.js # 节点地址解析器
    │   ├── addon-parser.js # 扩展元数据解析器
    │   ├── auth-validator.js # 租户认证验证器
    │   ├── response-builder.js # 批次确认响应构建器
    │   ├── upstream-connector.js # 上游连接管理器
    │   ├── stream-pipeline.js # 数据流管道（核心 TCP 透传）
    │   ├── packet-router.js # 数据包路由器（UDP）
    │   ├── buffer-pool.js  # 缓冲区池管理器
    │   ├── backpressure-controller.js # 流量控制器
    │   ├── circuit-breaker.js # 弹性控制器（熔断+重试）
    │   └── metrics-collector.js # 同步指标收集器
    ├── business/           # 业务逻辑层（11 个模块）
    │   ├── index.js        # 统一导出入口
    │   ├── constants.js    # 业务常量与枚举（15 种枚举）
    │   ├── models.js       # 业务数据模型（仓库/库存/订单/同步任务）
    │   ├── rules.js        # 业务规则引擎（5 大引擎）
    │   ├── algorithms.js   # 业务算法库（5 大算法）
    │   ├── metrics.js      # 业务指标计算
    │   ├── data-lifecycle.js    # 业务数据生命周期模拟（库存波动/任务流转/仓库负载）
    │   ├── user-simulator.js    # 用户行为轨迹模拟器（真实会话/浏览/操作序列）
    │   ├── session-orchestrator.js # 会话编排器（多用户并发会话管理）
    │   ├── temporal-engine.js   # 时间模式引擎（日/周/月业务节律模拟）
    │   └── correlation-engine.js # 多维度关联引擎（流量-业务-系统指标关联）
    ├── system/             # 系统运行模拟层（3 个模块）
    │   ├── fingerprint.js  # 系统指纹模拟器（CPU/内存/磁盘/网络指标伪造）
    │   ├── environment-fingerprint.js # 环境指纹模拟器（DB/缓存连接探测、进程信息）
    │   └── simulator-traffic-controller.js # 模拟器流量控制器（智能降频+配额管控）
    └── pages/              # Web 控制台（10 个页面模块）
        ├── index.js        # 路由分发主入口
        ├── shared.js       # 共享布局与内联 CSS
        ├── dashboard.js    # 仪表盘页面
        ├── login.js        # 登录页面
        ├── inventory.js    # 库存管理页面
        ├── warehouses.js   # 仓库管理页面
        ├── sync.js         # 同步任务页面
        ├── settings.js     # 系统设置页面
        ├── docs.js         # API 文档页面
        └── about.js        # 关于页面
```

## 测试

项目使用 Node.js 内置测试运行器（`node:test`），零额外依赖。

```bash
# 运行全部测试
npm test

# 或直接运行
node --test
```

测试覆盖：
- **核心协议测试**（`test/p0-core.test.js`）：认证签名、帧头解析、SSRF 过滤、IPv6 保留地址、XFF 校验、内置件 sha256 一致性等 16 项
- **根因修复验证**（`test/r5-p0-root-cause.test.js`）：模块副作用、定时器 unref、回调守卫等 4 项

## 许可证

Proprietary License
