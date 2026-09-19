# ---- 运行阶段：零依赖，直接运行源码 ----
FROM node:20-alpine

WORKDIR /app

# 零依赖项目，无需 npm install
COPY package.json ./

# 直接复制源码
COPY src/ ./src/
COPY config/ ./config/

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info

# 暴露默认端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# 非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["node", "src/index.js"]
