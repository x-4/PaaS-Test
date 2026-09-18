// ====================================================================
// 运行平台检测模块
// 自动识别部署平台并提供自适应配置建议
// ====================================================================

// 平台标识检测（通过各平台注入的特征环境变量）
const PLATFORM_SIGNATURES = [
    { name: 'fly.io',        env: 'FLY_APP_NAME' },
    { name: 'fly.io',        env: 'FLY_REGION' },
    { name: 'Railway',       env: 'RAILWAY_ENVIRONMENT' },
    { name: 'Railway',       env: 'RAILWAY_SERVICE_NAME' },
    { name: 'Render',        env: 'RENDER_SERVICE_ID' },
    { name: 'Render',        env: 'RENDER' },
    { name: 'Heroku',        env: 'HEROKU_APP_NAME' },
    { name: 'Heroku',        env: 'DYNO' },
    { name: 'Koyeb',         env: 'KOYEB_APP_NAME' },
    { name: 'Koyeb',         env: 'KOYEB' },
    { name: 'Zeabur',        env: 'ZEABUR' },
    { name: 'Zeabur',        env: 'ZEABUR_SERVICE_ID' },
    { name: 'Northflank',    env: 'NORTHFLANK' },
    { name: 'Northflank',    env: 'NORTHFLANK_PROJECT_ID' },
    { name: 'Vercel',        env: 'VERCEL' },
    { name: 'Vercel',        env: 'VERCEL_ENV' },
    { name: 'Cloudflare',    env: 'CF_PAGES' },
    { name: 'Cloudflare',    env: 'CLOUDFLARE_WORKERS' },
    { name: 'SnapDeploy',    env: 'SNAPDEPLOY' },
    { name: 'Docker',        env: 'DOCKER_CONTAINER' },
    { name: 'Kubernetes',    env: 'KUBERNETES_SERVICE_HOST' }
];

function detectPlatform() {
    for (const sig of PLATFORM_SIGNATURES) {
        if (process.env[sig.env]) {
            return sig.name;
        }
    }
    return 'unknown';
}

// 各平台的自适应配置建议
const PLATFORM_DEFAULTS = {
    'Heroku': {
        pingInterval: 20000,      // Heroku 30s 空闲断开，心跳需更频繁
        idleTimeout: 120000,
        maxConnections: 200,
        note: 'Heroku dynos have 30s idle timeout; keep heartbeat under 25s'
    },
    'Render': {
        pingInterval: 60000,       // Render 免费版 15min 空闲
        idleTimeout: 300000,
        maxConnections: 500,
        note: 'Free tier spins down after 15min inactivity'
    },
    'fly.io': {
        pingInterval: 30000,
        idleTimeout: 300000,
        maxConnections: 1000,
        note: 'Anycast network; supports long-lived connections'
    },
    'Railway': {
        pingInterval: 30000,
        idleTimeout: 300000,
        maxConnections: 500,
        note: 'Supports Docker deployments with persistent connections'
    },
    'Koyeb': {
        pingInterval: 30000,
        idleTimeout: 300000,
        maxConnections: 500,
        note: 'Global edge deployment; supports WebSocket'
    },
    'Zeabur': {
        pingInterval: 30000,
        idleTimeout: 300000,
        maxConnections: 500,
        note: 'Supports Docker and long-running services'
    },
    'Northflank': {
        pingInterval: 30000,
        idleTimeout: 300000,
        maxConnections: 500,
        note: 'Enterprise-grade container platform'
    },
    'Vercel': {
        pingInterval: 30000,
        idleTimeout: 60000,
        maxConnections: 100,
        note: 'Serverless functions have execution time limits; TCP outbound may be restricted'
    },
    'unknown': {
        pingInterval: 30000,
        idleTimeout: 300000,
        maxConnections: 500,
        note: 'Using default configuration'
    }
};

function getPlatformConfig() {
    const platform = detectPlatform();
    const defaults = PLATFORM_DEFAULTS[platform] || PLATFORM_DEFAULTS['unknown'];

    // 环境变量优先，平台默认值兜底
    // 优先级：环境变量 > 平台默认值（不使用 CONFIG 全局值，避免覆盖平台自适应）
    return {
        platform,
        pingInterval: parseInt(process.env.PING_INTERVAL, 10) || defaults.pingInterval,
        idleTimeout: parseInt(process.env.IDLE_TIMEOUT_MS || process.env.IDLE_TIMEOUT, 10) || defaults.idleTimeout,
        maxConnections: parseInt(process.env.MAX_CONNECTIONS, 10) || defaults.maxConnections,
        note: defaults.note
    };
}

module.exports = { detectPlatform, getPlatformConfig };
