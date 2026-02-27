# ProyectoWeb — Monorepo Full-Stack (Store + Admin + API + DB)

Base reutilizable para eCommerce (y adaptable a otros tipos de web).
Incluye:

- 🛍 **Store** (Next.js) – tienda pública
- 🛠 **Admin** (Next.js) – panel de administración
- 🧠 **API** (NestJS) – backend (público + admin)
- 🗄 **Postgres (Docker)** – base de datos
- 🧬 **Prisma v7** – ORM

Actualmente implementado:
- ✅ Banner promocional editable desde Admin
- ✅ Consumo SSR desde Store
- ✅ Multi-tenant preparado (tenant `default` por ahora)

---

# 🏗 Arquitectura General

```
[Admin (3001)] ---> [API (4000)] ---> [Postgres (5432)]
       |
       +-- Actualiza banner

[Store (3000)] ---> [API (4000)] ---> [Postgres (5432)]
       |
       +-- Lee banner público
```

---

# 📂 Estructura del Proyecto

```
ProyectoWeb/
  apps/
    store/        # Next.js tienda pública
    admin/        # Next.js panel admin
    api/          # NestJS backend
  packages/       # (reservado para librerías compartidas)
  docker-compose.yml
  pnpm-workspace.yaml
  package.json
```

---

# 🔌 Puertos

- Store: http://localhost:3000
- Admin: http://localhost:3001
- API: http://localhost:4000
- Postgres: localhost:5432

---

# 🧰 Requisitos

- Node.js
- pnpm
- Docker Desktop (virtualización activada)
- Git

Verificación:

```bash
node -v
pnpm -v
docker --version
```

---

# ⚙ Variables de Entorno

## Store → `apps/store/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_TENANT_SLUG=default
```

## Admin → `apps/admin/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_TENANT_SLUG=default
```

## API → `apps/api/.env`

```env
DATABASE_URL="postgresql://proyectoweb:proyectoweb@localhost:5432/proyectoweb?schema=public"
PORT=4000
```

⚠️ No subir archivos `.env*` al repositorio.

---

# 🚀 Primer Arranque

## 1) Levantar Base de Datos

Desde la raíz:

```bash
docker compose up -d
docker ps
```

Debe aparecer `proyectoweb_db` activo.

---

## 2) Instalar dependencias

Desde la raíz:

```bash
pnpm install
```

Si aparece advertencia de scripts bloqueados:

```bash
pnpm approve-builds
pnpm rebuild
```

---

## 3) Migraciones Prisma

```bash
cd apps/api
pnpm dlx prisma migrate dev
pnpm dlx prisma generate
```

---

## 4) Seed inicial

```bash
pnpm add -D ts-node
pnpm exec ts-node prisma/seed.ts
```

Crea:
- Tenant `default`
- Banner demo activo

---

# 💻 Desarrollo Diario

Cada vez que prendés la PC:

### Terminal 1 – DB

```bash
cd /d/ProyectoWeb
docker compose up -d
```

---

### Terminal 2 – API

```bash
cd apps/api
pnpm start:dev
```

Test:

```bash
curl http://localhost:4000/public/default/home/banner
```

---

### Terminal 3 – Store

```bash
cd apps/store
pnpm dev
```

Abrir:
http://localhost:3000

---

### Terminal 4 – Admin

```bash
cd apps/admin
pnpm dev
```

Abrir:
http://localhost:3001/banner

---

# 📡 Endpoints Clave

## Públicos (Store)

```
GET /public/:tenantSlug/home/banner
```

Ejemplo:
```
http://localhost:4000/public/default/home/banner
```

---

## Admin

```
GET /admin/:tenantSlug/home/banner
PUT /admin/:tenantSlug/home/banner
```

---

# 🖼 Banner – Comportamiento

- Desktop: texto overlay
- Mobile: texto debajo
- Si `href` es null → no clickeable
- Página `/ofertas` placeholder creada para evitar 404

---

# 🧠 Decisiones Arquitectónicas

- Multi-tenant preparado desde el inicio
- Talles y colores deben guardarse como `string`
- Estructura modular (features escalables)
- Prisma v7 con adapter `@prisma/adapter-pg`

---

# 🗺 Roadmap (Camino 1 – eCommerce Ropa)

Próximos módulos:

1. Products
2. Variants (talle / color)
3. Stock
4. Cart
5. Orders
6. Pagos (MercadoPago)
7. Envíos / Sucursales

---

# 🔖 Versionado sugerido

- `main` → base limpia
- `ecommerce` → desarrollo tienda
- Tags:
  - `v0.1-base`
  - `v1.0-ecommerce-mvp`

---

# 📌 Estado Actual

✔ Infraestructura estable  
✔ Banner funcional full-stack  
✔ Admin operativo  
✔ Multi-tenant preparado  

---

Proyecto en evolución 🚀