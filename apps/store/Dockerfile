# ============================================================
# STAGE 1: deps — instala TODAS las dependencias (dev + prod)
# ============================================================
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Manifiestos del monorepo (cache eficiente de capas)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/store/package.json ./apps/store/

RUN pnpm install --frozen-lockfile

# ============================================================
# STAGE 2: builder — ejecuta next build
# ============================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/store/node_modules ./apps/store/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared ./packages/shared
COPY apps/store ./apps/store

# Next.js telemetría deshabilitada en producción
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter store build

# ============================================================
# STAGE 3: runner — imagen final mínima (Next.js standalone)
# ============================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# --- Copiar artefactos del build de Next.js (modo standalone) ---
# NOTA: Para activar el modo standalone (imagen más pequeña), agrega a next.config.ts:
#   output: 'standalone'
# Sin standalone, copiamos la forma clásica:
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/.next ./apps/store/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/public ./apps/store/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/node_modules ./apps/store/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/store/package.json ./apps/store/package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

USER nextjs

EXPOSE 3000

# Flag V8: limita heap a ~250MB para respetar el límite del contenedor (300MB)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "--max-old-space-size=250", "apps/store/node_modules/.bin/next", "start", "--port", "3000"]
