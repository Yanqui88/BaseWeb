# Resumen Técnico Inmutable - ProyectoWeb

## Descripción
SaaS de Ecommerce Multi-Tenant modular de gran escala desarrollado por un único programador humano asistido por una flota de agentes autónomos en Antigravity.

## Arquitectura del Monorepo
- `apps/api`: Backend desarrollado en NestJS.
- `apps/admin`: Panel de administración global y para comercios en Next.js.
- `apps/store`: Tienda pública en Next.js (Instancia única compartida dinámicamente).
- `packages/shared`: Contratos de tipado manual TypeScript y esquemas de validación Zod comunes.

## Decisiones de Diseño Inviolables
1. Base de datos con SQL Puro (módulo `pg`), excluyendo explícitamente cualquier ORM para maximizar el rendimiento.
2. Aislamiento estricto de datos de Tenants mediante Row-Level Security (RLS) en Postgres a nivel de motor.
3. Enrutamiento dinámico en la tienda pública mapeando el subdominio/dominio desde el header 'host' en tiempo de ejecución.
4. Procesamiento local de imágenes multimedia utilizando la librería 'sharp' para conversión forzada a WebP.
5. Normalización estricta de la base de datos garantizando al menos Tercera Forma Normal (3NF) o Forma Normal de Boyce-Codd (BCNF).
