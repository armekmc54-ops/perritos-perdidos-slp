# ==========================================
# Multi-Stage Dockerfile para NestJS + Prisma
# ==========================================

# 1. Dependencias y Compilación
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar OpenSSL para que Prisma compile sus engines en Alpine Linux
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

# 2. Contenedor Ligero de Producción
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3001

# Copiar artefactos de compilación y dependencias necesarias
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

CMD ["node", "dist/main.js"]
