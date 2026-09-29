# ==========================================
# Root Dockerfile para NestJS Backend en Render
# ==========================================

# 1. Dependencias y Compilación
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar OpenSSL para compilación de Prisma en Alpine
RUN apk add --no-cache openssl

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY backend/ .
RUN npm run build

# 2. Contenedor de Producción
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

CMD ["node", "dist/main.js"]
