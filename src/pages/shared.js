// ====================================================================
// 页面共享模块
// 产品信息、共享布局、导航组件
// 品牌：SyncFlow - 企业级库存同步平台
// ====================================================================

const PRODUCT_NAME = 'SyncFlow';
const PRODUCT_VERSION = '1.0.0';
const PRODUCT_TAGLINE = 'Enterprise Inventory Synchronization Platform';

// 内联 CSS 样式表（无外部依赖，国内可正常访问）
const INLINE_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; background: #f8fafc; }
a { color: inherit; text-decoration: none; }
button { font: inherit; cursor: pointer; border: none; background: none; }
input, select, textarea { font: inherit; padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; background: #fff; color: #1e293b; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
table { border-collapse: collapse; width: 100%; }
svg { display: block; }
.flex { display: flex; } .inline-flex { display: inline-flex; } .flex-col { flex-direction: column; } .flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; } .items-start { align-items: flex-start; } .justify-center { justify-content: center; } .justify-between { justify-content: space-between; } .justify-end { justify-content: flex-end; }
.flex-1 { flex: 1 1 0%; } .flex-shrink-0 { flex-shrink: 0; }
.grid { display: grid; } .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); } .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.fixed { position: fixed; } .sticky { position: sticky; } .relative { position: relative; } .absolute { position: absolute; }
.inset-y-0 { top: 0; bottom: 0; } .left-0 { left: 0; } .top-0 { top: 0; } .right-0 { right: 0; }
.z-10 { z-index: 10; } .z-20 { z-index: 20; } .z-30 { z-index: 30; } .z-40 { z-index: 40; } .z-50 { z-index: 50; }
.overflow-hidden { overflow: hidden; } .overflow-y-auto { overflow-y: auto; } .overflow-x-auto { overflow-x: auto; }
.min-w-0 { min-width: 0; } .min-h-screen { min-height: 100vh; }
.w-full { width: 100%; } .w-16 { width: 4rem; } .w-12 { width: 3rem; } .w-10 { width: 2.5rem; } .w-9 { width: 2.25rem; } .w-8 { width: 2rem; } .w-6 { width: 1.5rem; } .w-5 { width: 1.25rem; } .w-4 { width: 1rem; } .w-3 { width: 0.75rem; } .w-2 { width: 0.5rem; } .w-1 { width: 0.25rem; }
.h-16 { height: 4rem; } .h-12 { height: 3rem; } .h-10 { height: 2.5rem; } .h-9 { height: 2.25rem; } .h-8 { height: 2rem; } .h-6 { height: 1.5rem; } .h-5 { height: 1.25rem; } .h-4 { height: 1rem; } .h-3 { height: 0.75rem; } .h-2 { height: 0.5rem; } .h-1 { height: 0.25rem; } .h-1\\.5 { height: 0.375rem; }
.max-w-3xl { max-width: 48rem; } .max-w-4xl { max-width: 56rem; } .max-w-7xl { max-width: 80rem; } .max-w-md { max-width: 28rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.sidebar { width: 240px; } .main-content { margin-left: 240px; }
@media (max-width: 768px) { .sidebar { display: none; } .main-content { margin-left: 0; } .md\\:grid-cols-2,.md\\:grid-cols-3 { grid-template-columns: repeat(1, minmax(0, 1fr)); } .md\\:grid-cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 768px) { .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } .md\\:flex { display: flex; } .md\\:hidden { display: none; } .md\\:block { display: block; } }
.p-8 { padding: 2rem; } .p-6 { padding: 1.5rem; } .p-5 { padding: 1.25rem; } .p-4 { padding: 1rem; } .p-3 { padding: 0.75rem; } .p-2 { padding: 0.5rem; } .p-1 { padding: 0.25rem; }
.px-8 { padding-left: 2rem; padding-right: 2rem; } .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; } .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; } .px-4 { padding-left: 1rem; padding-right: 1rem; } .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; } .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; } .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
.py-5 { padding-top: 1.25rem; padding-bottom: 1.25rem; } .py-4 { padding-top: 1rem; padding-bottom: 1rem; } .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; } .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; } .py-2\\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; } .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; } .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
.pt-6 { padding-top: 1.5rem; } .pt-4 { padding-top: 1rem; } .pt-2 { padding-top: 0.5rem; } .pb-6 { padding-bottom: 1.5rem; } .pb-4 { padding-bottom: 1rem; } .pb-3 { padding-bottom: 0.75rem; } .pb-2 { padding-bottom: 0.5rem; } .pl-4 { padding-left: 1rem; } .pl-3 { padding-left: 0.75rem; } .pr-4 { padding-right: 1rem; }
.mt-1 { margin-top: 0.25rem; } .mt-2 { margin-top: 0.5rem; } .mt-3 { margin-top: 0.75rem; } .mt-4 { margin-top: 1rem; } .mt-5 { margin-top: 1.25rem; } .mt-6 { margin-top: 1.5rem; } .mt-8 { margin-top: 2rem; } .mt-10 { margin-top: 2.5rem; }
.mb-1 { margin-bottom: 0.25rem; } .mb-2 { margin-bottom: 0.5rem; } .mb-3 { margin-bottom: 0.75rem; } .mb-4 { margin-bottom: 1rem; } .mb-5 { margin-bottom: 1.25rem; } .mb-6 { margin-bottom: 1.5rem; } .mb-8 { margin-bottom: 2rem; } .mb-10 { margin-bottom: 2.5rem; }
.ml-2 { margin-left: 0.5rem; } .ml-3 { margin-left: 0.75rem; } .mr-2 { margin-right: 0.5rem; } .mr-3 { margin-right: 0.75rem; }
.gap-1 { gap: 0.25rem; } .gap-2 { gap: 0.5rem; } .gap-3 { gap: 0.75rem; } .gap-4 { gap: 1rem; } .gap-5 { gap: 1.25rem; } .gap-6 { gap: 1.5rem; } .gap-8 { gap: 2rem; }
.space-y-1 > * + * { margin-top: 0.25rem; } .space-y-2 > * + * { margin-top: 0.5rem; } .space-y-3 > * + * { margin-top: 0.75rem; } .space-y-4 > * + * { margin-top: 1rem; } .space-x-2 > * + * { margin-left: 0.5rem; } .space-x-3 > * + * { margin-left: 0.75rem; }
.text-xs { font-size: 0.75rem; line-height: 1rem; } .text-sm { font-size: 0.875rem; line-height: 1.25rem; } .text-base { font-size: 1rem; line-height: 1.5rem; } .text-lg { font-size: 1.125rem; line-height: 1.75rem; } .text-xl { font-size: 1.25rem; line-height: 1.75rem; } .text-2xl { font-size: 1.5rem; line-height: 2rem; } .text-3xl { font-size: 1.875rem; line-height: 2.25rem; } .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
.font-thin { font-weight: 100; } .font-light { font-weight: 300; } .font-normal { font-weight: 400; } .font-medium { font-weight: 500; } .font-semibold { font-weight: 600; } .font-bold { font-weight: 700; } .font-extrabold { font-weight: 800; } .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.leading-relaxed { line-height: 1.625; } .leading-tight { line-height: 1.25; }
.text-center { text-align: center; } .text-right { text-align: right; } .text-left { text-align: left; }
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .uppercase { text-transform: uppercase; } .tracking-wide { letter-spacing: 0.025em; } .tracking-wider { letter-spacing: 0.05em; }
.text-slate-900 { color: #0f172a; } .text-slate-800 { color: #1e293b; } .text-slate-700 { color: #334155; } .text-slate-600 { color: #475569; } .text-slate-500 { color: #64748b; } .text-slate-400 { color: #94a3b8; } .text-slate-300 { color: #cbd5e1; } .text-slate-200 { color: #e2e8f0; } .text-slate-100 { color: #f1f5f9; } .text-slate-50 { color: #f8fafc; }
.text-white { color: #fff; } .text-black { color: #000; }
.bg-slate-900 { background: #0f172a; } .bg-slate-800 { background: #1e293b; } .bg-slate-700 { background: #334155; } .bg-slate-600 { background: #475569; } .bg-slate-500 { background: #64748b; } .bg-slate-400 { background: #94a3b8; } .bg-slate-300 { background: #cbd5e1; } .bg-slate-200 { background: #e2e8f0; } .bg-slate-100 { background: #f1f5f9; } .bg-slate-50 { background: #f8fafc; }
.bg-white { background: #fff; } .bg-black { background: #000; }
.border-slate-200 { border-color: #e2e8f0; } .border-slate-100 { border-color: #f1f5f9; } .border-slate-300 { border-color: #cbd5e1; } .border-slate-400 { border-color: #94a3b8; }
.text-blue-900 { color: #1e3a8a; } .text-blue-800 { color: #1e40af; } .text-blue-700 { color: #1d4ed8; } .text-blue-600 { color: #2563eb; } .text-blue-500 { color: #3b82f6; } .text-blue-400 { color: #60a5fa; } .text-blue-300 { color: #93c5fd; } .text-blue-200 { color: #bfdbfe; } .text-blue-100 { color: #dbeafe; } .text-blue-50 { color: #eff6ff; }
.bg-blue-900 { background: #1e3a8a; } .bg-blue-800 { background: #1e40af; } .bg-blue-700 { background: #1d4ed8; } .bg-blue-600 { background: #2563eb; } .bg-blue-500 { background: #3b82f6; } .bg-blue-400 { background: #60a5fa; } .bg-blue-300 { background: #93c5fd; } .bg-blue-200 { background: #bfdbfe; } .bg-blue-100 { background: #dbeafe; } .bg-blue-50 { background: #eff6ff; }
.border-blue-200 { border-color: #bfdbfe; } .border-blue-300 { border-color: #93c5fd; } .border-blue-500 { border-color: #3b82f6; }
.bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--g-from), var(--g-to)); }
.from-blue-500 { --g-from: #3b82f6; } .to-blue-700 { --g-to: #1d4ed8; } .from-blue-600 { --g-from: #2563eb; } .to-indigo-700 { --g-to: #4338ca; }
.text-green-900 { color: #14532d; } .text-green-800 { color: #166534; } .text-green-700 { color: #15803d; } .text-green-600 { color: #16a34a; } .text-green-500 { color: #22c55e; } .text-green-400 { color: #4ade80; } .text-green-300 { color: #86efac; } .text-green-200 { color: #bbf7d0; } .text-green-100 { color: #dcfce7; } .text-green-50 { color: #f0fdf4; }
.bg-green-900 { background: #14532d; } .bg-green-800 { background: #166534; } .bg-green-700 { background: #15803d; } .bg-green-600 { background: #16a34a; } .bg-green-500 { background: #22c55e; } .bg-green-400 { background: #4ade80; } .bg-green-300 { background: #86efac; } .bg-green-200 { background: #bbf7d0; } .bg-green-100 { background: #dcfce7; } .bg-green-50 { background: #f0fdf4; }
.border-green-200 { border-color: #bbf7d0; } .border-green-300 { border-color: #86efac; } .border-green-500 { border-color: #22c55e; }
.text-red-900 { color: #7f1d1d; } .text-red-800 { color: #991b1b; } .text-red-700 { color: #b91c1c; } .text-red-600 { color: #dc2626; } .text-red-500 { color: #ef4444; } .text-red-400 { color: #f87171; } .text-red-300 { color: #fca5a5; } .text-red-200 { color: #fecaca; } .text-red-100 { color: #fee2e2; } .text-red-50 { color: #fef2f2; }
.bg-red-900 { background: #7f1d1d; } .bg-red-800 { background: #991b1b; } .bg-red-700 { background: #b91c1c; } .bg-red-600 { background: #dc2626; } .bg-red-500 { background: #ef4444; } .bg-red-400 { background: #f87171; } .bg-red-300 { background: #fca5a5; } .bg-red-200 { background: #fecaca; } .bg-red-100 { background: #fee2e2; } .bg-red-50 { background: #fef2f2; }
.border-red-200 { border-color: #fecaca; } .border-red-300 { border-color: #fca5a5; } .border-red-500 { border-color: #ef4444; }
.text-amber-900 { color: #78350f; } .text-amber-800 { color: #92400e; } .text-amber-700 { color: #b45309; } .text-amber-600 { color: #d97706; } .text-amber-500 { color: #f59e0b; } .text-amber-400 { color: #fbbf24; } .text-amber-300 { color: #fcd34d; } .text-amber-200 { color: #fde68a; } .text-amber-100 { color: #fef3c7; } .text-amber-50 { color: #fffbeb; }
.bg-amber-900 { background: #78350f; } .bg-amber-800 { background: #92400e; } .bg-amber-700 { background: #b45309; } .bg-amber-600 { background: #d97706; } .bg-amber-500 { background: #f59e0b; } .bg-amber-400 { background: #fbbf24; } .bg-amber-300 { background: #fcd34d; } .bg-amber-200 { background: #fde68a; } .bg-amber-100 { background: #fef3c7; } .bg-amber-50 { background: #fffbeb; }
.border-amber-200 { border-color: #fde68a; } .border-amber-300 { border-color: #fcd34d; } .border-amber-500 { border-color: #f59e0b; }
.text-yellow-500 { color: #eab308; } .text-yellow-600 { color: #ca8a04; } .bg-yellow-100 { background: #fef9c3; } .bg-yellow-50 { background: #fefce8; }
.text-purple-600 { color: #9333ea; } .text-purple-700 { color: #7e22ce; } .bg-purple-100 { background: #f3e8ff; } .bg-purple-50 { background: #faf5ff; }
.text-indigo-600 { color: #4f46e5; } .text-indigo-700 { color: #4338ca; } .bg-indigo-100 { background: #e0e7ff; } .bg-indigo-50 { background: #eef2ff; }
.text-teal-600 { color: #0d9488; } .text-teal-700 { color: #0f766e; } .bg-teal-100 { background: #ccfbf1; } .bg-teal-50 { background: #f0fdfa; }
.text-cyan-600 { color: #0891b2; } .bg-cyan-100 { background: #cffafe; }
.text-orange-500 { color: #f97316; } .text-orange-600 { color: #ea580c; } .bg-orange-100 { background: #ffedd5; } .bg-orange-50 { background: #fff7ed; }
.border { border-width: 1px; border-style: solid; } .border-0 { border-width: 0; } .border-2 { border-width: 2px; }
.border-t { border-top-width: 1px; border-top-style: solid; } .border-b { border-bottom-width: 1px; border-bottom-style: solid; } .border-l { border-left-width: 1px; border-left-style: solid; } .border-r { border-right-width: 1px; border-right-style: solid; }
.rounded-none { border-radius: 0; } .rounded-sm { border-radius: 0.125rem; } .rounded { border-radius: 0.25rem; } .rounded-md { border-radius: 0.375rem; } .rounded-lg { border-radius: 0.5rem; } .rounded-xl { border-radius: 0.75rem; } .rounded-2xl { border-radius: 1rem; } .rounded-3xl { border-radius: 1.5rem; } .rounded-full { border-radius: 9999px; }
.rounded-t-lg { border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; } .rounded-b-lg { border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem; }
.shadow-none { box-shadow: none; } .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); } .shadow { box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1); } .shadow-md { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); } .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); } .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); } .shadow-inner { box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.05); }
.transition { transition: color,background-color,border-color,opacity,box-shadow,transform .15s cubic-bezier(0.4,0,0.2,1); } .transition-colors { transition: color,background-color,border-color .15s; } .transition-all { transition: all .15s; } .transition-transform { transition: transform .15s; }
.duration-150 { transition-duration: 150ms; } .duration-200 { transition-duration: 200ms; } .duration-300 { transition-duration: 300ms; }
.fade-in { animation: fadeIn .3s ease-in; } @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.pulse-dot { animation: pulse 2s infinite; } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.hover\\:bg-slate-50:hover { background: #f8fafc; } .hover\\:bg-slate-100:hover { background: #f1f5f9; } .hover\\:bg-slate-200:hover { background: #e2e8f0; }
.hover\\:bg-blue-50:hover { background: #eff6ff; } .hover\\:bg-blue-600:hover { background: #2563eb; } .hover\\:bg-blue-700:hover { background: #1d4ed8; }
.hover\\:bg-green-600:hover { background: #16a34a; } .hover\\:bg-red-600:hover { background: #dc2626; }
.hover\\:text-slate-900:hover { color: #0f172a; } .hover\\:text-slate-700:hover { color: #334155; } .hover\\:text-blue-700:hover { color: #1d4ed8; } .hover\\:text-blue-600:hover { color: #2563eb; } .hover\\:text-white:hover { color: #fff; }
.hover\\:shadow-md:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); } .hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); }
.hover\\:scale-105:hover { transform: scale(1.05); } .hover\\:underline:hover { text-decoration: underline; }
.focus\\:outline-none:focus { outline: none; } .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59,130,246,0.5); } .focus\\:border-blue-500:focus { border-color: #3b82f6; }
.opacity-0 { opacity: 0; } .opacity-50 { opacity: 0.5; } .opacity-60 { opacity: 0.6; } .opacity-70 { opacity: 0.7; } .opacity-75 { opacity: 0.75; } .opacity-80 { opacity: 0.8; } .opacity-90 { opacity: 0.9; } .opacity-100 { opacity: 1; }
.cursor-pointer { cursor: pointer; } .cursor-not-allowed { cursor: not-allowed; } .cursor-default { cursor: default; }
.pointer-events-none { pointer-events: none; }
.hidden { display: none; } .block { display: block; } .inline-block { display: inline-block; }
.list-none { list-style: none; } .list-disc { list-style-type: disc; }
::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-track { background: #f1f5f9; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
@media print { .sidebar { display: none; } .main-content { margin-left: 0; } }
`;

// ---- 共享布局 ----
function layout(title, content, activeNav) {
    const navItems = [
        { path: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { path: '/inventory', label: 'Inventory', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
        { path: '/warehouses', label: 'Warehouses', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { path: '/sync', label: 'Sync Jobs', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
        { path: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
        { path: '/docs', label: 'API Docs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        { path: '/about', label: 'About', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
    ];

    const navHtml = navItems.map(item => `
        <a href="${item.path}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeNav === item.label ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"/></svg>
            ${item.label}
        </a>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} | ${PRODUCT_NAME}</title>
    <meta name="description" content="${PRODUCT_TAGLINE}">
    <style>${INLINE_CSS}/*
        /* === SyncFlow Enterprise UI - Inline CSS (no external dependencies) === */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-text-size-adjust: 100%; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1e293b; background: #f8fafc; }
        a { color: inherit; text-decoration: none; }
        button { font: inherit; cursor: pointer; border: none; background: none; }
        input, select, textarea { font: inherit; }
        table { border-collapse: collapse; width: 100%; }
        svg { display: block; }

        /* Layout */
        .flex { display: flex; }
        .inline-flex { display: inline-flex; }
        .flex-col { flex-direction: column; }
        .flex-wrap { flex-wrap: wrap; }
        .items-center { align-items: center; }
        .items-start { align-items: flex-start; }
        .items-end { align-items: flex-end; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .justify-end { justify-content: flex-end; }
        .flex-1 { flex: 1 1 0%; }
        .flex-shrink-0 { flex-shrink: 0; }
        .grid { display: grid; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .fixed { position: fixed; }
        .sticky { position: sticky; }
        .relative { position: relative; }
        .absolute { position: absolute; }
        .inset-y-0 { top: 0; bottom: 0; }
        .left-0 { left: 0; }
        .top-0 { top: 0; }
        .right-0 { right: 0; }
        .z-10 { z-index: 10; }
        .z-20 { z-index: 20; }
        .z-30 { z-index: 30; }
        .z-40 { z-index: 40; }
        .z-50 { z-index: 50; }
        .overflow-hidden { overflow: hidden; }
        .overflow-y-auto { overflow-y: auto; }
        .overflow-x-auto { overflow-x: auto; }
        .min-w-0 { min-width: 0; }
        .min-h-screen { min-height: 100vh; }
        .w-full { width: 100%; }
        .w-16 { width: 4rem; }
        .w-12 { width: 3rem; }
        .w-10 { width: 2.5rem; }
        .w-9 { width: 2.25rem; }
        .w-8 { width: 2rem; }
        .w-6 { width: 1.5rem; }
        .w-5 { width: 1.25rem; }
        .w-4 { width: 1rem; }
        .w-3 { width: 0.75rem; }
        .w-2 { width: 0.5rem; }
        .w-1 { width: 0.25rem; }
        .h-16 { height: 4rem; }
        .h-12 { height: 3rem; }
        .h-10 { height: 2.5rem; }
        .h-9 { height: 2.25rem; }
        .h-8 { height: 2rem; }
        .h-6 { height: 1.5rem; }
        .h-5 { height: 1.25rem; }
        .h-4 { height: 1rem; }
        .h-3 { height: 0.75rem; }
        .h-2 { height: 0.5rem; }
        .h-1 { height: 0.25rem; }
        .h-1\.5 { height: 0.375rem; }
        .max-w-3xl { max-width: 48rem; }
        .max-w-4xl { max-width: 56rem; }
        .max-w-7xl { max-width: 80rem; }
        .mx-auto { margin-left: auto; margin-right: auto; }

        /* Sidebar layout */
        .sidebar { width: 240px; }
        .main-content { margin-left: 240px; }
        @media (max-width: 768px) {
            .sidebar { display: none; }
            .main-content { margin-left: 0; }
            .md\\:grid-cols-2 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
            .md\\:grid-cols-3 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
            .md\\:grid-cols-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .md\\:flex { display: flex; }
            .md\\:hidden { display: none; }
        }
        @media (min-width: 768px) {
            .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            .md\\:flex { display: flex; }
            .md\\:hidden { display: none; }
            .md\\:block { display: block; }
        }

        /* Spacing */
        .p-8 { padding: 2rem; }
        .p-6 { padding: 1.5rem; }
        .p-5 { padding: 1.25rem; }
        .p-4 { padding: 1rem; }
        .p-3 { padding: 0.75rem; }
        .p-2 { padding: 0.5rem; }
        .p-1 { padding: 0.25rem; }
        .px-8 { padding-left: 2rem; padding-right: 2rem; }
        .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
        .px-5 { padding-left: 1.25rem; padding-right: 1.25rem; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
        .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
        .px-1 { padding-left: 0.25rem; padding-right: 0.25rem; }
        .py-5 { padding-top: 1.25rem; padding-bottom: 1.25rem; }
        .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
        .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .py-2\.5 { padding-top: 0.625rem; padding-bottom: 0.625rem; }
        .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
        .py-0\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
        .pt-6 { padding-top: 1.5rem; }
        .pt-4 { padding-top: 1rem; }
        .pt-2 { padding-top: 0.5rem; }
        .pb-6 { padding-bottom: 1.5rem; }
        .pb-4 { padding-bottom: 1rem; }
        .pb-3 { padding-bottom: 0.75rem; }
        .pb-2 { padding-bottom: 0.5rem; }
        .pl-4 { padding-left: 1rem; }
        .pl-3 { padding-left: 0.75rem; }
        .pr-4 { padding-right: 1rem; }
        .m-0 { margin: 0; }
        .mt-1 { margin-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-3 { margin-top: 0.75rem; }
        .mt-4 { margin-top: 1rem; }
        .mt-5 { margin-top: 1.25rem; }
        .mt-6 { margin-top: 1.5rem; }
        .mt-8 { margin-top: 2rem; }
        .mt-10 { margin-top: 2.5rem; }
        .mb-1 { margin-bottom: 0.25rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .mb-3 { margin-bottom: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-5 { margin-bottom: 1.25rem; }
        .mb-6 { margin-bottom: 1.5rem; }
        .mb-8 { margin-bottom: 2rem; }
        .mb-10 { margin-bottom: 2.5rem; }
        .ml-2 { margin-left: 0.5rem; }
        .ml-3 { margin-left: 0.75rem; }
        .mr-2 { margin-right: 0.5rem; }
        .mr-3 { margin-right: 0.75rem; }
        .gap-1 { gap: 0.25rem; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .gap-4 { gap: 1rem; }
        .gap-5 { gap: 1.25rem; }
        .gap-6 { gap: 1.5rem; }
        .gap-8 { gap: 2rem; }
        .space-y-1 > * + * { margin-top: 0.25rem; }
        .space-y-2 > * + * { margin-top: 0.5rem; }
        .space-y-3 > * + * { margin-top: 0.75rem; }
        .space-y-4 > * + * { margin-top: 1rem; }
        .space-x-2 > * + * { margin-left: 0.5rem; }
        .space-x-3 > * + * { margin-left: 0.75rem; }

        /* Typography */
        .text-xs { font-size: 0.75rem; line-height: 1rem; }
        .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
        .text-base { font-size: 1rem; line-height: 1.5rem; }
        .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
        .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
        .text-2xl { font-size: 1.5rem; line-height: 2rem; }
        .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
        .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
        .font-thin { font-weight: 100; }
        .font-light { font-weight: 300; }
        .font-normal { font-weight: 400; }
        .font-medium { font-weight: 500; }
        .font-semibold { font-weight: 600; }
        .font-bold { font-weight: 700; }
        .font-extrabold { font-weight: 800; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .leading-relaxed { line-height: 1.625; }
        .leading-tight { line-height: 1.25; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .uppercase { text-transform: uppercase; }
        .lowercase { text-transform: lowercase; }
        .tracking-wide { letter-spacing: 0.025em; }
        .tracking-wider { letter-spacing: 0.05em; }

        /* Colors - Slate */
        .text-slate-900 { color: #0f172a; }
        .text-slate-800 { color: #1e293b; }
        .text-slate-700 { color: #334155; }
        .text-slate-600 { color: #475569; }
        .text-slate-500 { color: #64748b; }
        .text-slate-400 { color: #94a3b8; }
        .text-slate-300 { color: #cbd5e1; }
        .text-slate-200 { color: #e2e8f0; }
        .text-slate-100 { color: #f1f5f9; }
        .text-slate-50 { color: #f8fafc; }
        .text-white { color: #ffffff; }
        .text-black { color: #000000; }
        .bg-slate-900 { background-color: #0f172a; }
        .bg-slate-800 { background-color: #1e293b; }
        .bg-slate-700 { background-color: #334155; }
        .bg-slate-600 { background-color: #475569; }
        .bg-slate-500 { background-color: #64748b; }
        .bg-slate-400 { background-color: #94a3b8; }
        .bg-slate-300 { background-color: #cbd5e1; }
        .bg-slate-200 { background-color: #e2e8f0; }
        .bg-slate-100 { background-color: #f1f5f9; }
        .bg-slate-50 { background-color: #f8fafc; }
        .bg-white { background-color: #ffffff; }
        .bg-black { background-color: #000000; }
        .border-slate-900 { border-color: #0f172a; }
        .border-slate-800 { border-color: #1e293b; }
        .border-slate-700 { border-color: #334155; }
        .border-slate-600 { border-color: #475569; }
        .border-slate-500 { border-color: #64748b; }
        .border-slate-400 { border-color: #94a3b8; }
        .border-slate-300 { border-color: #cbd5e1; }
        .border-slate-200 { border-color: #e2e8f0; }
        .border-slate-100 { border-color: #f1f5f9; }
        .border-slate-50 { border-color: #f8fafc; }

        /* Colors - Blue */
        .text-blue-900 { color: #1e3a8a; }
        .text-blue-800 { color: #1e40af; }
        .text-blue-700 { color: #1d4ed8; }
        .text-blue-600 { color: #2563eb; }
        .text-blue-500 { color: #3b82f6; }
        .text-blue-400 { color: #60a5fa; }
        .text-blue-300 { color: #93c5fd; }
        .text-blue-200 { color: #bfdbfe; }
        .text-blue-100 { color: #dbeafe; }
        .text-blue-50 { color: #eff6ff; }
        .bg-blue-900 { background-color: #1e3a8a; }
        .bg-blue-800 { background-color: #1e40af; }
        .bg-blue-700 { background-color: #1d4ed8; }
        .bg-blue-600 { background-color: #2563eb; }
        .bg-blue-500 { background-color: #3b82f6; }
        .bg-blue-400 { background-color: #60a5fa; }
        .bg-blue-300 { background-color: #93c5fd; }
        .bg-blue-200 { background-color: #bfdbfe; }
        .bg-blue-100 { background-color: #dbeafe; }
        .bg-blue-50 { background-color: #eff6ff; }
        .border-blue-200 { border-color: #bfdbfe; }
        .border-blue-300 { border-color: #93c5fd; }
        .border-blue-500 { border-color: #3b82f6; }
        .bg-gradient-to-br { background-image: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
        .from-blue-500 { --tw-gradient-from: #3b82f6; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, rgba(59,130,246,0)); }
        .to-blue-700 { --tw-gradient-to: #1d4ed8; }
        .from-blue-600 { --tw-gradient-from: #2563eb; }
        .to-indigo-700 { --tw-gradient-to: #4338ca; }

        /* Colors - Green */
        .text-green-900 { color: #14532d; }
        .text-green-800 { color: #166534; }
        .text-green-700 { color: #15803d; }
        .text-green-600 { color: #16a34a; }
        .text-green-500 { color: #22c55e; }
        .text-green-400 { color: #4ade80; }
        .text-green-300 { color: #86efac; }
        .text-green-200 { color: #bbf7d0; }
        .text-green-100 { color: #dcfce7; }
        .text-green-50 { color: #f0fdf4; }
        .bg-green-900 { background-color: #14532d; }
        .bg-green-800 { background-color: #166534; }
        .bg-green-700 { background-color: #15803d; }
        .bg-green-600 { background-color: #16a34a; }
        .bg-green-500 { background-color: #22c55e; }
        .bg-green-400 { background-color: #4ade80; }
        .bg-green-300 { background-color: #86efac; }
        .bg-green-200 { background-color: #bbf7d0; }
        .bg-green-100 { background-color: #dcfce7; }
        .bg-green-50 { background-color: #f0fdf4; }
        .border-green-200 { border-color: #bbf7d0; }
        .border-green-300 { border-color: #86efac; }
        .border-green-500 { border-color: #22c55e; }

        /* Colors - Red */
        .text-red-900 { color: #7f1d1d; }
        .text-red-800 { color: #991b1b; }
        .text-red-700 { color: #b91c1c; }
        .text-red-600 { color: #dc2626; }
        .text-red-500 { color: #ef4444; }
        .text-red-400 { color: #f87171; }
        .text-red-300 { color: #fca5a5; }
        .text-red-200 { color: #fecaca; }
        .text-red-100 { color: #fee2e2; }
        .text-red-50 { color: #fef2f2; }
        .bg-red-900 { background-color: #7f1d1d; }
        .bg-red-800 { background-color: #991b1b; }
        .bg-red-700 { background-color: #b91c1c; }
        .bg-red-600 { background-color: #dc2626; }
        .bg-red-500 { background-color: #ef4444; }
        .bg-red-400 { background-color: #f87171; }
        .bg-red-300 { background-color: #fca5a5; }
        .bg-red-200 { background-color: #fecaca; }
        .bg-red-100 { background-color: #fee2e2; }
        .bg-red-50 { background-color: #fef2f2; }
        .border-red-200 { border-color: #fecaca; }
        .border-red-300 { border-color: #fca5a5; }
        .border-red-500 { border-color: #ef4444; }

        /* Colors - Amber/Yellow */
        .text-amber-900 { color: #78350f; }
        .text-amber-800 { color: #92400e; }
        .text-amber-700 { color: #b45309; }
        .text-amber-600 { color: #d97706; }
        .text-amber-500 { color: #f59e0b; }
        .text-amber-400 { color: #fbbf24; }
        .text-amber-300 { color: #fcd34d; }
        .text-amber-200 { color: #fde68a; }
        .text-amber-100 { color: #fef3c7; }
        .text-amber-50 { color: #fffbeb; }
        .bg-amber-900 { background-color: #78350f; }
        .bg-amber-800 { background-color: #92400e; }
        .bg-amber-700 { background-color: #b45309; }
        .bg-amber-600 { background-color: #d97706; }
        .bg-amber-500 { background-color: #f59e0b; }
        .bg-amber-400 { background-color: #fbbf24; }
        .bg-amber-300 { background-color: #fcd34d; }
        .bg-amber-200 { background-color: #fde68a; }
        .bg-amber-100 { background-color: #fef3c7; }
        .bg-amber-50 { background-color: #fffbeb; }
        .border-amber-200 { border-color: #fde68a; }
        .border-amber-300 { border-color: #fcd34d; }
        .border-amber-500 { border-color: #f59e0b; }
        .text-yellow-500 { color: #eab308; }
        .text-yellow-600 { color: #ca8a04; }
        .bg-yellow-100 { background-color: #fef9c3; }
        .bg-yellow-50 { background-color: #fefce8; }

        /* Colors - Purple/Indigo */
        .text-purple-600 { color: #9333ea; }
        .text-purple-700 { color: #7e22ce; }
        .bg-purple-100 { background-color: #f3e8ff; }
        .bg-purple-50 { background-color: #faf5ff; }
        .text-indigo-600 { color: #4f46e5; }
        .text-indigo-700 { color: #4338ca; }
        .bg-indigo-100 { background-color: #e0e7ff; }
        .bg-indigo-50 { background-color: #eef2ff; }

        /* Colors - Teal/Cyan */
        .text-teal-600 { color: #0d9488; }
        .text-teal-700 { color: #0f766e; }
        .bg-teal-100 { background-color: #ccfbf1; }
        .bg-teal-50 { background-color: #f0fdfa; }
        .text-cyan-600 { color: #0891b2; }
        .bg-cyan-100 { background-color: #cffafe; }

        /* Colors - Orange */
        .text-orange-500 { color: #f97316; }
        .text-orange-600 { color: #ea580c; }
        .bg-orange-100 { background-color: #ffedd5; }
        .bg-orange-50 { background-color: #fff7ed; }

        /* Borders */
        .border { border-width: 1px; border-style: solid; }
        .border-0 { border-width: 0; }
        .border-2 { border-width: 2px; }
        .border-t { border-top-width: 1px; border-top-style: solid; }
        .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
        .border-l { border-left-width: 1px; border-left-style: solid; }
        .border-r { border-right-width: 1px; border-right-style: solid; }
        .rounded-none { border-radius: 0; }
        .rounded-sm { border-radius: 0.125rem; }
        .rounded { border-radius: 0.25rem; }
        .rounded-md { border-radius: 0.375rem; }
        .rounded-lg { border-radius: 0.5rem; }
        .rounded-xl { border-radius: 0.75rem; }
        .rounded-2xl { border-radius: 1rem; }
        .rounded-3xl { border-radius: 1.5rem; }
        .rounded-full { border-radius: 9999px; }
        .rounded-t-lg { border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; }
        .rounded-b-lg { border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem; }

        /* Shadows */
        .shadow-none { box-shadow: none; }
        .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
        .shadow { box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1); }
        .shadow-md { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); }
        .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); }
        .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); }
        .shadow-inner { box-shadow: inset 0 2px 4px 0 rgba(0,0,0,0.05); }

        /* Transitions & Animations */
        .transition { transition-property: color, background-color, border-color, fill, stroke, opacity, box-shadow, transform; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
        .transition-colors { transition-property: color, background-color, border-color; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
        .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
        .transition-transform { transition-property: transform; transition-timing-function: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms; }
        .duration-150 { transition-duration: 150ms; }
        .duration-200 { transition-duration: 200ms; }
        .duration-300 { transition-duration: 300ms; }
        .ease-in { transition-timing-function: cubic-bezier(0.4,0,1,1); }
        .ease-out { transition-timing-function: cubic-bezier(0,0,0.2,1); }
        .ease-in-out { transition-timing-function: cubic-bezier(0.4,0,0.2,1); }
        .fade-in { animation: fadeIn 0.3s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .pulse-dot { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Hover states */
        .hover\\:bg-slate-50:hover { background-color: #f8fafc; }
        .hover\\:bg-slate-100:hover { background-color: #f1f5f9; }
        .hover\\:bg-slate-200:hover { background-color: #e2e8f0; }
        .hover\\:bg-blue-50:hover { background-color: #eff6ff; }
        .hover\\:bg-blue-600:hover { background-color: #2563eb; }
        .hover\\:bg-blue-700:hover { background-color: #1d4ed8; }
        .hover\\:bg-green-600:hover { background-color: #16a34a; }
        .hover\\:bg-red-600:hover { background-color: #dc2626; }
        .hover\\:text-slate-900:hover { color: #0f172a; }
        .hover\\:text-slate-700:hover { color: #334155; }
        .hover\\:text-blue-700:hover { color: #1d4ed8; }
        .hover\\:text-blue-600:hover { color: #2563eb; }
        .hover\\:text-white:hover { color: #ffffff; }
        .hover\\:shadow-md:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); }
        .hover\\:shadow-lg:hover { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); }
        .hover\\:scale-105:hover { transform: scale(1.05); }
        .hover\\:underline:hover { text-decoration: underline; }

        /* Focus states */
        .focus\\:outline-none:focus { outline: none; }
        .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59,130,246,0.5); }
        .focus\\:ring-blue-500:focus { --tw-ring-color: #3b82f6; }
        .focus\\:border-blue-500:focus { border-color: #3b82f6; }

        /* Opacity */
        .opacity-0 { opacity: 0; }
        .opacity-50 { opacity: 0.5; }
        .opacity-60 { opacity: 0.6; }
        .opacity-70 { opacity: 0.7; }
        .opacity-75 { opacity: 0.75; }
        .opacity-80 { opacity: 0.8; }
        .opacity-90 { opacity: 0.9; }
        .opacity-100 { opacity: 1; }

        /* Cursor */
        .cursor-pointer { cursor: pointer; }
        .cursor-not-allowed { cursor: not-allowed; }
        .cursor-default { cursor: default; }
        .cursor-move { cursor: move; }

        /* Pointer events */
        .pointer-events-none { pointer-events: none; }

        /* Display */
        .hidden { display: none; }
        .block { display: block; }
        .inline-block { display: inline-block; }
        .table { display: table; }
        .table-row { display: table-row; }
        .table-cell { display: table-cell; }

        /* List */
        .list-none { list-style: none; }
        .list-disc { list-style-type: disc; }

        /* Form elements */
        input, select, textarea {
            padding: 0.5rem 0.75rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.375rem;
            background: #ffffff;
            color: #1e293b;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        input::placeholder, textarea::placeholder { color: #94a3b8; }

        /* Buttons */
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.375rem; font-weight: 500; font-size: 0.875rem; transition: all 0.15s; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
        .btn-secondary:hover { background: #e2e8f0; }
        .btn-danger { background: #dc2626; color: white; }
        .btn-danger:hover { background: #b91c1c; }
        .btn-success { background: #16a34a; color: white; }
        .btn-success:hover { background: #15803d; }

        /* Badges */
        .badge { display: inline-flex; align-items: center; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }

        /* Cards */
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }

        /* Progress bar */
        .progress-bar { height: 0.375rem; background: #e2e8f0; border-radius: 9999px; overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 9999px; transition: width 0.3s ease; }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* Print */
        @media print {
            .sidebar { display: none; }
            .main-content { margin-left: 0; }
        }
*/</style>
</head>
<body class="bg-slate-50 min-h-screen">
    <!-- Sidebar -->
    <aside class="sidebar fixed inset-y-0 left-0 bg-white border-r border-slate-200 flex flex-col z-30">
        <div class="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
            <div class="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-sm">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </div>
            <div>
                <div class="font-bold text-slate-800 text-base">${PRODUCT_NAME}</div>
                <div class="text-xs text-slate-400">v${PRODUCT_VERSION}</div>
            </div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            ${navHtml}
        </nav>
        <div class="px-3 py-4 border-t border-slate-100">
            <div class="flex items-center gap-3 px-3 py-2">
                <div class="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600">A</div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-slate-700 truncate">Admin</div>
                    <div class="text-xs text-slate-400 truncate">Enterprise Plan</div>
                </div>
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </div>
        </div>
    </aside>

    <!-- Main Content -->
    <div class="main-content">
        <!-- Top Bar -->
        <header class="bg-white border-b border-slate-200 sticky top-0 z-20">
            <div class="flex items-center justify-between px-8 py-3.5">
                <div class="flex items-center gap-4 flex-1 max-w-xl">
                    <div class="relative flex-1">
                        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input type="text" placeholder="Search inventory, warehouses, jobs..." class="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <button class="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                        <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full pulse-dot"></span>
                    </button>
                    <div class="h-6 w-px bg-slate-200"></div>
                    <div class="flex items-center gap-2">
                        <span class="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 rounded-full text-xs font-semibold text-green-700">
                            <span class="w-1.5 h-1.5 bg-green-500 rounded-full pulse-dot"></span>
                            All Systems Operational
                        </span>
                    </div>
                </div>
            </div>
        </header>

        <!-- Page Content -->
        <main class="p-8 fade-in">
            ${content}
        </main>

        <!-- Footer -->
        <footer class="px-8 py-4 border-t border-slate-200 bg-white">
            <div class="flex items-center justify-between text-xs text-slate-400">
                <div>&copy; 2026 ${PRODUCT_NAME} Inc. All rights reserved.</div>
                <div class="flex items-center gap-4">
                    <a href="/docs" class="hover:text-slate-600 transition-colors">Documentation</a>
                    <a href="/about" class="hover:text-slate-600 transition-colors">About</a>
                    <span>v${PRODUCT_VERSION}</span>
                </div>
            </div>
        </footer>
    </div>

    <!-- 实时数据刷新（模拟企业级监控仪表盘） -->
    <script>
    (function() {
        // 仅在仪表盘页面启用实时刷新
        const isDashboard = document.querySelector('.stat-card') || document.querySelector('[data-metric]');
        if (!isDashboard) return;

        function formatNumber(n) {
            if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
            return n.toString();
        }

        function updateMetrics() {
            fetch('/api/v1/metrics')
                .then(r => r.json())
                .then(data => {
                    const m = data.metrics || {};
                    document.querySelectorAll('[data-metric]').forEach(el => {
                        const key = el.getAttribute('data-metric');
                        if (m[key] !== undefined) {
                            let value = m[key];
                            const decimals = el.getAttribute('data-decimals');
                            const suffix = el.getAttribute('data-suffix') || '';
                            if (decimals) {
                                value = parseFloat(value).toFixed(parseInt(decimals));
                            }
                            el.textContent = value + suffix;
                            el.style.transition = 'color 0.3s';
                            el.style.color = '#2563eb';
                            setTimeout(() => { el.style.color = ''; }, 300);
                        }
                    });
                })
                .catch(() => {});
        }

        // 每 5 秒刷新一次
        setInterval(updateMetrics, 5000);
        // 页面加载后立即刷新一次
        setTimeout(updateMetrics, 1000);
    })();
    </script>
</body>
</html>`;
}

module.exports = {
    PRODUCT_NAME,
    PRODUCT_VERSION,
    PRODUCT_TAGLINE,
    INLINE_CSS,
    layout
};
