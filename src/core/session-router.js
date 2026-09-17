// ====================================================================
// 同步会话路由器
// 企业库存同步平台 - 会话路由与分发
// 根据同步模式（流/数据报）将批次分发到对应的处理器
// ====================================================================

const logger = require('../logger');
const { maskAddress } = require('../logger');
const { CONFIG } = require('../config');

/**
 * 同步会话状态枚举
 */
const SessionState = {
    INITIALIZING: 'initializing',
    AUTHENTICATED: 'authenticated',
    STREAM_ACTIVE: 'stream_active',
    DATAGRAM_ACTIVE: 'datagram_active',
    CLOSING: 'closing',
    CLOSED: 'closed',
    ERROR: 'error'
};

/**
 * 同步会话类
 * 封装一个完整的同步会话状态
 */
class SyncSession {
    constructor(sessionId, clientAddress) {
        this.sessionId = sessionId;
        this.clientAddress = clientAddress;
        this.state = SessionState.INITIALIZING;
        this.mode = null;  // 'stream' | 'datagram'
        this.targetEndpoint = null;
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
        this.bytesIn = 0;
        this.bytesOut = 0;
        this.batchCount = 0;
        this.processor = null;  // 流处理器或数据报处理器
    }

    /**
     * 标记会话为已认证
     */
    setAuthenticated(mode, targetEndpoint) {
        this.mode = mode;
        this.targetEndpoint = targetEndpoint;
        this.state = SessionState.AUTHENTICATED;
        this.updatedAt = Date.now();
    }

    /**
     * 标记会话为活跃状态
     */
    setActive() {
        this.state = this.mode === 'stream'
            ? SessionState.STREAM_ACTIVE
            : SessionState.DATAGRAM_ACTIVE;
        this.updatedAt = Date.now();
    }

    /**
     * 记录入站字节
     */
    recordInbound(bytes) {
        this.bytesIn += bytes;
        this.batchCount++;
        this.updatedAt = Date.now();
    }

    /**
     * 记录出站字节
     */
    recordOutbound(bytes) {
        this.bytesOut += bytes;
        this.updatedAt = Date.now();
    }

    /**
     * 获取会话持续时间（毫秒）
     */
    get durationMs() {
        return Date.now() - this.createdAt;
    }

    /**
     * 获取会话速率（字节/秒）
     */
    get bytesPerSecond() {
        const seconds = this.durationMs / 1000;
        return seconds > 0 ? Math.round((this.bytesIn + this.bytesOut) / seconds) : 0;
    }

    /**
     * 转换为统计格式
     */
    toStats() {
        return {
            sessionId: this.sessionId,
            state: this.state,
            mode: this.mode,
            target: this.targetEndpoint ? this.targetEndpoint.toMaskedFormat() : null,
            durationMs: this.durationMs,
            bytesIn: this.bytesIn,
            bytesOut: this.bytesOut,
            batchCount: this.batchCount,
            createdAt: new Date(this.createdAt).toISOString()
        };
    }
}

/**
 * 会话路由器类
 * 负责创建、路由和管理同步会话
 */
class SessionRouter {
    constructor() {
        this.sessions = new Map();  // sessionId -> SyncSession
        this.maxSessions = 10000;
    }

    /**
     * 创建新会话
     */
    createSession(clientAddress) {
        const sessionId = 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
        const session = new SyncSession(sessionId, clientAddress);
        this.sessions.set(sessionId, session);
        return session;
    }

