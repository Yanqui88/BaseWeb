# Roadmap de Implementación - ProyectoWeb Multi-Tenant

## Hito 1: Infraestructura Base y Aislamiento de Datos (SQL Puro)
- [x] Inicializar el pool de conexiones con `pg` nativo en el DbService de `apps/api`.
- [x] Configurar `node-pg-migrate` con scripts `migrate:create`, `migrate:up`, `migrate:down` en `package.json`.
- [x] Configurar y crear la primera migración SQL (tablas de `users` y `tenants`).
- [x] Implementar políticas de seguridad Row-Level Security (RLS) en PostgreSQL a nivel de motor (migración `1783053658341_init-schema.ts`).
- [x] Crear el interceptor `TenantInterceptor` en NestJS que inyecta `tenantId` e `isSuperAdmin` en el ALS por cada petición.
- [x] Implementar `AsyncLocalStorage<RlsContext>` en `DbService` con `applyRlsSettings()` para `SET LOCAL` automático.

## Hito 2: Arquitectura del Frontend y Marca Blanca
- [x] Configurar el enrutador de Next.js en `apps/store` para extraer el subdominio/dominio de la cabecera HTTP 'host'.
- [x] Crear el servicio de hidratación dinámica (inyectar variables CSS de Tailwind según el tenant).
- [x] Construir el puente de resolución en `apps/api`: `PublicTenantInterceptor` (header `x-tenant-domain` → SELECT `tenants` → `als.run({ tenantId })`) + `PublicTenantService` + `PublicTenantController` (`GET /public/tenant/config`) + `PublicTenantModule`. Compilación `nest build` exitosa.
- [x] Desarrollar la interfaz inicial del Panel de Administración en `apps/admin` (Gestión de productos y configuración visual).
- [x] Implementar la subida de imágenes en el backend forzando la conversión a '.webp' mediante la librería `sharp`.

## Hito 3: Autenticación y Sesiones
- [x] Diseñar el esquema de base de datos para credenciales y tokens de sesión.
- [x] Implementar login de administradores del tenant en `apps/api` (NestJS).
- [x] Integrar protección de rutas protegidas en `apps/admin` (Next.js).

## Hito 4: Pasarela de Pagos (Mercado Pago)
- [x] Diseñar las tablas SQL de transacciones, suscripciones y configuración de credenciales MP por tenant.
- [x] Implementar la integración OAuth de Mercado Pago en `apps/api` para que cada comercio vincule su cuenta.
- [x] Crear los endpoints de procesamiento de Webhooks de Mercado Pago.
- [x] Maquetar y conectar el flujo de Checkout (Guest Checkout) en `apps/store`.

## Hito 5: Logística y Cotización
- [x] Integrar el SDK/API de Andreani en el backend para cotización en tiempo real.
- [x] Diseñar la interfaz de cálculo de envío en el carrito de compras de `apps/store`.

## Hito 6: Gestión de Órdenes, Panel Admin y Notificaciones
- [ ] Definir el esquema SQL (`orders`, `order_items`) con soporte para multi-depósito y RLS.
- [ ] Desarrollar los controladores de creación de órdenes y Webhooks de actualización (Mercado Pago / Andreani).
- [ ] Construir la interfaz de gestión de órdenes en `apps/admin`.
- [ ] Integrar proveedor de Email o WhatsApp para notificaciones transaccionales.
