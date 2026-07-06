# Reglas del Entorno - Panel de Administración (apps/admin)

Este archivo define las directrices y estándares de desarrollo exclusivos para el Panel de Administración.

## 1. Arquitectura de Next.js
*   **App Router**: Uso estricto del sistema de enrutamiento basado en archivos de Next.js en `src/app`.
*   **Componentes de Servidor por Defecto**: Todos los componentes deben ser Server Components por defecto para mejorar el rendimiento y la carga inicial.
*   **Interactividad limitada ('use client')**: Únicamente añade la directiva `'use client'` al principio de los archivos que requieran interactividad del cliente (hooks de estado, efectos del navegador, manejadores de eventos complejos).
*   **Organización**: Si se necesitan subcomponentes interactivos pesados, extráelos a componentes cliente específicos para mantener los layouts y páginas principales como componentes de servidor en la medida de lo posible.

## 2. Estilos y Diseño
*   **Tailwind CSS v4**: El estilizado se realiza exclusivamente con Tailwind CSS v4. No importes CSS ad-hoc a menos que sea en `globals.css` para temas globales.
*   **Consistencia de Marca**: Utiliza variables de color CSS configuradas en el tema (ej. `var(--color-primary)`) para permitir el soporte de marca blanca y multi-tenant de forma dinámica.
*   **Modo Oscuro**: Implementa soporte completo para modo oscuro y claro de forma armónica utilizando la clase `dark:` o adaptándote a las variables de tema globales.

## 3. Calidad del Código y Tipado
*   **TypeScript Estricto**: Todos los tipos deben ser explícitos y correctos. Evita el uso de `any`.
*   **Validación de Compilación**: Cada cambio relevante debe ser verificado ejecutando `pnpm run build` en el contexto de `apps/admin`.
