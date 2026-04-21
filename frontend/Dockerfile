# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG API_GATEWAY_URL=http://api-gateway:4000
ENV API_GATEWAY_URL=$API_GATEWAY_URL
ARG NEXT_PUBLIC_PROJECT_FIRST_UX=false
ENV NEXT_PUBLIC_PROJECT_FIRST_UX=$NEXT_PUBLIC_PROJECT_FIRST_UX
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN npm install --omit=dev
CMD ["npm", "run", "start"]
