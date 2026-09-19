// ====================================================================
// 最小测试集 - P0纯函数单元测试
// 使用Node内置node:test，零新依赖
// ====================================================================

const { test } = require('node:test');
const assert = require('node:assert');

// 测试1: auth.js - deriveTenantKey 和 verifyTenantSignature
test('auth: verifyTenantSignature 正确验证VLESS帧', () => {
    const { verifyTenantSignature } = require('../src/auth');
    const uuid = '820a85fa-419f-401a-94a8-508391354638';
    
    // 构造标准VLESS帧：[版本(1)][UUID(16)][附加长度(1)][...]
    const uuidBuf = Buffer.from(uuid.replace(/-/g, ''), 'hex');
    const frame = Buffer.concat([Buffer.from([0]), uuidBuf, Buffer.from([0])]);
    
    assert.strictEqual(verifyTenantSignature(frame), true, '正确UUID应验证通过');
});

test('auth: verifyTenantSignature 拒绝错误UUID', () => {
    const { verifyTenantSignature } = require('../src/auth');
    // 构造错误UUID的帧
    const wrongUuid = '00000000-0000-0000-0000-000000000000';
    const uuidBuf = Buffer.from(wrongUuid.replace(/-/g, ''), 'hex');
    const frame = Buffer.concat([Buffer.from([0]), uuidBuf, Buffer.from([0])]);
    
    assert.strictEqual(verifyTenantSignature(frame), false, '错误UUID应验证失败');
});

// 测试2: security.js - isReservedAddress
test('security: isReservedAddress 正确识别IPv4保留地址', () => {
    const { isReservedAddress } = require('../src/security');
    
    assert.strictEqual(isReservedAddress('127.0.0.1'), true, '回环地址应保留');
    assert.strictEqual(isReservedAddress('10.0.0.1'), true, '10段应保留');
    assert.strictEqual(isReservedAddress('192.168.1.1'), true, '192.168段应保留');
    assert.strictEqual(isReservedAddress('172.16.0.1'), true, '172.16段应保留');
    assert.strictEqual(isReservedAddress('169.254.1.1'), true, '链路本地应保留');
    assert.strictEqual(isReservedAddress('8.8.8.8'), false, '公网IP不应保留');
    assert.strictEqual(isReservedAddress('93.184.216.34'), false, 'example.com IP不应保留');
});

test('security: isReservedAddress 正确识别IPv6保留地址（含展开形式）', () => {
    const { isReservedAddress } = require('../src/security');
    
    assert.strictEqual(isReservedAddress('::1'), true, '压缩形式回环应保留');
    assert.strictEqual(isReservedAddress('0:0:0:0:0:0:0:1'), true, '展开形式回环应保留');
    assert.strictEqual(isReservedAddress('fe80::1'), true, '链路本地应保留');
    assert.strictEqual(isReservedAddress('fc00::1'), true, '唯一本地应保留');
    assert.strictEqual(isReservedAddress('fd00::1'), true, '唯一本地应保留');
    assert.strictEqual(isReservedAddress('ff00::1'), true, '组播应保留');
    assert.strictEqual(isReservedAddress('::'), true, '未指定应保留');
});

test('security: getClientAddress 正确提取客户端地址', () => {
    const { getClientAddress } = require('../src/security');
    
    // 模拟req对象
    const req1 = {
        headers: { 'x-forwarded-for': '1.2.3.4' },
        socket: { remoteAddress: '5.6.7.8' }
    };
    assert.strictEqual(getClientAddress(req1), '1.2.3.4', '应使用XFF');
    
    const req2 = {
        headers: {},
        socket: { remoteAddress: '5.6.7.8' }
    };
    assert.strictEqual(getClientAddress(req2), '5.6.7.8', '无XFF时使用socket地址');
});

