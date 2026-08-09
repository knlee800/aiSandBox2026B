# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root manifests (provides the lockfile for deterministic npm ci)
COPY package.json package-lock.json ./

# Copy each workspace package.json so npm workspace resolution succeeds
COPY frontend/package.json ./frontend/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/ai-service/package.json ./services/ai-service/
COPY services/container-manager/package.json ./services/container-manager/

# Install from lockfile — no registry fetch, skip native-module compilation scripts
RUN npm ci --ignore-scripts

# Copy frontend source
COPY frontend/ ./frontend/

ARG API_GATEWAY_URL=http://api-gateway:4000
ENV API_GATEWAY_URL=$API_GATEWAY_URL

WORKDIR /app/frontend
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Copy manifests for production install
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/frontend/package.json ./frontend/
COPY --from=builder /app/services/api-gateway/package.json ./services/api-gateway/
COPY --from=builder /app/services/ai-service/package.json ./services/ai-service/
COPY --from=builder /app/services/container-manager/package.json ./services/container-manager/

# Production-only install from lockfile — no registry fetch, skip native-module compilation
RUN npm ci --omit=dev --ignore-scripts

# Copy built artifacts and i18n messages needed at runtime
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/messages ./frontend/messages

WORKDIR /app/frontend
CMD ["npm", "run", "start"]
