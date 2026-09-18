// ====================================================================
// 租户身份认证模块
// ====================================================================

const { CONFIG } = require('./config');

// 租户令牌字节派生
function deriveTenantKey() {
    const b = new Uint8Array(16);
    const parseHex = c => (c > 64 ? c + 9 : c) & 0xF;
    for (let i = 0, p = 0; i < 16; i++) {
        let c = CONFIG.ENTERPRISE_TOKEN.charCodeAt(p++);
        if (c === 45) c = CONFIG.ENTERPRISE_TOKEN.charCodeAt(p++);
        const hi = parseHex(c);
        c = CONFIG.ENTERPRISE_TOKEN.charCodeAt(p++);
        if (c === 45) c = CONFIG.ENTERPRISE_TOKEN.charCodeAt(p++);
        b[i] = (hi << 4) | parseHex(c);
    }
    return b;
}

const TENANT_KEY = deriveTenantKey();

// 校验数据帧中的租户签名
// 企业同步协议：第0字节是协议版本号，租户ID从第1字节开始（共16字节）
function verifyTenantSignature(buffer) {
    if (!buffer || buffer.length < 17) return false;
    for (let i = 0; i < 16; i++) {
        if (buffer[i + 1] !== TENANT_KEY[i]) return false;
    }
    return true;
}

// 安全销毁租户密钥（进程退出时调用，用 0 覆盖内存）
function destroyTenantKey() {
    if (TENANT_KEY) {
        for (let i = 0; i < TENANT_KEY.length; i++) {
            TENANT_KEY[i] = 0;
        }
    }
}

// 安全清零缓冲区中的敏感数据（认证完成后调用）
// 用 0 覆盖 UUID 区域，防止内存dump泄露
function zeroizeSensitiveBuffer(buffer, offset = 1, length = 16) {
    if (!buffer || buffer.length < offset + length) return;
    for (let i = 0; i < length; i++) {
        buffer[offset + i] = 0;
    }
}

module.exports = { verifyTenantSignature, TENANT_KEY, destroyTenantKey, zeroizeSensitiveBuffer };
