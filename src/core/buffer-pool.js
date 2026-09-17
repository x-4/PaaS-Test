// ====================================================================
// 缓冲区池管理器
// 企业库存同步平台 - 数据缓冲区复用与内存优化
// 负责缓冲区分配、复用、回收，减少 GC 压力
// ====================================================================

/**
 * 缓冲区池配置
 */
const PoolConfig = {
    MAX_POOL_SIZE: 256,           // 池中最大缓冲区数量
    DEFAULT_BUFFER_SIZE: 64 * 1024, // 默认缓冲区大小（64KB）
    MAX_BUFFER_SIZE: 1024 * 1024,   // 最大缓冲区大小（1MB）
    MIN_BUFFER_SIZE: 1024,           // 最小缓冲区大小（1KB）
    // 分桶大小（按2的幂次分桶，提高命中率）
    BUCKET_SIZES: [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
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
 * 使用多级分桶机制，按大小分类存储，提高命中率
 */
class BufferPool {
    constructor(options = {}) {
        this.maxSize = options.maxSize || PoolConfig.MAX_POOL_SIZE;
        this.defaultSize = options.defaultSize || PoolConfig.DEFAULT_BUFFER_SIZE;
        // 分桶存储：key是桶大小，value是缓冲区数组
        this.buckets = new Map();
        this.totalAllocated = 0;
        this.totalReused = 0;
        this.totalCreated = 0;
        // 初始化分桶
        PoolConfig.BUCKET_SIZES.forEach(size => {
            this.buckets.set(size, []);
        });
    }

    /**
     * 获取适合指定大小的桶大小
     */
    _getBucketSize(size) {
        for (const bucketSize of PoolConfig.BUCKET_SIZES) {
            if (size <= bucketSize) return bucketSize;
        }
        return PoolConfig.MAX_BUFFER_SIZE;
    }

    /**
     * 从池中获取缓冲区
     * @param {number} size - 需要的大小
     * @returns {ReusableBuffer} 缓冲区
     */
    acquire(size = this.defaultSize) {
        // 规范化大小
        size = Math.max(PoolConfig.MIN_BUFFER_SIZE, Math.min(size, PoolConfig.MAX_BUFFER_SIZE));
        const bucketSize = this._getBucketSize(size);
        const bucket = this.buckets.get(bucketSize) || [];

        // 尝试从对应桶中找空闲缓冲区
        const idx = bucket.findIndex(b => !b.inUse);
        if (idx !== -1) {
            const buf = bucket[idx];
            buf.reset();
            buf.retain();
            this.totalReused++;
            return buf;
        }

        // 创建新缓冲区
        const buf = new ReusableBuffer(bucketSize);
        buf.retain();
        this.totalCreated++;

        // 计算总池大小
        let totalInPool = 0;
        this.buckets.forEach(b => totalInPool += b.length);

        if (totalInPool < this.maxSize) {
            bucket.push(buf);
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
     * 预分配缓冲区（启动预热）
     */
    preallocate(count = 16, size = this.defaultSize) {
        const bucketSize = this._getBucketSize(size);
        const bucket = this.buckets.get(bucketSize);
        if (!bucket) return;

        for (let i = 0; i < count && bucket.length < this.maxSize; i++) {
            const buf = new ReusableBuffer(bucketSize);
            bucket.push(buf);
            this.totalCreated++;
        }
    }

    /**
     * 清理长时间未使用的缓冲区
     */
    cleanup(maxAgeMs = 5 * 60 * 1000) {
        const now = Date.now();
        let cleaned = 0;
        this.buckets.forEach(bucket => {
            const before = bucket.length;
            for (let i = bucket.length - 1; i >= 0; i--) {
                if (!bucket[i].inUse && (now - bucket[i].lastUsed > maxAgeMs)) {
                    bucket.splice(i, 1);
                    cleaned++;
                }
            }
        });
        return cleaned;
    }

    /**
     * 获取池统计
     */
    getStats() {
        let poolSize = 0;
        let inUse = 0;
        this.buckets.forEach(bucket => {
            poolSize += bucket.length;
            inUse += bucket.filter(b => b.inUse).length;
        });
        return {
            poolSize,
            inUse,
            available: poolSize - inUse,
            buckets: this.buckets.size,
            totalCreated: this.totalCreated,
            totalReused: this.totalReused,
            reuseRate: (this.totalCreated + this.totalReused) > 0
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
