// ====================================================================
// 页面共享模块
// 产品信息、共享布局、导航组件
// 品牌：SyncFlow - 企业级库存同步平台
// ====================================================================

const PRODUCT_NAME = 'SyncFlow';
const PRODUCT_VERSION = '1.0.0';
const PRODUCT_TAGLINE = 'Enterprise Inventory Synchronization Platform';

// HTML 转义函数（防止XSS）
const ESCAPE_HTML_JS = `
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
`;

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
/* 高级组件样式 */
.card { background: #fff; border-radius: 0.75rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
.card-hover { transition: box-shadow 0.2s, transform 0.2s; }
.card-hover:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; transition: all 0.15s; cursor: pointer; border: 1px solid transparent; }
.btn-primary { background: #2563eb; color: #fff; }
.btn-primary:hover { background: #1d4ed8; }
.btn-secondary { background: #fff; color: #334155; border-color: #e2e8f0; }
.btn-secondary:hover { background: #f8fafc; }
.btn-success { background: #16a34a; color: #fff; }
.btn-success:hover { background: #15803d; }
.btn-danger { background: #dc2626; color: #fff; }
.btn-danger:hover { background: #b91c1c; }
.badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.badge-success { background: #dcfce7; color: #166534; }
.badge-warning { background: #fef3c7; color: #92400e; }
.badge-danger { background: #fee2e2; color: #991b1b; }
.badge-info { background: #dbeafe; color: #1e40af; }
.badge-neutral { background: #f1f5f9; color: #475569; }
.progress { width: 100%; height: 0.5rem; background: #e2e8f0; border-radius: 9999px; overflow: hidden; }
.progress-bar { height: 100%; border-radius: 9999px; transition: width 0.3s; }
.table-hover tbody tr { transition: background 0.15s; }
.table-hover tbody tr:hover { background: #f8fafc; }
.input-group { display: flex; flex-direction: column; gap: 0.375rem; }
.input-label { font-size: 0.875rem; font-weight: 500; color: #334155; }
.input-field { padding: 0.625rem 0.875rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; background: #f8fafc; transition: all 0.15s; }
.input-field:focus { outline: none; border-color: #3b82f6; background: #fff; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.stat-card { background: #fff; border-radius: 0.75rem; border: 1px solid #e2e8f0; padding: 1.25rem; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); transition: box-shadow 0.2s; }
.stat-card:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
.stat-icon { width: 2.5rem; height: 2.5rem; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; }
.stat-value { font-size: 1.875rem; font-weight: 700; color: #0f172a; line-height: 1; }
.stat-label { font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-trend { display: inline-flex; align-items: center; gap: 0.125rem; font-size: 0.75rem; font-weight: 600; }
.trend-up { color: #16a34a; }
.trend-down { color: #dc2626; }
.divider { display: flex; align-items: center; gap: 1rem; }
.divider-line { flex: 1; height: 1px; background: #e2e8f0; }
.divider-text { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
.tooltip { position: relative; }
.tooltip::after { content: attr(data-tip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); padding: 0.25rem 0.5rem; background: #1e293b; color: #fff; font-size: 0.75rem; border-radius: 0.25rem; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.15s; }
.tooltip:hover::after { opacity: 1; }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
@keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.animate-slide-in { animation: slideIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.animate-fade-in { animation: fadeIn 0.3s ease-out; }
.text-gradient { background: linear-gradient(135deg, #2563eb, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.bg-grid { background-image: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px); background-size: 20px 20px; }
/* 毛玻璃效果 */
.backdrop-blur-md { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.backdrop-blur-sm { backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
/* 精致阴影 */
.shadow-blue { box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15); }
.shadow-blue-lg { box-shadow: 0 8px 24px rgba(37, 99, 235, 0.2); }
.shadow-soft { box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06); }
.shadow-soft-lg { box-shadow: 0 4px 16px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04); }
/* 渐变文字和背景 */
.bg-gradient-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%); }
.bg-gradient-indigo { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #4338ca 100%); }
/* 边框透明度 */
.border-slate-200\/80 { border-color: rgba(226, 232, 240, 0.8); }
.border-green-200\/60 { border-color: rgba(187, 247, 208, 0.6); }
.bg-white\/80 { background: rgba(255, 255, 255, 0.8); }
/* 环形效果 */
.ring-2 { box-shadow: 0 0 0 2px currentColor; }
.ring-white { --tw-ring-color: #fff; }
/* 跟踪间距 */
.tracking-tight { letter-spacing: -0.025em; }
/* 导航项过渡 */
.nav-item { position: relative; overflow: hidden; }
.nav-item::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: linear-gradient(180deg, #3b82f6, #2563eb); border-radius: 0 3px 3px 0; opacity: 0; transition: opacity 0.2s; }
.nav-item:hover::before { opacity: 0.5; }
/* 滚动条美化 */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
/* 选中文字颜色 */
::selection { background: rgba(59, 130, 246, 0.2); color: #1e40af; }
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
        <a href="${item.path}" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${activeNav === item.label ? 'bg-gradient-to-r from-blue-50 to-blue-50/50 text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}">
            ${activeNav === item.label ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-r-full"></span>' : ''}
            <svg class="w-5 h-5 flex-shrink-0 ${activeNav === item.label ? 'text-blue-600' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"/></svg>
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
    <style>${INLINE_CSS}</style>
</head>
<body class="bg-slate-50 min-h-screen">
    <!-- Sidebar -->
    <aside class="sidebar fixed inset-y-0 left-0 bg-white border-r border-slate-200/80 flex flex-col z-30 shadow-sm">
        <div class="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </div>
            <div>
                <div class="font-bold text-slate-800 text-base tracking-tight">${PRODUCT_NAME}</div>
                <div class="text-xs text-slate-400">v${PRODUCT_VERSION}</div>
            </div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <div class="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Main Menu</div>
            ${navHtml}
        </nav>
        <div class="px-3 py-4 border-t border-slate-100">
            <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                <div class="w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-800 rounded-full flex items-center justify-center text-sm font-semibold text-white shadow-sm">A</div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-slate-700 truncate">Admin</div>
                    <div class="text-xs text-slate-400 truncate">Enterprise Plan</div>
                </div>
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg>
            </div>
        </div>
    </aside>

    <!-- Main Content -->
    <div class="main-content">
        <!-- Top Bar -->
        <header class="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20">
            <div class="flex items-center justify-between px-8 py-3">
                <div class="flex items-center gap-4 flex-1 max-w-2xl">
                    <div class="relative flex-1 group">
                        <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input type="text" placeholder="Search inventory, warehouses, jobs..." class="w-full pl-10 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all">
                        <kbd class="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-400 shadow-sm">⌘K</kbd>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button class="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                        <span class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full pulse-dot ring-2 ring-white"></span>
                    </button>
                    <div class="h-6 w-px bg-slate-200"></div>
                    <div class="flex items-center gap-2">
                        <span class="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200/60 rounded-full text-xs font-semibold text-green-700">
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
