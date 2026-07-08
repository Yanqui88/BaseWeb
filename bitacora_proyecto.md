# Bitácora de Desarrollo - ProyectoWeb

Este archivo actúa como el registro oficial de decisiones de diseño, cambios arquitectónicos, modelo de negocio y control de versiones lógicas de nuestro framework eCommerce multi-tenant.

---

## 📌 1. Visión y Modelo de Negocio

* **Público Objetivo:** Comercios, pymes y emprendedores en ciudades medianas/pequeñas (ej. 100,000 habs.) donde un costo de desarrollo de ecommerce tradicional (>$500 USD) es prohibitive.
* **Propuesta de Valor:**
  * eCommerce funcional con envíos nacionales por una suscripción mensual accesible (aprox. $40 - $50 USD).
  * Control de stock y presencia digital profesional (estatus y visibilidad local).
  * Escalabilidad nacional (acceso potencial a millones de usuarios fuera de su localidad).
* **Modelo Operativo:**
  * **Backend Único:** Un único backend (NestJS) ejecutándose en un servidor propio (VPS de aprox. $15 USD para ~15 clientes).
  * **Frontend Dinámico Compartido:** Un único despliegue de la tienda pública (`apps/store`) que responde a múltiples dominios de forma dinámica (leyendo configuración del tenant desde la base de datos).
  * **Bajo Esfuerzo de Onboarding:** El alta de un cliente estándar se realiza desde el panel administrativo en 1 minuto, sin necesidad de tocar código ni realizar despliegues individuales.

---

## 🛠️ 2. Historial de Decisiones de Arquitectura

### [Normalización de Base de Datos]
* **Fecha:** 2026-07-07
* **Contexto:** Mantener un modelo de datos robusto, evitar redundancias y anomalías en la actualización/inserción dentro del entorno Multi-Tenant con PostgreSQL.
* **Decisión:** **Tercera Forma Normal (3NF) o Forma Normal de Boyce-Codd (BCNF) como mínimo**. Se aplicará de forma estricta en el diseño de todas las entidades, asegurando dependencias funcionales correctas y aislando componentes en tablas relacionales apropiadas.

### [Base de Datos 1 - Selección de ORM/Query Builder]
* **Fecha:** 2026-06-23
* **Contexto:** Se venía utilizando Prisma v7 configurado de manera automática por asistentes de IA. El desarrollador tiene conocimientos de SQL/Postgres y busca mayor control y eficiencia para el multi-tenant.
* **Decisión:** **SQL Puro utilizando el driver nativo de Node.js `pg` (con pg-pool)**. Se descarta Prisma v7 para eliminar el consumo del motor Rust en memoria, simplificar la configuración de RLS y permitir que el desarrollador aplique directamente sus conocimientos de SQL y Postgres. Los tipos de datos devueltos por las consultas y DTOs se definirán a mano en TypeScript.

### [Estructura del Almacenamiento de Datos]
* **Fecha:** 2026-06-23
* **Contexto:** Decisión sobre cómo aislar los datos de los clientes en el servidor Postgres único.
* **Decisión:** **Base de datos única con Row-Level Security (RLS) en Postgres**. Todos los clientes compartirán la misma base de datos física para maximizar la cantidad de webs simultáneas en el VPS económico (hasta ~30 tiendas en un VPS de 2GB RAM), pero el aislamiento de datos estará garantizado a nivel de motor de Postgres utilizando RLS (Row-Level Security), eliminando el riesgo de filtración de información por errores humanos de programación en el código.

### [Arquitectura y Despliegue del Frontend]
* **Fecha:** 2026-06-23
* **Contexto:** Definir cómo desplegar las tiendas de múltiples clientes manteniendo bajos costos y velocidad de entrega.
* **Decisión:** **Frontend Único Compartido Dinámico (SaaS Real)**. Las tiendas estándar correrán sobre un único despliegue de Next.js (`apps/store`). El diseño, colores (variables CSS), logo, banners y componentes activos se cargarán dinámicamente desde la base de datos según el host de origen (`clienteA.com`). La arquitectura queda desacoplada para admitir despliegues individuales de Next.js (`apps/custom-store-x`) apuntando al mismo backend para clientes premium que requieran un código visual único.