// 测试3: frame-header.js - parseBatchHeader
test('frame-header: parseBatchHeader 正确解析标准VLESS帧', () => {
    const { parseBatchHeader } = require('../src/core/frame-header');
    
    // 构造标准VLESS帧：[版本][UUID(16)][附加长度=0][协议=1][端口=80][地址类型=2(域名)][地址长度][地址][载荷]
    const uuid = '820a85fa-419f-401a-94a8-508391354638';
    const uuidBuf = Buffer.from(uuid.replace(/-/g, ''), 'hex');
    const portBuf = Buffer.alloc(2);
    portBuf.writeUInt16BE(80, 0);
    const hostBuf = Buffer.from('example.com', 'utf8');
    const frame = Buffer.concat([
        Buffer.from([0]),           // 版本
        uuidBuf,                     // UUID
        Buffer.from([0]),            // 附加长度
        Buffer.from([1]),            // 协议(TCP)
        portBuf,                     // 端口
        Buffer.from([2]),            // 地址类型(域名)
        Buffer.from([hostBuf.length]), // 地址长度
        hostBuf,                     // 地址
        Buffer.from('test payload')  // 载荷
    ]);
    
    const result = parseBatchHeader(frame);
    assert.ok(result, '应成功解析');
    assert.strictEqual(result.targetPort, 80, '端口应为80');
    assert.strictEqual(result.addrFormat, 3, '地址格式应为3(域名)');
});

