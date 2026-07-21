# ============================================================
# STAGE 1: deps — instala TODAS las dependencias (dev + prod)
# ============================================================
FROM node:22-alpine AS deps

# pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiamos los manifiestos del monorepo primero (mejor cache de capas)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Instalamos TODAS las deps (necesarias para compilar)
RUN pnpm install --frozen-lockfile --config.ignore-scripts=false

# ============================================================
# STAGE 2: builder — compila el proyecto NestJS
# ============================================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copiamos node_modules y manifiestos desde la etapa deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared ./packages/shared
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api ./apps/api

# Compilamos solo el proyecto api
RUN pnpm --filter api build

# ============================================================
# STAGE 3: prod-deps — instala SOLO dependencias de producción
# ============================================================
FROM node:22-alpine AS prod-deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Solo dependencias de producción
RUN pnpm install --frozen-lockfile --prod --config.ignore-scripts=false

# ============================================================
# STAGE 4: runner — imagen final mínima
# ============================================================
FROM node:22-alpine AS runner

# Instalar dependencias nativas necesarias para bcrypt y sharp
RUN apk add --no-cache libc6-compat dumb-init

# Crear usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Copiar solo artefactos de producción
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared ./packages/shared

# Copiar archivos de configuración necesarios en runtime
COPY --chown=nestjs:nodejs apps/api/package.json ./apps/api/package.json

# Directorio para uploads persistentes (se monta como volumen externo)
RUN mkdir -p /app/apps/api/uploads && chown nestjs:nodejs /app/apps/api/uploads

USER nestjs

EXPOSE 4000

# dumb-init evita zombies de proceso; flags de V8 para limitar heap a ~350MB
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "--max-old-space-size=350", "apps/api/dist/main"]