### [Integración de Pasarela de Pagos (Mercado Pago)]
* **Fecha:** 2026-06-23
* **Contexto:** Cada comercio debe recibir los cobros directamente en su propia cuenta de Mercado Pago sin intervención administrativa del dueño de la plataforma y sin requerir conocimientos técnicos del comerciante.
* **Decisión:** **Mercado Pago OAuth (Flujo de Aplicación)**. Se registrará una aplicación de Mercado Pago en la plataforma. Desde el panel de administración, el cliente iniciará el flujo de OAuth de Mercado Pago mediante un botón. Tras autorizar la app, el backend guardará su `access_token` y `refresh_token` encriptados en la base de datos asociados a su `tenantId`. Los checkouts de sus clientes se crearán utilizando este token para asegurar que los fondos se acrediten directamente en la cuenta bancaria del comercio.

### [Integración de Logística y Envíos Automatizados]
* **Fecha:** 2026-06-23
* **Contexto:** Brindar envíos automatizados a todo el país para expandir el alcance de comercios locales hacia todo el territorio nacional, facilitando la cotización en tiempo real y la impresión de etiquetas sin carga administrativa manual.
* **Decisión:** **Integración de APIs de Correo (ej. Andreani / Envíopack)**. La base de datos incluirá campos obligatorios de peso (en gramos) y dimensiones (alto, ancho, largo en cm) para cada [Product](file:///home/yanqui/ProyectosWeb/ProyectoWeb/apps/api/prisma/schema.prisma#L45-L62) o variante. En el checkout de Next.js, se solicitará el Código Postal (CP) al comprador, y el backend NestJS consultará al vuelo a las APIs de correo para cotizar los envíos y permitir al usuario elegir entre entrega a domicilio o retiro en sucursal del correo. Tras completarse el pago en Mercado Pago, se generará de manera automática la etiqueta de despacho (PDF) descargable desde el panel de administración del cliente.

### [Mapeo de Dominios y Enrutamiento Dinámico (Host-based Routing)]
* **Fecha:** 2026-06-23
* **Contexto:** Otorgar estatus y seriedad permitiendo que cada tienda cargue bajo su propio dominio de marca (ej. `tiendadezapatos.com`) o un subdominio de la plataforma (ej. `zapatos.miplataforma.com`) de manera transparente y segura con HTTPS.
* **Decisión:** **Enrutamiento por Host y SSL On-Demand con Caddy**. El servidor web Caddy actuará como proxy inverso y se configurará con SSL On-Demand. El cliente apuntará su dominio mediante un registro DNS tipo `A` a la IP pública del VPS. Cuando se visite el dominio, Caddy obtendrá automáticamente el certificado SSL (Let's Encrypt). Al recibir la petición, Next.js leerá el dominio desde la cabecera `host` en las peticiones HTTP y solicitará al backend los datos correspondientes a ese tenant, permitiendo una experiencia de marca blanca totalmente independiente.

### [Autenticación de Administradores y Flujo de Compra sin Fricciones (Guest Checkout)]
* **Fecha:** 2026-06-23
* **Contexto:** Permitir que los comerciantes gestionen sus tiendas de forma segura y garantizar la mayor tasa de conversión posible de ventas en la tienda pública, eliminando pasos innecesarios.
* **Decisión:** **Autenticación JWT para Administradores y Compra sin Registro (Guest Checkout) para Clientes**. Los comerciantes tendrán un usuario y contraseña guardados en la base de datos vinculados a su `tenantId` para acceder a `apps/admin` (autenticados vía tokens JWT). Los compradores de la tienda pública (`apps/store`) podrán completar compras de forma directa ingresando su email y datos de envío durante el proceso de pago, sin verse obligados a registrar una cuenta ni crear contraseñas. Cada pedido se vinculará al correo electrónico ingresado para que el comercio pueda realizar el seguimiento.

### [Sistema de Notificaciones y Comunicación (Email + WhatsApp)]
* **Fecha:** 2026-06-23
* **Contexto:** Mantener informados a los compradores y comerciantes sobre el estado de sus pedidos de manera instantánea y con bajo coste operativo para la plataforma.
* **Decisión:** **Híbrido de Emails Automatizados y Redirección a WhatsApp**. El backend utilizará un proveedor de correo electrónico (como Resend o SendGrid en sus límites gratuitos) para despachar correos transaccionales de confirmación al comprador y notificaciones de nueva venta al comerciante. En el frontend de Next.js (`apps/store`), la página de confirmación de compra incluirá un botón destacado para "Notificar por WhatsApp", que abrirá una ventana de chat directa al número de WhatsApp configurado por el comerciante con un mensaje pre-formateado que contiene el número de orden, los productos comprados y el método de entrega seleccionado.

### [Almacenamiento de Multimedia y Optimización de Imágenes]
* **Fecha:** 2026-06-23
* **Contexto:** Almacenar imágenes de productos, banners y logos de forma segura sin agotar el espacio en disco del VPS y asegurando que las páginas carguen rápido.
* **Decisión:** **Almacenamiento Local en VPS con Compresión Automática vía Sharp**. Las imágenes se almacenarán en el sistema de archivos local del VPS. El endpoint de carga del backend NestJS utilizará la librería `sharp` para procesar cada archivo subido al vuelo: se limitará la resolución máxima, se comprimirá la calidad y se convertirá forzosamente el archivo al formato moderno `.webp` (más eficiente y liviano). Esto garantiza que el uso de disco del servidor se mantenga bajo y optimiza el rendimiento SEO de las tiendas de cara al cliente final.

### [Compartición de Tipos en el Monorepo (packages/shared)]
* **Fecha:** 2026-06-23
* **Contexto:** Al remover Prisma, es crítico evitar la duplicación de tipos y asegurar que las modificaciones en las consultas del backend NestJS o las respuestas de la API no rompan los frontends en Next.js.
* **Decisión:** **Tipado Manual en un Paquete Compartido (`packages/shared`)**. Se creará un espacio común en el monorepo para declarar las interfaces de TypeScript de los modelos (ej. `Product`, `Variant`, `Order`, `Category`) y las validaciones de Zod compartidas. Tanto la API como la tienda pública y el panel administrador consumirán estos tipos locales. Esto otorga control absoluto sobre los datos expuestos (evitando enviar columnas sensibles de la base de datos al cliente final) y previene errores en tiempo de compilación.

### [Gestión de Migraciones de Base de Datos (node-pg-migrate)]
* **Fecha:** 2026-06-23
* **Contexto:** Mantener un control versionado del esquema de base de datos Postgres sin depender del motor de Prisma, permitiendo aplicar cambios de forma incremental y segura en entornos de desarrollo y producción.
* **Decisión:** **Uso de node-pg-migrate**. Se adoptará la herramienta `node-pg-migrate` instalada en `apps/api`. Los cambios en la base de datos se definirán en archivos de migración (JS/TS) que contendrán sentencias de creación/alteración SQL nativas. Se configurarán scripts en `package.json` para ejecutar comandos `up` (aplicar cambios) y `down` (revertir cambios) utilizando la CLI de la herramienta, asegurando un flujo de trabajo estándar en la industria de Node.js + PostgreSQL.

### [Control de Inventario y Multi-Depósito (Locations e Inventory)]
* **Fecha:** 2026-06-23
* **Contexto:** Definir la complejidad del inventario: si se requiere soporte para múltiples locales/depósitos físicos o una cantidad global simple por variante de producto. Además, resolver cómo cotizar envíos nacionales cuando el comercio posee sucursales en diferentes ciudades (ej. a 600 km de distancia) sin obligar a traslados físicos imposibles.
* **Decisión:** **Soporte Multi-Depósito con Selector de Sucursal en Frontend (Stock Localizado)**. Se mantendrá la estructura relacional (`Location` e `Inventory`). En lugar de sumar el stock de forma global, la tienda pública de Next.js (`apps/store`) incorporará un selector en la cabecera para que el comprador elija en qué sucursal realizar su compra (ej. "Sucursal Rosario" vs "Sucursal Central").
  * **Catálogo Dinámico:** El catálogo de productos se filtrará mediante consultas SQL para mostrar únicamente los artículos que tengan stock físico real (`quantity > 0`) en la sucursal seleccionada.
  * **Logística Localizada:** Las tarifas y etiquetas de envío nacional por correo se cotizarán utilizando el Código Postal del local activo donde el comprador realiza su orden. Cada local podrá configurar individualmente los métodos de envío que ofrece (ej. solo retiro, moto local o correo nacional).
  * **Navegación Flexible:** Si un producto no tiene stock en el local activo, el frontend le sugerirá al usuario cambiar de sucursal para ver disponibilidad en la central o sucursales alternativas con soporte de envío nacional.

---

## 🚀 3. Historial de Commits / Pushes de Git

Usa este registro para sincronizar tus pushes a GitHub. Cada vez que implementemos una sección nueva o realicemos una refactorización grande, registraremos aquí el nombre del commit/push sugerido. Puedes hacer `git commit -m "nombre-del-cambio"` para navegar en el historial de forma paralela a esta bitácora.

| Fecha | Identificador lógico (Commit Message) | Descripción del Hito | Estado |
| :--- | :--- | :--- | :--- |
| 2026-07-05 | `feat: store-host-routing-dynamic-theme` | Configuración del enrutamiento basado en 'host' en el Root Layout de `apps/store`, simulación de `fetchTenantConfig` con cache de React, inyección dinámica de `--color-primary` mediante `<style>` en el body, y mapeo de tema en Tailwind v4 (`globals.css` + `tailwind.config.ts`). | **Completado** |
| 2026-07-05 | `feat: init-schema-rls-migration` | Creación de la migración física `1783053658341_init-schema.ts` configurando las tablas `tenants` y `users` con RLS habilitado y forzado, incluyendo políticas universales basadas en `app.current_tenant_id` y `app.is_superadmin`. Hito 1 completado. | **Completado** |
| 2026-07-03 | `feat: refactor-db-module-rls-complete` | Refactorización completa del módulo `apps/api/src/db`: (1) Creación de `RlsContext` interface tipada con `tenantId` + `isSuperAdmin`. (2) Refactorización de `DbService` con Pool `pg` nativo, `AsyncLocalStorage<RlsContext>`, método privado `applyRlsSettings()` que emite `SET LOCAL app.current_tenant_id` y `SET LOCAL app.is_superadmin`, y documentación JSDoc exhaustiva. (3) Actualización de `TenantInterceptor` al nuevo tipo `RlsContext`. (4) Creación de `apps/api/AGENTS.md` con reglas locales. (5) Validación `tsc --noEmit` exitosa. | **Completado** |
| 2026-06-30 | `feat: migrar-sql-puro-rls` | Migración de base de datos de Prisma a SQL Puro, habilitación de RLS en Postgres, node-pg-migrate, DbService con AsyncLocalStorage, seed en SQL Puro y refactorización de PublicController. | **Pushed** |
| 2026-06-23 | `feat: bases-arquitectura-bitacora` | Definición de las bases técnicas del proyecto (SQL Puro, Postgres RLS, Next.js compartido, MP OAuth, Andreani, node-pg-migrate). | **Pushed** |
| 2026-07-05 | `feat: public-tenant-interceptor-rls-bridge` | **[Hito 2 - Backend Bridge]** Creación de `PublicTenantInterceptor` que lee el header `x-tenant-domain`, resuelve el `tenant_id` mediante SELECT directo (sin RLS, modo superadmin temporal vía ALS), y activa `als.run({ tenantId })` para el resto del ciclo de vida de la petición. Creación de `PublicTenantService` con método `getTenantPublicConfig()` usando SQL puro (RLS automático). Creación de `PublicTenantController` con endpoint `GET /public/tenant/config` y `@UseInterceptors(PublicTenantInterceptor)` a nivel de clase. Creación de `PublicTenantModule` y registro en `AppModule`. Compilación `nest build` exitosa sin errores. | **Completado** |
| 2026-07-05 | `chore: identity-protocol-update` | **[FIN DE CICLO]** Actualización del protocolo de identidad en `AGENTS.md` limitando a los Workers la ejecución de Fin de Ciclo y delegación. El puente Frontend-Backend RLS está funcional. Queda pendiente la migración SQL con los nuevos campos en `tenants`. | **Completado** |
| 2026-07-06 | `feat: apps-admin-initial-layout` | Creación de `apps/admin/AGENTS.md`. Desarrollo del layout principal del Panel de Administración con Sidebar reactivo (Tailwind v4) y tema oscuro. Implementación de `/settings` (formulario mock) y `/products` (tabla dinámica mock). | **Completado** |
| 2026-07-06 | `feat: image-upload-sharp` | **[Hito 2 Completado]** Implementación de la subida local de imágenes en `apps/api/src/upload`. El endpoint `POST /upload/image` procesa los archivos en memoria con `sharp` (resolución máxima 1920x1080, compresión `.webp` al 80%), y las almacena usando UUIDs. `ServeStaticModule` configurado. | **Completado** |
| 2026-07-06 | `feat: sessions-rls-migration` | **[Hito 3 - DB]** Creación de la migración `1783368384423_create-sessions-table.ts` con la tabla `sessions`: PK `id UUID DEFAULT gen_random_uuid()`, campos `tenant_id`, `user_id`, `token` (VARCHAR UNIQUE), `expires_at` y `created_at`. FK compuesta sobre `users(id, tenant_id)`. RLS habilitado, forzado, con política `sessions_tenant_isolation_policy`. Rollback verificado. | **Completado** |
| 2026-07-07 | `feat: auth-login-backend` | **[Hito 3 - API]** Creación de `AuthModule`, `AuthService` y `AuthController` en `apps/api/src/auth`. Login con `bcrypt.compare`, generación de Access Token JWT (15m) via `@nestjs/jwt` y Refresh Token (`crypto.randomBytes`). INSERT en `sessions` bajo contexto `tenantId` de ALS. `pnpm-workspace.yaml` actualizado para habilitar build scripts de `bcrypt`. Build exitoso. | **Completado** |
| 2026-07-07 | `feat: admin-login-middleware` | **[Hito 3 Completado]** Implementación del flujo completo de autenticación en `apps/admin`. Server Action `auth.actions.ts` para login con cookies `httpOnly`. Componente `LoginForm.tsx` (client) con diseño espectacular. Ruta pública `/login/page.tsx`. Middleware global en `src/middleware.ts` que protege todas las rutas y redirige a `/login` sin `access_token`. Build verificado. | **Completado** |
| 2026-07-07 | `feat: mercado-pago-integration` | **[Hito 4 Completado]** Implementación completa de la pasarela Mercado Pago. 1) Tablas SQL con RLS (`tenant_mp_credentials`, `mp_transactions`). 2) OAuth NestJS para vincular cuentas (`POST /mp-auth/link`). 3) Webhooks seguros vía ALS. 4) Guest Checkout premium en Next.js con Tailwind v4 y Glassmorphism conectado a `POST /checkout/preference`. | **Completado** |
| 2026-07-07 | `feat: logistica-andreani-db` | **[Hito 5 - DB]** Creación de migración para esquema multi-depósito (`locations`, `inventory`) y credenciales por tenant (`tenant_logistic_credentials`) con políticas estables de RLS y ON DELETE CASCADE. | **Completado** |
| 2026-07-07 | `feat: logistica-andreani-api` | **[Hito 5 - API]** Implementación de `LogisticsModule` y `AndreaniService`. Caché de JWT en memoria, consumo de API con fetch nativo y `POST /logistics/quote` con DTOs. Aislamiento por RLS para las credenciales en Postgres. | **Completado** |
| 2026-07-07 | `feat: logistica-andreani-ui` | **[Hito 5 Completado]** Creación de `ShippingCalculator.tsx` (Next.js) con interfaz Glassmorphism y micro-animaciones. Conexión del frontend a NestJS usando header dinámico `x-tenant-domain`. Propagación del costo de envío a la orden final e integración en `CheckoutForm`. | **Completado** |
| 2026-07-08 | `fix: rls-set-config-and-inventory-join` | **[Hito 5 Completado - Bugfixes]** Resolución de errores críticos en `DbService` reemplazando `SET LOCAL app.current_tenant_id = $1` por `set_config` para evitar errores de sintaxis con parámetros UUID. Alineación de tabla `inventory` (singular) y casteo explícito de `::uuid` en `products.controller.ts` para arreglar filtros de stock localizados. | **Completado** |
