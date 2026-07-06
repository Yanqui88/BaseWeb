# REGLAS LOCALES DEL ENTORNO: apps/store (Frontend Next.js)

1. **Framework y Renderizado:**
   - Next.js con App Router.
   - Priorizar Server Components para consultas de datos (fetching) buscando maximizar SEO y reducir JavaScript en el cliente.
   - Todo fetching interno (hacia `apps/api`) debe hacerse con `fetch` aprovechando el sistema de Data Cache nativo (ej. revalidación temporal o por tags).

2. **Multitenancy y Marca Blanca:**
   - La identificación del tenant debe hacerse leyendo el header HTTP `host` (desde `headers()` en los Server Components) de manera dinámica.
   - El middleware solo debe limitarse a configuraciones esenciales (ej. reescritura, protección de rutas) y evitar consultas directas al backend (NestJS) a menos que sea estrictamente necesario para no agregar latencia.
   - La inyección de los colores/temas dinámicos de Tailwind CSS debe resolverse renderizando una etiqueta `<style>` con variables `--` (`:root`) dentro del Root Layout.

3. **Restricciones Generales:**
   - Prohibido utilizar bases de datos (SQL, ORM) directamente desde esta app. Todo acceso a datos pasa por `apps/api` (NestJS).
   - Uso obligatorio de Tailwind CSS para el estilizado base, pero inyectando variables dinámicas provenientes de los datos del tenant.
   - Minimizar `useEffect` y la carga de estilos que causen parpadeo visual (FOUC).
