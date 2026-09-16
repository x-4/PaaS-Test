FROM node:20-alpine

WORKDIR /app

# 安装生产依赖（先复制 package.json 利用 Docker 缓存层）
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# 复制源码
COPY src/ ./src/

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

CMD ["node", "src/index.js"]