test('frame-header: parseBatchHeader 拒绝无效端口', () => {
    const { parseBatchHeader } = require('../src/core/frame-header');
    
    const uuid = '820a85fa-419f-401a-94a8-508391354638';
    const uuidBuf = Buffer.from(uuid.replace(/-/g, ''), 'hex');
    // 端口0（无效）
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

// 测试4: 配置加载
test('config: 配置正确加载且包含必要字段', () => {
    const { CONFIG } = require('../src/config');
    
    assert.ok(CONFIG, 'CONFIG应存在');
    assert.ok(CONFIG.PORT, '应包含PORT');
    assert.ok(CONFIG.MAX_CONNECTIONS, '应包含MAX_CONNECTIONS');
    assert.ok(CONFIG.ENDPOINT_FILTER !== undefined, '应包含ENDPOINT_FILTER');
});

console.log('\n=== 最小测试集加载完成 ===');
console.log('运行: npm test');




// ====================================================================
// 安全回归负例测试（第三轮报告 §7.2）
// 锁定本轮两处安全回归：SSRF IPv4映射失效 + XFF校验失效
// ====================================================================

test('security-regression: isReservedAddress 拦截 IPv4映射十六进制形式', () => {
    const { isReservedAddress } = require('../src/security');

    // 回环映射（十六进制）—— 本轮回归点
    assert.strictEqual(isReservedAddress('::ffff:7f00:1'), true, '::ffff:7f00.1 应拦截（回环）');
    // 线协议产物（展开形式）
    assert.strictEqual(isReservedAddress('0:0:0:0:0:ffff:7f00:1'), true, '展开形式映射应拦截');
    // 点分形式
    assert.strictEqual(isReservedAddress('::ffff:127.0.0.1'), true, '点分形式映射应拦截');

    // 私网映射
    assert.strictEqual(isReservedAddress('::ffff:a00:1'), true, '::ffff:10.0.0.1 应拦截');
    assert.strictEqual(isReservedAddress('::ffff:ac10:1'), true, '::ffff:172.16.0.1 应拦截');
    assert.strictEqual(isReservedAddress('::ffff:c0a8:101'), true, '::ffff:192.168.1.1 应拦截');
    assert.strictEqual(isReservedAddress('::ffff:a9fe:101'), true, '::ffff:169.254.1.1 应拦截');
});

test('security-regression: isReservedAddress 拦截 fe80::/10 全段', () => {
    const { isReservedAddress } = require('../src/security');

    assert.strictEqual(isReservedAddress('fe80::1'), true, 'fe80::1 应拦截');
    assert.strictEqual(isReservedAddress('febf::1'), true, 'febf::1 应拦截（fe80::/10上界）');
    assert.strictEqual(isReservedAddress('fe80:ffff::1'), true, 'fe80:ffff::1 应拦截');
});

test('security-regression: isReservedAddress 放行公网地址（防过度拦截）', () => {
    const { isReservedAddress } = require('../src/security');

    assert.strictEqual(isReservedAddress('2001:db8::1'), false, '文档地址不应拦截');
    assert.strictEqual(isReservedAddress('::ffff:8.8.8.8'), false, '::ffff:8.8.8.8 不应拦截');
    assert.strictEqual(isReservedAddress('::ffff:1.1.1.1'), false, '::ffff:1.1.1.1 不应拦截');
    assert.strictEqual(isReservedAddress('2606:4700:4700::1111'), false, 'Cloudflare DNS不应拦截');
});

test('security-regression: getClientAddress 拒绝非法XFF并回退socket地址', () => {
    const { getClientAddress } = require('../src/security');

    const socketAddr = '198.51.100.7';

    // 纯十六进制字符串（本轮回归点）
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

test('security-regression: getClientAddress 采信合法XFF', () => {
    const { getClientAddress } = require('../src/security');

    // 合法IPv4
    assert.strictEqual(
        getClientAddress({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '5.6.7.8' } }),
        '1.2.3.4', '合法IPv4应采信'
    );
    // 合法IPv6
    assert.strictEqual(
        getClientAddress({ headers: { 'x-forwarded-for': '2001:db8::1' }, socket: { remoteAddress: '5.6.7.8' } }),
        '2001:db8::1', '合法IPv6应采信'
    );
    // 多段XFF取首个
    assert.strictEqual(
        getClientAddress({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, socket: { remoteAddress: '9.9.9.9' } }),
        '1.2.3.4', '多段XFF应取首个'
    );
});


// ====================================================================
// 第三轮报告新增测试
// ====================================================================

// addrFormat 白名单测试
test('frame-header: addrFormat 无效值被拒绝', () => {
    const { parseBatchHeader } = require('../src/core/frame-header');
    const uuid = '820a85fa-419f-401a-94a8-508391354638';
    const uuidBuf = Buffer.from(uuid.replace(/-/g, ''), 'hex');

    function makeFrame(addrFormat) {
        // [版本(1)][UUID(16)][附加长度(1)=0][syncMode(1)=1][端口(2)][addrFormat(1)][地址...]
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

    // 有效值应通过（addrFormat=2 域名模式）
    const valid = parseBatchHeader(makeFrame(2));
    assert.ok(valid !== null, 'addrFormat=2(域名)应通过');

    // 无效值应被拒绝
    assert.strictEqual(parseBatchHeader(makeFrame(0)), null, 'addrFormat=0应拒绝');
    assert.strictEqual(parseBatchHeader(makeFrame(4)), null, 'addrFormat=4应拒绝');
    assert.strictEqual(parseBatchHeader(makeFrame(255)), null, 'addrFormat=255应拒绝');
});

// Order ID 前缀测试
test('models: Order ID 根据 type 生成正确前缀', () => {
    const { Order } = require('../src/business/models');

    const salesOrder = new Order({ type: 'sales' });
    assert.ok(salesOrder.id.startsWith('ORD-'), `销售订单应以ORD-开头，实际: ${salesOrder.id}`);

    const purchaseOrder = new Order({ type: 'purchase' });
    assert.ok(purchaseOrder.id.startsWith('PO-'), `采购订单应以PO-开头，实际: ${purchaseOrder.id}`);
});

// 内置件 sha256 一致性测试
test('vendored: 内置件 sha256 与 VENDORED.json 一致', () => {
    const fs = require('fs');
    const crypto = require('crypto');
    const path = require('path');

    const vendoredPath = path.join(__dirname, '..', 'src', 'vendor', 'VENDORED.json');
    const vendored = JSON.parse(fs.readFileSync(vendoredPath, 'utf8'));

    for (const item of vendored.files) {
        const filePath = path.join(__dirname, '..', 'src', 'vendor', item.path);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath);
        const actualSha = crypto.createHash('sha256').update(content).digest('hex');
        const actualBytes = content.length;

        assert.strictEqual(actualSha, item.sha256, `${item.path} sha256 不匹配（文件可能被修改但未更新VENDORED.json）`);
        assert.strictEqual(actualBytes, item.bytes, `${item.path} bytes 不匹配`);
    }
});
