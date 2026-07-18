# REGLAS LOCALES DEL ENTORNO: apps/e2e (Pruebas de Integración y E2E)

1. **Propósito y Alcance:**
   - Este directorio está reservado exclusivamente para la infraestructura de pruebas extremo a extremo (E2E) con Playwright.
   - Solo se permiten archivos de configuración de Playwright, especificaciones de pruebas (`*.spec.ts`), fixtures y mocks de red.

2. **Aislamiento y Pruebas:**
   - Queda estrictamente prohibido incluir lógica de negocio, componentes de interfaz de usuario o servicios del backend en este directorio.
   - Para interacciones complejas o dependencias externas (ej. pasarelas de pago, integraciones externas), se deben utilizar mocks de Playwright o llamadas a APIs controladas.
   - Las pruebas deben diseñarse de forma independiente y concurrente en la medida de lo posible.

3. **Ejecución y Flujo:**
   - El servidor de desarrollo del monorepo (`apps/store` y `apps/api`) se debe levantar automáticamente mediante la configuración de `webServer` en `playwright.config.ts` al correr las pruebas.
