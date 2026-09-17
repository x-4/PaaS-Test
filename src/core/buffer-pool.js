// ====================================================================
// 缓冲区池管理器
// 企业库存同步平台 - 数据缓冲区复用与内存优化
// 负责缓冲区分配、复用、回收，减少 GC 压力
// ====================================================================

/**
 * 缓冲区池配置
 */
const PoolConfig = {
    MAX_POOL_SIZE: 128,           // 池中最大缓冲区数量
    DEFAULT_BUFFER_SIZE: 64 * 1024, // 默认缓冲区大小（64KB）
    MAX_BUFFER_SIZE: 1024 * 1024,   // 最大缓冲区大小（1MB）
    MIN_BUFFER_SIZE: 1024           // 最小缓冲区大小（1KB）
};

/**
 * 可复用缓冲区类
 * 封装一个 Buffer，提供引用计数和自动回收
 */
class ReusableBuffer {
    constructor(size) {
        this.buffer = Buffer.alloc(size);
        this.size = size;
        this.length = 0;  // 实际使用长度
        this.referenceCount = 0;
        this.inUse = false;
        this.lastUsed = 0;
    }

    /**
     * 写入数据
     */
    write(data, offset = 0) {
        const len = Math.min(data.length, this.size - offset);
        data.copy(this.buffer, offset, 0, len);
        this.length = Math.max(this.length, offset + len);
        return len;
    }

    /**
     * 获取实际使用的数据
     */
    getData() {
        return this.buffer.subarray(0, this.length);
    }

    /**
     * 增加引用计数
     */
    retain() {
        this.referenceCount++;
        this.inUse = true;
        return this;
    }

    /**
     * 减少引用计数
     */
    release() {
        this.referenceCount--;
        if (this.referenceCount <= 0) {
            this.referenceCount = 0;
            this.inUse = false;
            this.lastUsed = Date.now();
        }
        return this;
    }

    /**
     * 重置缓冲区
     */
    reset() {
        this.length = 0;
        this.buffer.fill(0);
    }

    /**
     * 转换为普通 Buffer（拷贝）
     */
    toBuffer() {
        return Buffer.from(this.getData());
    }
}

/**
 * 缓冲区池类
 * 管理可复用缓冲区的分配和回收
 */
class BufferPool {
    constructor(options = {}) {
        this.maxSize = options.maxSize || PoolConfig.MAX_POOL_SIZE;
        this.defaultSize = options.defaultSize || PoolConfig.DEFAULT_BUFFER_SIZE;
        this.pool = [];
        this.totalAllocated = 0;
        this.totalReused = 0;
        this.totalCreated = 0;
    }

    /**
     * 从池中获取缓冲区
     * @param {number} size - 需要的大小
     * @returns {ReusableBuffer} 缓冲区
     */
    acquire(size = this.defaultSize) {
        // 规范化大小
        size = Math.max(PoolConfig.MIN_BUFFER_SIZE, Math.min(size, PoolConfig.MAX_BUFFER_SIZE));

        // 尝试从池中找合适的缓冲区
        const idx = this.pool.findIndex(b => b.size >= size && !b.inUse);
        if (idx !== -1) {
            const buf = this.pool[idx];
            buf.reset();
            buf.retain();
            this.totalReused++;
            return buf;
        }

        // 创建新缓冲区
        const buf = new ReusableBuffer(size);
        buf.retain();
        this.totalCreated++;

        if (this.pool.length < this.maxSize) {
            this.pool.push(buf);
        }

        return buf;
    }

    /**
     * 释放缓冲区回池
     */
    release(buffer) {
        if (buffer) {
            buffer.release();
        }
    }

    /**
     * 清理长时间未使用的缓冲区
     */
    cleanup(maxAgeMs = 5 * 60 * 1000) {
        const now = Date.now();
        const before = this.pool.length;
        this.pool = this.pool.filter(b => b.inUse || (now - b.lastUsed < maxAgeMs));
        return before - this.pool.length;
    }

    /**
     * 获取池统计
     */
    getStats() {
        const inUse = this.pool.filter(b => b.inUse).length;
        return {
            poolSize: this.pool.length,
            inUse,
            available: this.pool.length - inUse,
            totalCreated: this.totalCreated,
            totalReused: this.totalReused,
            reuseRate: this.totalCreated > 0
                ? Math.round((this.totalReused / (this.totalCreated + this.totalReused)) * 100)
                : 0
        };
    }
}

// 全局缓冲区池实例
const bufferPool = new BufferPool();

/**
 * 重试缓冲区类
 * 用于连接重试期间缓冲客户端数据
 */
class RetryBuffer {
    constructor(maxBytes = 1024 * 1024) {
        this.chunks = [];
        this.totalBytes = 0;
        this.maxBytes = maxBytes;
    }

    /**
     * 添加数据块
     * @returns {boolean} 是否成功（超过上限返回 false）
     */
    push(chunk) {
        if (this.totalBytes + chunk.length > this.maxBytes) {
            return false;
        }
        this.chunks.push(chunk);
        this.totalBytes += chunk.length;
        return true;
    }

    /**
     * 获取所有数据的合并 Buffer
     */
    getData() {
        return Buffer.concat(this.chunks);
    }

    /**
     * 清空缓冲区
     */
    clear() {
        this.chunks = [];
        this.totalBytes = 0;
    }

    /**
     * 获取当前大小
     */
    get size() {
        return this.totalBytes;
    }

    /**
     * 是否为空
     */
    get isEmpty() {
        return this.chunks.length === 0;
    }
}

module.exports = {
    PoolConfig,
    ReusableBuffer,
    BufferPool,
    bufferPool,
    RetryBuffer
};
