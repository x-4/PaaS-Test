# Inventory Sync Service

企业级库存实时同步微服务。基于 WebSocket 长连接的分布式数据集成节点，为多区域仓库库存管理系统提供低延迟、高可靠的实时数据同步能力。

## 架构

```
┌─────────────┐     WebSocket      ┌──────────────────┐     TCP      ┌──────────────┐
│  ERP / WMS  │ ◄────────────────► │  Inventory Sync  │ ◄──────────► │  Warehouse   │
│  Clients    │   /api/v2/...      │  Service Node    │              │  Endpoints   │
└─────────────┘                    └──────────────────┘              └──────────────┘
                                          │
                                          ├─ HTTP Dashboard (/)
                                          ├─ Health Check (/health, /healthz)
                                          └─ Device Config (/api/v1/auth/device/{token})
```

## 核心特性

- **实时数据同步**：WebSocket 长连接，支持流模式与数据包模式
- **多租户认证**：基于租户令牌的帧级身份校验
- **高可用设计**：连接数限制、空闲超时、心跳保活、优雅关闭
- **安全防护**：端点地址过滤、认证失败限流、跨站连接防护
- **可观测性**：健康检查端点、内存监控、结构化日志

## 快速开始

### 本地运行

```bash
npm install
npm start
```

服务默认监听 `3000` 端口。

### Docker 部署

```bash
docker build -t inventory-sync-service .
docker run -d -p 3000:3000 \
  -e TENANT_ID=your-tenant-uuid \
  -e PORT=3000 \
  inventory-sync-service
```

## 配置

所有配置通过环境变量注入：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TENANT_ID` | 内置开发值 | 租户身份令牌（UUID 格式） |
| `PORT` | 3000 | 服务监听端口 |
| `MAX_CONNECTIONS` | 500 | 最大并发连接数 |
| `IDLE_TIMEOUT` | 300000 | 连接空闲超时（毫秒） |
| `PING_INTERVAL` | 30000 | 心跳间隔（毫秒） |
| `MEMORY_LIMIT_MB` | 384 | 内存告警阈值 |
| `AUTH_MAX_FAILURES` | 5 | 认证失败封禁阈值 |
| `AUTH_WINDOW_MS` | 60000 | 认证计数时间窗口 |
| `AUTH_BAN_MS` | 300000 | 认证失败封禁时长 |
| `ENDPOINT_FILTER` | true | 端点地址过滤开关 |
| `LOG_LEVEL` | info | 日志级别（debug/info/warn/error） |

## API

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

所有端点均支持 `GET` 和 `HEAD` 请求，返回 `200 OK`（就绪探针在资源不足时返回 `503`）。

完整健康检查响应：
```json
{
  "status": "UP",
  "module": "InventorySync",
  "uptime": 1234.56,
  "activeConnections": 42,
  "memory": "128MB"
}
```

### 管理控制台

```
GET /
```

Web 仪表盘，展示同步批次、活跃流、延迟等实时指标。

### 设备配置下发

```
GET /api/v1/auth/device/{tenant_token}
```

为已认证的边缘节点生成接入配置（Base64 编码）。

### 实时数据同步

```
WebSocket Upgrade: /api/v2/inventory/live-stream
```

二进制数据帧协议，首帧包含租户认证与目标端点信息，后续帧为透传数据。

## 项目结构

```
├── Dockerfile
├── package.json
├── README.md
└── src/
    ├── index.js        # 服务入口：HTTP 路由、升级处理、优雅关闭
    ├── config.js       # 配置中心与启动校验
    ├── logger.js       # 分级日志组件
    ├── auth.js         # 租户身份认证
    ├── protocol.js     # 数据帧解析引擎
    ├── transport.js    # 实时数据同步引擎（WebSocket + 上游通道）
    ├── dns.js          # 遥测数据解析（数据包模式）
    ├── security.js     # 安全防护（端点过滤、认证限流）
    ├── tls-profile.js  # TLS 参数配置
    ├── dashboard.js    # 管理控制台页面
    ├── gateway.js      # 企业网关（前端流量转发）
    └── device.js       # 设备配置下发
```

## 许可证

MIT
