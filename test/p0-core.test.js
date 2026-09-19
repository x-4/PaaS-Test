// ====================================================================
// SyncFlow 核心模块单元测试
// 覆盖租户认证、端点安全、批次头解析、配置校验等核心业务逻辑
// 使用Node内置node:test，零新依赖
// ====================================================================

const { test } = require('node:test');
const assert = require('node:assert');

// 测试1: auth.js - deriveTenantKey 和 verifyTenantSignature
test('auth: 租户签名校验正确验证同步批次头', () => {
    const { verifyTenantSignature } = require('../src/auth');
    const uuid = '820a85fa-419f-401a-94a8-508391354638';
    
    // 构造标准同步批次头：[版本(1)][租户ID(16)][附加长度(1)][...]
    const uuidBuf = Buffer.from(uuid.replace(/-/g, ''), 'hex');
    const frame = Buffer.concat([Buffer.from([0]), uuidBuf, Buffer.from([0])]);
    
    assert.strictEqual(verifyTenantSignature(frame), true, '正确租户ID应验证通过');
});

test('auth: 租户签名校验拒绝非法租户ID', () => {
    const { verifyTenantSignature } = require('../src/auth');
    // 构造非法租户ID的批次头
    const wrongUuid = '00000000-0000-0000-0000-000000000000';
    const uuidBuf = Buffer.from(wrongUuid.replace(/-/g, ''), 'hex');
    const frame = Buffer.concat([Buffer.from([0]), uuidBuf, Buffer.from([0])]);
    
    assert.strictEqual(verifyTenantSignature(frame), false, '非法租户ID应验证失败');
});

// 测试2: 端点安全过滤 - 受限地址识别
test('security: 端点过滤正确识别IPv4受限地址', () => {
    const { isReservedAddress } = require('../src/security');
    
    assert.strictEqual(isReservedAddress('127.0.0.1'), true, '本地环回应受限');
    assert.strictEqual(isReservedAddress('10.0.0.1'), true, '10段私网应受限');
    assert.strictEqual(isReservedAddress('192.168.1.1'), true, '192.168段私网应受限');
    assert.strictEqual(isReservedAddress('172.16.0.1'), true, '172.16段私网应受限');
    assert.strictEqual(isReservedAddress('169.254.1.1'), true, '链路本地应受限');
    assert.strictEqual(isReservedAddress('8.8.8.8'), false, '公网IP不应受限');
    assert.strictEqual(isReservedAddress('93.184.216.34'), false, '业务目标IP不应受限');
});

test('security: 端点过滤正确识别IPv6受限地址（含展开形式）', () => {
    const { isReservedAddress } = require('../src/security');
    
    assert.strictEqual(isReservedAddress('::1'), true, '压缩形式本地环回应受限');
    assert.strictEqual(isReservedAddress('0:0:0:0:0:0:0:1'), true, '展开形式本地环回应受限');
    assert.strictEqual(isReservedAddress('fe80::1'), true, '链路本地应受限');
    assert.strictEqual(isReservedAddress('fc00::1'), true, '唯一本地应受限');
    assert.strictEqual(isReservedAddress('fd00::1'), true, '唯一本地应受限');
    assert.strictEqual(isReservedAddress('ff00::1'), true, '组播应受限');
    assert.strictEqual(isReservedAddress('::'), true, '未指定地址应受限');
});

test('security: getClientAddress 正确提取客户端地址', () => {
    const { getClientAddress } = require('../src/security');

    // 默认不采信 XFF（安全加固 H-3）：即使携带 XFF 也使用 socket 直连地址，防止伪造绕过限流
    const req1 = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '5.6.7.8' }
    };
    assert.strictEqual(getClientAddress(req1), '5.6.7.8', '默认不采信XFF，使用socket地址');

    const req2 = {
        headers: {},
        socket: { remoteAddress: '5.6.7.8' }
    };
    assert.strictEqual(getClientAddress(req2), '5.6.7.8', '无XFF时使用socket地址');
});

