// ====================================================================
// TLS 参数配置模块
// 出站 HTTPS 连接使用标准化的 TLS 参数，确保与主流客户端行为一致
// ====================================================================

// ---- Chrome 风格密码套件顺序（TLS 1.3 优先，兼容 1.2） ----
const BROWSER_CIPHERS = [
    // TLS 1.3
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    // TLS 1.2 ECDHE
    'ECDHE-ECDSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-ECDSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-ECDSA-CHACHA20-POLY1305',
    'ECDHE-RSA-CHACHA20-POLY1305',
    // TLS 1.2 降级（浏览器保留项）
    'ECDHE-RSA-AES128-SHA',
    'ECDHE-RSA-AES256-SHA',
    'AES128-GCM-SHA256',
    'AES256-GCM-SHA384',
    'AES128-SHA',
    'AES256-SHA'
].join(':');

// ---- 浏览器风格签名算法优先级 ----
const BROWSER_SIGALGS = [
    'ecdsa_secp256r1_sha256',
    'rsa_pss_rsae_sha256',
    'rsa_pkcs1_sha256',
    'ecdsa_secp384r1_sha384',
    'rsa_pss_rsae_sha384',
    'rsa_pkcs1_sha384',
    'rsa_pss_rsae_sha512',
    'rsa_pkcs1_sha512'
].join(':');

// ---- 浏览器风格支持的椭圆曲线组（X25519 优先） ----
const BROWSER_ECDH_CURVE = 'X25519:prime256v1:secp384r1';

// ---- 通用浏览器化 TLS 选项 ----
const BROWSER_TLS_OPTIONS = {
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
    ciphers: BROWSER_CIPHERS,
    sigalgs: BROWSER_SIGALGS,
    ecdhCurve: BROWSER_ECDH_CURVE,
    // ALPN 协议：Chrome 优先 HTTP/2，兼容 HTTP/1.1
    ALPNProtocols: ['h2', 'http/1.1'],
    // 客户端按自身顺序提出套件，服务端选择（浏览器行为，而非服务端优先）
    honorCipherOrder: false,
    // 启用会话恢复（浏览器行为，减少握手往返）
    sessionIdContext: 'syncflow-tls-v1'
};

module.exports = {
    BROWSER_CIPHERS,
    BROWSER_SIGALGS,
    BROWSER_ECDH_CURVE,
    BROWSER_TLS_OPTIONS
};
