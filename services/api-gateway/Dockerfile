# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
RUN mkdir -p /data && mkdir -p /app/data
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["sh", "-c", "npm run migration:run:prod && exec node dist/src/main.js"]
