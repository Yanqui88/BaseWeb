# AGENTS.md — apps/api (NestJS Backend)

## Contexto de esta carpeta

Este es el backend del SaaS multi-tenant. Es una aplicación NestJS que expone una API REST.

---

## 🚫 REGLAS ABSOLUTAS (No negociables)

### Base de Datos
- **PROHIBIDO** usar Prisma, TypeORM, Sequelize o cualquier ORM.
- **OBLIGATORIO** usar el driver nativo `pg` con el pool de `DbService`.
- **OBLIGATORIO** usar `node-pg-migrate` para cualquier cambio de esquema.
- **NUNCA** escribas SQL dentro de un controlador. Toda la lógica SQL va en services.

### Seguridad RLS
- **OBLIGATORIO** que toda query que acceda a datos de un tenant pase por `DbService.query()` o `DbService.transaction()`.
- **NUNCA** añadas filtros `WHERE tenant_id = ?` manuales en el código. El RLS de Postgres se encarga automáticamente cuando el `AsyncLocalStorage` tiene el contexto activo.
- Las tablas de sistema (`tenants`, `pgmigrations`) son las únicas que no tienen RLS.

---

## 🏗️ Arquitectura del módulo de base de datos

### Flujo de una petición HTTP multi-tenant
```
Request (host: tienda-abc.com)
  → TenantInterceptor (lee :tenantSlug, resuelve tenantId)
    → als.run({ tenantId: '<uuid>' }, callback)
      → Controller → Service → DbService.query()
        → BEGIN
        → SET LOCAL app.current_tenant_id = '<uuid>'
        → [SQL del desarrollador]
        → COMMIT
```

### Archivos clave
| Archivo | Responsabilidad |
|---------|----------------|
| `src/db/rls-context.interface.ts` | Tipo `RlsContext` — contrato del ALS |
| `src/db/db.service.ts` | Pool `pg` + `AsyncLocalStorage` + `applyRlsSettings()` |
| `src/db/db.module.ts` | Módulo `@Global()` que provee `DbService` |
| `src/db/tenant.interceptor.ts` | Activa el contexto ALS por cada petición |
| `migrations/` | Archivos de migración SQL (node-pg-migrate) |

---

## 📦 Dependencias críticas

| Paquete | Versión | Uso |
|---------|---------|-----|
| `pg` | `^8.x` | Driver PostgreSQL nativo + Pool |
| `@types/pg` | `^8.x` | Tipado TypeScript de `pg` |
| `node-pg-migrate` | `^8.x` | Gestión de migraciones SQL (devDep) |
| `dotenv` | `^17.x` | Carga de `.env` (devDep) |
| `@nestjs/cache-manager` | `^3.x` | Módulo de caché para NestJS |
| `cache-manager` | `^6.x` | Core de caché (keyv-based) |
| `@keyv/redis` | `^4.x` | Store Redis para Keyv |
| `keyv` | `^5.x` | Adaptador de store unificado |

---

## 📜 Scripts de migración

```bash
# Crear un nuevo archivo de migración vacío
pnpm --filter api migrate:create nombre-de-la-migracion

# Aplicar todas las migraciones pendientes
pnpm --filter api migrate:up

# Revertir la última migración aplicada
pnpm --filter api migrate:down
```

**Configuración de `node-pg-migrate`:**
- El CLI lee `DATABASE_URL` del archivo `.env`.
- Los archivos de migración viven en `apps/api/migrations/`.
- El lenguaje por defecto es TypeScript (`--migration-file-language ts`).

---

## 🔑 Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URI de conexión PostgreSQL (`postgresql://user:pass@host:port/db`) |
| `PORT` | Puerto donde escucha el servidor NestJS (default: `4000`) |
| `REDIS_URL` | URL completa de Redis (ej: `redis://localhost:6379`) — **opcional** |
| `REDIS_HOST` | Host de Redis alternativo (requiere `REDIS_PORT` op.) — **opcional** |

> Si `REDIS_URL` y `REDIS_HOST` están ausentes, el caché usa un store en **memoria** como fallback.

---

## ✅ Convenciones de código

- Todos los archivos TypeScript deben tener tipado estricto (`noImplicitAny: false` está deshabilitado pero evitar `any` explícito).
- Los imports internos del módulo `db` deben usar extensión `.js` (requerido por `moduleResolution: nodenext`).
- Toda función pública que acceda a la DB debe tener JSDoc.
- Los errores de DB se deben propagar (`throw error`) sin silenciar.

---

## 🧊 Capa de Caché (Fase 3 — Hito 7)

### Módulo
- **Archivo:** `src/cache/cache.module.ts` → `AppCacheModule` (global).
- **Store:** `@keyv/redis` vía `Keyv`, compatible con `@nestjs/cache-manager` v3.
- **Fallback:** Si no hay `REDIS_URL`, usa store en memoria (no distribuido).

### Llaves de caché (centralizadas en `src/cache/cache-keys.ts`)
| Llave | TTL | Descripción |
|-------|-----|-------------|
| `tenant:{id}:config` | 5 min | Config visual pública del tenant |
| `tenant:{id}:catalog:{locationId\|all}` | 2 min | Catálogo de productos por sucursal |

### Invalidación
| Endpoint admin | Invalida |
|----------------|----------|
| `PUT /:slug/home/banner` | `tenant:{id}:config` |
| `POST /:slug/products` | `tenant:{id}:catalog:all` |
| `PUT /:slug/products/:id` | `tenant:{id}:catalog:all` |
| `DELETE /:slug/products/:id` | `tenant:{id}:catalog:all` |

> **REGLA:** Para añadir caché a un nuevo endpoint, importar `CACHE_MANAGER` y `Cache` desde `@nestjs/cache-manager` (NO desde `cache-manager` directamente, o falla con `isolatedModules`).
