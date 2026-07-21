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
- [x] Definir el esquema SQL (`orders`, `order_items`) con soporte para multi-depósito y RLS.
- [x] Desarrollar los controladores de creación de órdenes y Webhooks de actualización (Mercado Pago / Andreani).
- [x] Construir la interfaz de gestión de órdenes en `apps/admin`.
- [x] Integrar proveedor de Email o WhatsApp para notificaciones transaccionales.

## Hito 7: Optimización, Escalabilidad y Pruebas E2E
- [x] Implementar suite de pruebas E2E (Playwright o Cypress) para el flujo de Checkout y Webhooks.
- [x] Optimizar consultas a la base de datos (revisión de índices faltantes para búsqueda de productos y listado de órdenes).
- [x] Implementar caché con Redis para respuestas públicas del catálogo de productos y configuraciones del tenant.
- [x] Refinar las métricas de monitoreo de Node.js (Prometheus/Grafana o métricas nativas).

## Hito 8: Despliegue a Producción, Seguridad y CI/CD
- [x] Implementar Rate Limiting con `@nestjs/throttler` y Redis para proteger rutas públicas y Checkout.
- [x] Auditar y refactorizar Webhooks de Mercado Pago (Firma HMAC, Asincronía con BullMQ, Idempotencia estricta).
- [x] Configurar validación de caché por tags en Next.js tras webhooks de MP y acciones del panel Admin.
- [x] Dockerizar `apps/api`, `apps/store` y `apps/admin` con límites estrictos de RAM (OOM preventivo).
- [x] Configurar proxy inverso Caddy para Enrutamiento por Host y SSL On-Demand automático.
- [x] Implementar script de backups automatizados de PostgreSQL con subida remota S3-compatible (`.agents/skills/`).
- [x] Diseñar pipeline CI/CD en GitHub Actions (Testing, Build, Zero-Downtime Deployment).

## Hito 9: Crecimiento, Retención y Visibilidad
- [x] **Fase 1 (Conversión): Motor de Cupones y Descuentos.** Esquema SQL con RLS, endpoints en NestJS, gestión en `apps/admin` y aplicación en el Checkout de `apps/store`.
- [x] **Fase 2 (Inteligencia de Negocio): Analítica y Dashboard.** Endpoints agregados eficientes y rediseño del Dashboard (Home) en `apps/admin` con gráficos y KPIs de ventas.
- [x] **Fase 3 (Adquisición): SEO Dinámico y Marketing.** Generación de `sitemap.xml`, `robots.txt` multi-tenant y configuración de Meta-tags/OpenGraph en el panel.
- [x] *(Omitida)* **Fase 4 (Expansión): Nuevas Integraciones.** Se pospone Stripe/Correo para enfocarse en el mercado local y la monetización del SaaS.

## Hito 10: Monetización SaaS, Seguridad Enterprise y Pulido UI/UX
- [x] **Fase 1 (Billing & Trials):** Motor de suscripciones B2B. Configuración de periodos de prueba gratuitos variables por tenant (1, 3, 6 meses). Cobro automático vía MP.
- [x] **Fase 2 (Lifecycle & Notificaciones):** Cronjobs en NestJS para gestión de morosos. Periodo de gracia `X` (tienda online, pero con aviso), suspensión de tienda, y eliminación definitiva tras periodo `Y`. Restauración automática al pagar.
- [x] **Fase 3 (Seguridad):** Auditoría exhaustiva de RLS (Row-Level Security) y endpoints con Claude Opus 4.6. Fortalecimiento contra inyecciones y escalamiento de privilegios. _(Migración `1785200000000_security-audit-rls-hardening` aplicada: RLS en `webhook_events`, políticas normalizadas con NULLIF+WITH CHECK en `tenant_mp_credentials`, `tenant_subscriptions`, `mp_transactions`, `sessions`)_
- [x] **Fase 4 (Operativa B2B):** Importador/Exportador masivo de productos vía CSV. _(Backend: `POST /:slug/products/import` + `GET /:slug/products/export` en NestJS con `csv-parser`, Upsert por SKU en transacción RLS, validación por fila. Frontend: botones Exportar/Importar CSV en `/products` con modal glassmorphism drag-and-drop, estados de carga y reporte de resultados)_
- [x] **Fase 5 (Multi-moneda):** Soporte base para mostrar precios en múltiples monedas (ej. ARS / USD).
- [x] **Fase 6 (UI/UX Polish):** Revisión de extremo a extremo de `apps/store` y `apps/admin`. Asegurar funcionamiento de todos los botones y ampliar opciones de personalización (colores, diseño) para cada tenant.

## Hito 11: Lanzamiento a Producción Definitivo (Go-to-Market)
- [x] **Fase 1 (Onboarding Self-Service - Backend):** Creación del flujo de registro automatizado. Endpoint público en `apps/api` (`POST /saas/register`) que verifique la disponibilidad del subdominio, cree el `tenant`, aprovisione la configuración visual por defecto, asigne el plan de prueba (`trial_ends_at`) y cree la cuenta del usuario administrador.
- [x] **Fase 2 (Landing Page SaaS - Frontend):** Desarrollo del portal público del SaaS (Next.js). Implementar un enrutamiento en el middleware para que si el `host` es el dominio principal (ej. `tuplataforma.com`), se renderice la Landing Page (Pricing, Features, Call to Action) en lugar de una tienda tenant.
- [x] **Fase 3 (Flujo de Registro - Frontend):** Construcción del formulario de registro "Multistep" (Glassmorphism, Tailwind v4) en la Landing Page, con validación de disponibilidad del nombre de la tienda en tiempo real y redirección mágica al panel `apps/admin` tras un alta exitosa.
- [x] **Fase 4 (Provisionamiento de Subdominios y DNS):** Asegurar que el registro de tenants genere automáticamente el acceso mediante subdominios (ej. `mitienda.tuplataforma.com`) gestionados por el enrutamiento Caddy existente.
- [x] **Fase 5 (Activación Comercial y Facturación):** Conectar el flujo de pago del plan SaaS (Suscripción) para los tenants cuando su periodo de prueba finalice.