// 测试3: 批次头解析器 - parseBatchHeader
test('frame-header: 批次头解析器正确解析标准同步数据头', () => {
    const { parseBatchHeader } = require('../src/core/frame-header');
    
    // 构造标准同步数据头：[版本][租户ID(16)][附加长度=0][传输模式=1][端口=80][地址类型=2(域名)][地址长度][地址][业务数据]
    const uuid = '820a85fa-419f-401a-94a8-508391354638';
    const uuidBuf = Buffer.from(uuid.replace(/-/g, ''), 'hex');
    const portBuf = Buffer.alloc(2);
    portBuf.writeUInt16BE(80, 0);
    const hostBuf = Buffer.from('example.com', 'utf8');
    const frame = Buffer.concat([
        Buffer.from([0]),           // 版本
        uuidBuf,                     // UUID
        Buffer.from([0]),            // 附加长度
        Buffer.from([1]),            // 传输模式(TCP)
        portBuf,                     // 端口
        Buffer.from([2]),            // 地址类型(域名)
        Buffer.from([hostBuf.length]), // 地址长度
        hostBuf,                     // 地址
        Buffer.from('test payload')  // 业务数据
    ]);
    
    const result = parseBatchHeader(frame);
    assert.ok(result, '应成功解析');
    assert.strictEqual(result.targetPort, 80, '端口应为80');
    assert.strictEqual(result.addrFormat, 3, '地址格式应为3(域名模式)');
});

test('frame-header: 批次头解析器拒绝无效端口', () => {
    const { parseBatchHeader } = require('../src/core/frame-header');
    
    const uuid = '820a85fa-419f-401a-94a8-508391354638';
    const uuidBuf = Buffer.from(uuid.replace(/-/g, ''), 'hex');
    // 端口0（无效端口）
    const portBuf = Buffer.alloc(2);
    portBuf.writeUInt16BE(0, 0);
    const hostBuf = Buffer.from('example.com', 'utf8');
    const frame = Buffer.concat([
        Buffer.from([0]), uuidBuf, Buffer.from([0]), Buffer.from([1]),
        portBuf, Buffer.from([2]), Buffer.from([hostBuf.length]), hostBuf
    ]);
    
    const result = parseBatchHeader(frame);
    assert.strictEqual(result, null, '端口0应返回null');
});

// 测试4: 配置中心 - 配置加载校验
test('config: 配置正确加载且包含必要字段', () => {
    const { CONFIG } = require('../src/config');
    
    assert.ok(CONFIG, 'CONFIG应存在');
    assert.ok(CONFIG.PORT, '应包含PORT');
    assert.ok(CONFIG.MAX_CONNECTIONS, '应包含MAX_CONNECTIONS');
    assert.ok(CONFIG.ENDPOINT_FILTER !== undefined, '应包含ENDPOINT_FILTER');
});

console.log('\n=== SyncFlow 核心测试集加载完成 ===');
console.log('运行: npm test');




// ====================================================================
// 端点安全回归测试
// 覆盖：IPv4映射形式校验 + XFF格式校验 + 受限地址边界验证
// ====================================================================

test('security: 端点过滤拦截 IPv4映射十六进制形式', () => {
    const { isReservedAddress } = require('../src/security');

    // 本地环回映射（十六进制形式）
    assert.strictEqual(isReservedAddress('::ffff:7f00:1'), true, '::ffff:7f00.1 应拦截（本地环回）');
    // 同步协议展开形式
    assert.strictEqual(isReservedAddress('0:0:0:0:0:ffff:7f00:1'), true, '展开形式映射应拦截');
    // 点分十进制形式
    assert.strictEqual(isReservedAddress('::ffff:127.0.0.1'), true, '点分形式映射应拦截');

    // 私网地址映射
    assert.strictEqual(isReservedAddress('::ffff:a00:1'), true, '::ffff:10.0.0.1 应拦截');
    assert.strictEqual(isReservedAddress('::ffff:ac10:1'), true, '::ffff:172.16.0.1 应拦截');
    assert.strictEqual(isReservedAddress('::ffff:c0a8:101'), true, '::ffff:192.168.1.1 应拦截');
    assert.strictEqual(isReservedAddress('::ffff:a9fe:101'), true, '::ffff:169.254.1.1 应拦截');
});

