# ---- 构建阶段：安装依赖 + terser 压缩混淆 ----
FROM node:20-alpine AS builder

WORKDIR /app

# 安装所有依赖（包括 devDependencies 中的 terser）
COPY package.json package-lock.json* ./
RUN npm install

# 复制源码和构建脚本
COPY src/ ./src/
COPY build.js ./

# 运行构建：terser 压缩混淆到 dist/
RUN npm run build

# ---- 运行阶段：仅生产依赖 + 压缩后代码 ----
FROM node:20-alpine

WORKDIR /app

# 仅安装生产依赖
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# 从构建阶段复制压缩后的代码
COPY --from=builder /app/dist ./dist/

# SnapDeploy 会自动注入 PORT 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info

EXPOSE ${PORT}

# 健康检查（用 node 自身发起请求，不依赖额外工具）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# 非 root 用户运行（安全加固）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "dist/index.js"]
