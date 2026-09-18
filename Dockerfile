# Stage 1: Build Frontend and Server Bundle
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for Docker caching
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Run production build (Vite client build -> dist/ + esbuild server.ts -> dist/server.cjs)
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install python3 and production dependencies
RUN apk add --no-cache python3
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Create mount points and standard directories for user files / data
RUN mkdir -p /data/workflows /data/cron-logs /data/plugins /workspace

# Expose container port (mapped by 1Panel / reverse proxy)
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# Start bundled CommonJS server
CMD ["node", "dist/server.cjs"]