test('security: 端点过滤拦截 fe80::/10 全段', () => {
    const { isReservedAddress } = require('../src/security');

    assert.strictEqual(isReservedAddress('fe80::1'), true, 'fe80::1 应拦截');
    assert.strictEqual(isReservedAddress('febf::1'), true, 'febf::1 应拦截（fe80::/10上界）');
    assert.strictEqual(isReservedAddress('fe80:ffff::1'), true, 'fe80:ffff::1 应拦截');
});

test('security: 端点过滤放行公网地址（防过度拦截）', () => {
    const { isReservedAddress } = require('../src/security');

    assert.strictEqual(isReservedAddress('2001:db8::1'), false, '文档地址不应拦截');
    assert.strictEqual(isReservedAddress('::ffff:8.8.8.8'), false, '::ffff:8.8.8.8 不应拦截');
    assert.strictEqual(isReservedAddress('::ffff:1.1.1.1'), false, '::ffff:1.1.1.1 不应拦截');
    assert.strictEqual(isReservedAddress('2606:4700:4700::1111'), false, '公网DNS不应拦截');
});

test('security: 客户端地址提取拒绝非法XFF并回退socket地址', () => {
    const { getClientAddress } = require('../src/security');

    const socketAddr = '198.51.100.7';

    // 纯十六进制字符串（非法格式）
    assert.strictEqual(
        getClientAddress({ headers: { 'x-forwarded-for': 'deadbeef' }, socket: { remoteAddress: socketAddr } }),
        socketAddr, 'deadbeef 应回退'
    );
    // 单字符
    assert.strictEqual(
        getClientAddress({ headers: { 'x-forwarded-for': 'a' }, socket: { remoteAddress: socketAddr } }),
        socketAddr, 'a 应回退'
    );
    // 不完整IPv6
    assert.strictEqual(
        getClientAddress({ headers: { 'x-forwarded-for': 'cafe:beef' }, socket: { remoteAddress: socketAddr } }),
        socketAddr, 'cafe:beef 应回退'
    );
    // 含特殊字符
    assert.strictEqual(
        getClientAddress({ headers: { 'x-forwarded-for': 'not-an-ip!!' }, socket: { remoteAddress: socketAddr } }),
        socketAddr, 'not-an-ip!! 应回退'
    );
});

test('security: 客户端地址提取在可信代理模式下采信合法XFF', () => {
    // TRUST_PROXY 在模块加载时读取，需先设环境变量再清缓存重加载
    process.env.TRUST_PROXY = 'true';
    delete require.cache[require.resolve('../src/security')];
    const { getClientAddress } = require('../src/security');

    try {
        // 合法IPv4 — 直连peer必须在可信网段（127.0.0.1）
        assert.strictEqual(
            getClientAddress({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '127.0.0.1' } }),
            '1.2.3.4', '可信代理+合法IPv4应采信XFF'
        );
        // 合法IPv6
        assert.strictEqual(
            getClientAddress({ headers: { 'x-forwarded-for': '2001:db8::1' }, socket: { remoteAddress: '127.0.0.1' } }),
            '2001:db8::1', '可信代理+合法IPv6应采信XFF'
        );
        // 多段XFF从右侧起数1跳（默认TRUST_PROXY_HOPS=1）
        assert.strictEqual(
            getClientAddress({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: { remoteAddress: '127.0.0.1' } }),
            '5.6.7.8', '多段XFF从右侧起数1跳'
        );
        // 非可信peer即使开了TRUST_PROXY也不采信
        assert.strictEqual(
            getClientAddress({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '5.6.7.8' } }),
            '5.6.7.8', '非可信peer不采信XFF'
        );
    } finally {
        // 恢复默认状态，避免影响后续测试
        delete process.env.TRUST_PROXY;
        delete require.cache[require.resolve('../src/security')];
        require('../src/security');
    }
});


