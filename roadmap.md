# Roadmap de Implementación - ProyectoWeb Multi-Tenant

## Hito 1: Infraestructura Base y Aislamiento de Datos (SQL Puro)
- [ ] Inicializar el pool de conexiones con `pg-pool` en el DbService de `apps/api`.
- [ ] Configurar `node-pg-migrate` y crear el script de migración para las tablas base (usuarios, tenants, productos).
- [ ] Implementar políticas de seguridad Row-Level Security (RLS) en PostgreSQL a nivel de motor.
- [ ] Crear el middleware en NestJS que inyecta el `tenantId` en las variables de sesión de SQL por cada petición.

## Hito 2: Arquitectura del Frontend y Marca Blanca
- [ ] Configurar el enrutador de Next.js en `apps/store` para extraer el subdominio/dominio de la cabecera HTTP 'host'.
- [ ] Crear el servicio de hidratación dinámica (inyectar variables CSS de Tailwind según el tenant).
- [ ] Desarrollar la interfaz inicial del Panel de Administración en `apps/admin` (Gestión de productos y configuración visual).
- [ ] Implementar la subida de imágenes en el backend forzando la conversión a '.webp' mediante la librería `sharp`.

## Hito 3: Autenticación y Sesiones
- [ ] Diseñar el esquema de base de datos para credenciales y tokens de sesión.
- [ ] Implementar login de administradores del tenant en `apps/api` (NestJS).
- [ ] Integrar protección de rutas protegidas en `apps/admin` (Next.js).

## Hito 4: Pasarela de Pagos (Mercado Pago)
- [ ] Diseñar las tablas SQL de transacciones, suscripciones y configuración de credenciales MP por tenant.
- [ ] Implementar la integración OAuth de Mercado Pago en `apps/api` para que cada comercio vincule su cuenta.
- [ ] Crear los endpoints de procesamiento de Webhooks de Mercado Pago.
- [ ] Maquetar y conectar el flujo de Checkout (Guest Checkout) en `apps/store`.

## Hito 5: Logística y Cotización
- [ ] Integrar el SDK/API de Andreani en el backend para cotización en tiempo real.
- [ ] Diseñar la interfaz de cálculo de envío en el carrito de compras de `apps/store`.