    /**
     * 路由首帧批次
     * 根据批次头信息决定走流模式还是数据报模式
     */
    routeInitialBatch(session, batchHeader, batchData, ws, cleanup) {
        const { resolveNodeEndpoint, EndpointValidator } = require('./address-resolver');

        // 解析目标端点
        const endpoint = resolveNodeEndpoint(
            batchHeader.addrFormat,
            batchHeader.targetEndpoint,
            batchHeader.targetPort
        );

        session.setAuthenticated(
            batchHeader.isStreamMode ? 'stream' : 'datagram',
            endpoint
        );

        logger.debug(`Batch accepted: ${maskAddress(endpoint.address)}:${endpoint.port} mode=${batchHeader.syncMode} batch=${batchData.length}B from ${session.clientAddress}`);

        // 数据报模式（UDP）
        if (batchHeader.isDatagramMode) {
            return this._routeDatagram(session, endpoint, batchData, ws, cleanup);
        }

        // 流模式（TCP）
        return this._routeStream(session, endpoint, batchHeader, batchData, ws, cleanup);
    }

    /**
     * 路由到流模式处理器
     */
    _routeStream(session, endpoint, batchHeader, batchData, ws, cleanup) {
        // 端点过滤
        if (CONFIG.ENDPOINT_FILTER && !endpoint.isHostname && EndpointValidator.isReserved(endpoint.address)) {
            logger.warn(`Endpoint not allowed: ${maskAddress(endpoint.address)}`);
            cleanup();
            return null;
        }

        const connectOptions = {
            host: endpoint.address,
            port: endpoint.port,
            idleTimeout: CONFIG.IDLE_TIMEOUT
        };

        // 域名需要自定义 DNS 解析
        if (CONFIG.ENDPOINT_FILTER && endpoint.isHostname) {
            const { resolveEndpoint } = require('../security');
            connectOptions.lookup = resolveEndpoint;
        }

        const { createOutboundPipeline } = require('./stream-pipeline');
        const pipeline = createOutboundPipeline({
            targetHost: endpoint.address,
            targetPort: endpoint.port,
            connectOptions,
            initialBatch: batchData,
            ws,
            cleanup,
            clientAddress: session.clientAddress,
            session
        });

        session.processor = pipeline;
        session.setActive();
        return pipeline;
    }

    /**
     * 路由到数据报模式处理器
     */
    _routeDatagram(session, endpoint, batchData, ws, cleanup) {
        // 数据报模式仅允许 DNS（端口53）
        if (endpoint.port !== 53) {
            cleanup();
            return null;
        }

        logger.debug(`Datagram mode: ${maskAddress(endpoint.address)}:${endpoint.port} batch=${batchData.length}B`);

        const { createDatagramForwarder, processPacketQueue } = require('./datagram-forwarder');
        const forwarder = createDatagramForwarder(ws, endpoint.address, endpoint.port);

        session.processor = forwarder;
        session.datagramState = { buffer: batchData };
        session.setActive();

        processPacketQueue(session.datagramState, forwarder);
        return forwarder;
    }

    /**
     * 路由后续批次
     */
    routeSubsequentBatch(session, batchData, cleanup) {
        session.recordInbound(batchData.length);

        if (session.mode === 'datagram' && session.datagramState) {
            session.datagramState.buffer = Buffer.concat([session.datagramState.buffer, batchData]);
            if (session.datagramState.buffer.length > 65536) {
                cleanup();
                return;
            }
            const { processPacketQueue } = require('./datagram-forwarder');
            processPacketQueue(session.datagramState, session.processor);
        } else if (session.processor && session.processor.write) {
            session.processor.write(batchData);
        }
    }

    /**
     * 销毁会话
     */
    destroySession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (session.processor && session.processor.destroy) {
                session.processor.destroy();
            }
            session.state = SessionState.CLOSED;
            this.sessions.delete(sessionId);
        }
    }

    /**
     * 获取活跃会话数
     */
    get activeCount() {
        return this.sessions.size;
    }

    /**
     * 获取所有会话统计
     */
    getAllStats() {
        return [...this.sessions.values()].map(s => s.toStats());
    }
}

// 全局路由器实例
const sessionRouter = new SessionRouter();

module.exports = {
    SessionState,
    SyncSession,
    SessionRouter,
    sessionRouter
};
