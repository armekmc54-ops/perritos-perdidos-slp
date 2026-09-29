# 🐾 Perritos Perdidos SLP — Monorepo

Plataforma comunitaria para reportar, rescatar y dar en adopción perritos en San Luis Potosí.
Proyecto de **M&A Digital Artisans**.

## Estructura

```
perritos-perdidos-slp/
├── frontend/         # Next.js 14 (App Router) + TypeScript + Tailwind
├── backend/          # NestJS + TypeScript
├── infra/
│   ├── postgres/     # Dockerfile custom: PostGIS + pgvector
│   └── init-db/      # Scripts SQL de inicialización
└── docker-compose.yml
```

## 1. Requisitos previos

- Node.js 20 LTS o superior
- npm (o pnpm/yarn si el equipo lo prefiere)
- Docker Desktop instalado y corriendo

## 2. Instalación de dependencias

Desde la raíz del proyecto, instala cada carpeta por separado:

```bash
cd frontend && npm install
cd ../backend && npm install
cd ..
```

Copia las variables de entorno de ejemplo:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## 3. Levantar la infraestructura (Postgres + PostGIS + pgvector, y Redis)

Desde la raíz:

```bash
docker compose up -d --build
```

La primera vez tardará un poco más porque compila pgvector dentro de la imagen de Postgres.
Verifica que ambos contenedores estén sanos:

```bash
docker compose ps
```

## 4. Levantar frontend y backend en desarrollo (con hot-reload)

Necesitas **dos terminales** abiertas en paralelo, una por cada carpeta:

**Terminal 1 — Backend (NestJS):**

```bash
cd backend
npm run start:dev
```

Corre en `http://localhost:3001/api/v1` (prueba `http://localhost:3001/api/v1/health`).

**Terminal 2 — Frontend (Next.js):**

```bash
cd frontend
npm run dev
```

Corre en `http://localhost:3000`. Cualquier cambio en `/frontend/app` o `/backend/src` se refleja al instante gracias al hot-reload de cada framework.

> Tip: si prefieres una sola terminal, puedes instalar `concurrently` en la raíz
> y correr `npx concurrently "npm --prefix backend run start:dev" "npm --prefix frontend run dev"`.

## 5. Conectar `/frontend` a Vercel desde GitHub

1. Sube este monorepo a un repositorio de GitHub (puede quedarse como un solo repo con ambas carpetas).
2. Entra a [vercel.com](https://vercel.com) e inicia sesión con la cuenta de GitHub de M&A Digital Artisans.
3. Click en **"Add New… → Project"** y selecciona el repositorio `perritos-perdidos-slp`.
4. En la pantalla de configuración del proyecto:
   - **Root Directory:** cambia el valor a `frontend` (muy importante, ya que el repo es un monorepo).
   - **Framework Preset:** Vercel detectará automáticamente "Next.js".
   - **Build Command / Output:** deja los valores por defecto que sugiere Next.js.
5. En **Environment Variables**, agrega las mismas variables que tienes en `frontend/.env` (por ejemplo `NEXT_PUBLIC_API_URL` apuntando a donde despliegues el backend en producción).
6. Click en **Deploy**. Cada nuevo `push` a la rama principal generará un deploy automático; cada Pull Request genera un preview deploy.

El backend (NestJS) **no** se despliega en Vercel — necesita su propio hosting (Railway, Render, Fly.io, o un contenedor en AWS/ECS) ya que maneja colas y procesos de larga duración.

## 6. Convenciones del proyecto

- Paleta oficial ya configurada en `frontend/tailwind.config.js`: `paliacate`, `confianza`, `esperanza`, `arena`, `carbon`.
- Todo componente de frontend nuevo va en `frontend/app` o `frontend/components` (crear esta última cuando se necesite).
- Cada dominio de negocio en el backend (reports, users, media, matches) debe vivir como su propio módulo NestJS dentro de `backend/src/modules/`.
- Footer obligatorio: "Diseño y desarrollo por M&A Digital Artisans" (ya incluido en `frontend/app/page.tsx`).

---
Siguiente paso sugerido: generar los módulos `reports`, `users`, `media` y `matches` en el backend con `nest generate module <nombre>`.
