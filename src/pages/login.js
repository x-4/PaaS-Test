// ====================================================================
// login 页面模块
// SyncFlow - 企业级库存同步平台
// 美化版：分屏布局，企业级设计，零外部依赖
// ====================================================================

const { PRODUCT_NAME, INLINE_CSS } = require('./shared');

function renderLogin(res) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign In | ${PRODUCT_NAME}</title>
    <meta name="description" content="SyncFlow - Enterprise Inventory Synchronization Platform">
    <style>${INLINE_CSS}
        /* 登录页专属样式 */
        .login-wrapper { display: flex; min-height: 100vh; }
        .login-brand { 
            flex: 1; 
            background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3b82f6 100%);
            color: white;
            padding: 48px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
        }
        .login-brand::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -30%;
            width: 80%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            pointer-events: none;
        }
        .login-brand::after {
            content: '';
            position: absolute;
            bottom: -20%;
            left: -10%;
            width: 50%;
            height: 60%;
            background: radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%);
            pointer-events: none;
        }
        .login-form-side {
            width: 480px;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 48px;
        }
        .brand-logo {
            display: flex;
            align-items: center;
            gap: 12px;
            position: relative;
            z-index: 1;
        }
        .brand-logo-icon {
            width: 44px;
            height: 44px;
            background: rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .brand-features {
            position: relative;
            z-index: 1;
        }
        .brand-features h2 {
            font-size: 2rem;
            font-weight: 700;
            line-height: 1.2;
            margin-bottom: 16px;
        }
        .brand-features p {
            font-size: 1rem;
            opacity: 0.85;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        .feature-list {
            list-style: none;
            padding: 0;
        }
        .feature-list li {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            font-size: 0.9rem;
            opacity: 0.9;
        }
        .feature-check {
            width: 24px;
            height: 24px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        .brand-footer {
            position: relative;
            z-index: 1;
            font-size: 0.8rem;
            opacity: 0.7;
        }
        .form-header { margin-bottom: 32px; }
        .form-header h1 {
            font-size: 1.75rem;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 8px;
        }
        .form-header p {
            color: #64748b;
            font-size: 0.9rem;
        }
        .form-group { margin-bottom: 20px; }
        .form-label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: #334155;
            margin-bottom: 6px;
        }
        .form-input {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            font-size: 0.9rem;
            transition: all 0.15s;
            background: #f8fafc;
        }
        .form-input:focus {
            outline: none;
            border-color: #3b82f6;
            background: white;
            box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        .form-options {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
        }
        .checkbox-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.85rem;
            color: #64748b;
        }
        .btn-primary {
            width: 100%;
            padding: 12px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.15s;
        }
        .btn-primary:hover { background: #1d4ed8; }
        .divider {
            display: flex;
            align-items: center;
            margin: 24px 0;
        }
        .divider-line { flex: 1; height: 1px; background: #e2e8f0; }
        .divider-text {
            padding: 0 16px;
            font-size: 0.75rem;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .social-buttons {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }
        .social-btn {
            padding: 10px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.15s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .social-btn:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
        }
        .form-footer {
            margin-top: 32px;
            text-align: center;
            font-size: 0.85rem;
            color: #64748b;
        }
        .form-footer a {
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;
        }
        .form-footer a:hover { text-decoration: underline; }
        .security-note {
            margin-top: 24px;
            padding: 12px 16px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }
        .security-note p {
            font-size: 0.75rem;
            color: #166534;
            line-height: 1.5;
        }
        @media (max-width: 900px) {
            .login-brand { display: none; }
            .login-form-side { width: 100%; }
        }
    </style>
</head>
<body>
    <div class="login-wrapper">
        <!-- 左侧品牌展示 -->
        <div class="login-brand">
            <div class="brand-logo">
                <div class="brand-logo-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                </div>
                <span style="font-size: 1.25rem; font-weight: 700;">${PRODUCT_NAME}</span>
            </div>

            <div class="brand-features">
                <h2>Real-time inventory<br>synchronization at scale</h2>
                <p>Keep your warehouse data perfectly in sync across all locations with enterprise-grade reliability and sub-second latency.</p>
                <ul class="feature-list">
                    <li>
                        <div class="feature-check">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </div>
                        Multi-region warehouse synchronization
                    </li>
                    <li>
                        <div class="feature-check">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </div>
                        99.99% uptime SLA guarantee
                    </li>
                    <li>
                        <div class="feature-check">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </div>
                        End-to-end encryption & compliance
                    </li>
                    <li>
                        <div class="feature-check">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </div>
                        Real-time analytics & reporting
                    </li>
                </ul>
            </div>

            <div class="brand-footer">
                <p>&copy; 2026 SyncFlow Inc. All rights reserved.</p>
                <p style="margin-top: 4px;">SOC 2 Type II &middot; GDPR &middot; ISO 27001</p>
            </div>
        </div>

        <!-- 右侧登录表单 -->
        <div class="login-form-side">
            <div class="form-header">
                <h1>Welcome back</h1>
                <p>Sign in to your ${PRODUCT_NAME} account to continue</p>
            </div>

            <form action="/login" method="POST">
                <div class="form-group">
                    <label class="form-label" for="email">Work email</label>
                    <input type="email" id="email" name="email" required placeholder="you@company.com" class="form-input" autocomplete="email">
                </div>

                <div class="form-group">
                    <label class="form-label" for="password">Password</label>
                    <input type="password" id="password" name="password" required placeholder="Enter your password" class="form-input" autocomplete="current-password">
                </div>

                <div class="form-options">
                    <label class="checkbox-wrapper">
                        <input type="checkbox" id="remember" name="remember" style="width: 16px; height: 16px;">
                        Remember me for 30 days
                    </label>
                    <a href="#" style="font-size: 0.85rem; color: #2563eb; text-decoration: none;">Forgot password?</a>
                </div>

                <button type="submit" class="btn-primary">Sign in</button>
            </form>

            <div class="divider">
                <div class="divider-line"></div>
                <span class="divider-text">Or continue with</span>
                <div class="divider-line"></div>
            </div>

            <div class="social-buttons">
                <button class="social-btn" title="Sign in with Google">
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                </button>
                <button class="social-btn" title="Sign in with Microsoft">
                    <svg width="20" height="20" viewBox="0 0 23 23"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
                </button>
                <button class="social-btn" title="Sign in with GitHub">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#0f172a"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                </button>
            </div>

            <div class="security-note">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" style="flex-shrink: 0; margin-top: 1px;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                <p>Your data is protected with 256-bit TLS encryption. We never store your password in plain text.</p>
            </div>

            <div class="form-footer">
                <p>Don't have an account? <a href="#">Contact sales</a></p>
                <p style="margin-top: 12px; font-size: 0.75rem; color: #94a3b8;">
                    By signing in, you agree to our <a href="#" style="color: #64748b;">Terms</a> and <a href="#" style="color: #64748b;">Privacy Policy</a>
                </p>
            </div>
        </div>
    </div>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
}

module.exports = { renderLogin };