// ====================================================================
// 业务模块扩展测试
// ====================================================================

// 地址格式白名单测试
test('frame-header: 地址格式无效值被拒绝', () => {
    const { parseBatchHeader } = require('../src/core/frame-header');
    const uuid = '820a85fa-419f-401a-94a8-508391354638';
    const uuidBuf = Buffer.from(uuid.replace(/-/g, ''), 'hex');

    function makeFrame(addrFormat) {
        // [版本(1)][租户ID(16)][附加长度(1)=0][同步模式(1)=1][端口(2)][地址格式(1)][地址...]
        const portBuf = Buffer.alloc(2);
        portBuf.writeUInt16BE(80, 0);
        const hostBuf = Buffer.from('example.com', 'utf8');
        return Buffer.concat([
            Buffer.from([0]), uuidBuf, Buffer.from([0]),
            Buffer.from([1]), portBuf,
            Buffer.from([addrFormat]),
            Buffer.from([hostBuf.length]), hostBuf
        ]);
    }

    // 有效值应通过（地址格式=2 域名模式）
    const valid = parseBatchHeader(makeFrame(2));
    assert.ok(valid !== null, '地址格式=2(域名)应通过');

    // 无效值应被拒绝
    assert.strictEqual(parseBatchHeader(makeFrame(0)), null, '地址格式=0应拒绝');
    assert.strictEqual(parseBatchHeader(makeFrame(4)), null, '地址格式=4应拒绝');
    assert.strictEqual(parseBatchHeader(makeFrame(255)), null, '地址格式=255应拒绝');
});

// 订单ID前缀测试
test('models: 订单ID根据类型生成正确前缀', () => {
    const { Order } = require('../src/business/models');

    const salesOrder = new Order({ type: 'sales' });
    assert.ok(salesOrder.id.startsWith('ORD-'), `销售订单应以ORD-开头，实际: ${salesOrder.id}`);

    const purchaseOrder = new Order({ type: 'purchase' });
    assert.ok(purchaseOrder.id.startsWith('PO-'), `采购订单应以PO-开头，实际: ${purchaseOrder.id}`);
});

// 内置运行时完整性校验（sha256）
test('vendored: 内置运行时 sha256 与清单一致', () => {
    const fs = require('fs');
    const crypto = require('crypto');
    const path = require('path');

    const vendoredPath = path.join(__dirname, '..', 'src', 'vendor', 'VENDORED.json');
    const vendored = JSON.parse(fs.readFileSync(vendoredPath, 'utf8'));

    const runtimeBase = path.join(__dirname, '..', 'src', 'vendor', 'socket-runtime');
    let verifiedCount = 0;
    for (const item of vendored.files) {
        const filePath = path.join(runtimeBase, item.path);
        assert.ok(fs.existsSync(filePath), `内置运行时文件不存在: ${item.path}`);

        const fileContent = fs.readFileSync(filePath);
        const actualSha = crypto.createHash('sha256').update(fileContent).digest('hex');
        const actualBytes = fileContent.length;

        assert.strictEqual(actualSha, item.sha256, `${item.path} sha256 不匹配（文件可能被修改）`);
        assert.strictEqual(actualBytes, item.bytes, `${item.path} bytes 不匹配`);
        verifiedCount++;
    }
    assert.strictEqual(verifiedCount, vendored.files.length, `完整性校验通过: ${verifiedCount}/${vendored.files.length} 个文件`);
});
