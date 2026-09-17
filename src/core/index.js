// ====================================================================
// 核心模块统一导出
// 企业库存同步平台 - 核心引擎入口
// 提供帧解析、认证、路由、转发、弹性、监控等核心能力
// ====================================================================

// 基础解析模块
const { BatchHeader, BatchHeaderValidator, parseBatchHeader } = require('./frame-header');
const { NodeEndpoint, AddressFormat, parseIPv4, parseHostname, parseIPv6, resolveNodeEndpoint, EndpointValidator } = require('./address-resolver');
const { BatchAddon, AddonType, AddonTypeName, TLVParser, parseBatchAddons, AddonCollector } = require('./addon-parser');

// 认证与响应模块
const { AuthResult, AuthEventLogger, TenantAuthenticator, authenticator, recordAuthEvent, clearAuthEvents } = require('./auth-validator');
const { ResponseType, SyncAckFrame, BatchAckBuilder, ResponseSender, sendBatchAck } = require('./response-builder');

// 会话路由模块
const { SessionState, SyncSession, SessionRouter, sessionRouter } = require('./session-router');

// 转发模块
const { ConnectionState, ConnectionConfig, isRetryableError, describeError, OutboundConnection, OutboundConnector, outboundConnector } = require('./outbound-connector');
const { DataPipeline, createOutboundPipeline, createOutboundConnector } = require('./stream-pipeline');
const { DatagramConfig, DatagramPacket, PacketQueue, DatagramForwarder, createDatagramForwarder, createUdpForwarder, processPacketQueue } = require('./datagram-forwarder');

// 缓冲与流控模块
const { PoolConfig, ReusableBuffer, BufferPool, bufferPool, RetryBuffer } = require('./buffer-pool');
const { BackpressureConfig, FlowState, BackpressureController, WriteQueue } = require('./backpressure-controller');

// 弹性模块
const { CircuitConfig, CircuitState, CircuitRecord, CircuitBreaker, RetryController, circuitBreaker, isCircuitOpen, recordConnectionSuccess, recordConnectionFailure, getRetryDelay, shouldRetry, recordRetry, getCircuitBreakerStats, MAX_RETRIES } = require('./circuit-breaker');

// 会话管理模块
const { SessionConfig, SessionInfo, SessionManager, sessionManager } = require('./session-manager');
const { HeartbeatConfig, NodeStatus, NodeInfo, HeartbeatPayload, HeartbeatService, heartbeatService, nodeInfo, generateHeartbeatPayload } = require('./heartbeat-service');
const { MetricsConfig, TrafficStats, ConnectionMetrics, MetricsCollector, metricsCollector, trafficStats, recordInboundTraffic } = require('./metrics-collector');

module.exports = {
    // 基础解析
    BatchHeader,
    BatchHeaderValidator,
    parseBatchHeader,
    NodeEndpoint,
    AddressFormat,
    parseIPv4,
    parseHostname,
    parseIPv6,
    resolveNodeEndpoint,
    EndpointValidator,
    BatchAddon,
    AddonType,
    AddonTypeName,
    TLVParser,
    parseBatchAddons,
    AddonCollector,

    // 认证与响应
    AuthResult,
    AuthEventLogger,
    TenantAuthenticator,
    authenticator,
    recordAuthEvent,
    clearAuthEvents,
    ResponseType,
    SyncAckFrame,
    BatchAckBuilder,
    ResponseSender,
    sendBatchAck,

    // 会话路由
    SessionState,
    SyncSession,
    SessionRouter,
    sessionRouter,

    // 转发
    ConnectionState,
    ConnectionConfig,
    isRetryableError,
    describeError,
    OutboundConnection,
    OutboundConnector,
    outboundConnector,
    DataPipeline,
    createOutboundPipeline,
    createOutboundConnector,  // 兼容旧接口
    DatagramConfig,
    DatagramPacket,
    PacketQueue,
    DatagramForwarder,
    createDatagramForwarder,
    createUdpForwarder,  // 兼容旧接口
    processPacketQueue,

    // 缓冲与流控
    PoolConfig,
    ReusableBuffer,
    BufferPool,
    bufferPool,
    RetryBuffer,
    BackpressureConfig,
    FlowState,
    BackpressureController,
    WriteQueue,

    // 弹性
    CircuitConfig,
    CircuitState,
    CircuitRecord,
    CircuitBreaker,
    RetryController,
    circuitBreaker,
    isCircuitOpen,
    recordConnectionSuccess,
    recordConnectionFailure,
    getRetryDelay,
    shouldRetry,
    recordRetry,
    getCircuitBreakerStats,
    getRetryStats,
    MAX_RETRIES,

    // 会话管理
    SessionConfig,
    SessionInfo,
    SessionManager,
    sessionManager,
    HeartbeatConfig,
    NodeStatus,
    NodeInfo,
    HeartbeatPayload,
    HeartbeatService,
    heartbeatService,
    nodeInfo,
    generateHeartbeatPayload,
    MetricsConfig,
    TrafficStats,
    ConnectionMetrics,
    MetricsCollector,
    metricsCollector,
    trafficStats,
    recordInboundTraffic
};
