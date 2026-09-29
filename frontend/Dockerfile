# ==========================================
# Multi-Stage Dockerfile para Next.js Standalone
# ==========================================

# 1. Instalación de dependencias
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# 2. Compilación de la aplicación
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables en tiempo de compilación para Next.js
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001/api/v1
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ARG NEXTAUTH_SECRET=docker-production-secret-key-xyz
ARG NEXTAUTH_URL=http://localhost:3000

ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# 3. Contenedor de Producción Ultraligero
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar el paquete standalone y assets estáticos
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
