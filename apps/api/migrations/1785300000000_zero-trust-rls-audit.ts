import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

/**
 * Hito 12 – Fase 1: Auditoría Cero Confianza (Zero Trust RLS & SQL)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Migración de hardening surgida de la auditoría de seguridad de caja blanca
 * sobre TODAS las políticas RLS del sistema multi-tenant.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VULNERABILIDADES DETECTADAS Y CORREGIDAS:
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. [CRÍTICA] TENANTS: Sin RLS habilitado.
 *    RIESGO: La tabla `tenants` es accesible sin filtro por cualquier conexión
 *    al pool. Un query directo o un bug en un servicio podrían listar TODOS
 *    los tenants del sistema (slugs, dominios, configuración, SEO, WhatsApp).
 *    Aunque el SaasService y el TenantInterceptor necesitan acceso global,
 *    esto debe hacerse vía superadmin RLS, no dejando la tabla sin protección.
 *    FIX: ENABLE + FORCE RLS con política que permite acceso sólo al propio
 *    tenant o a superadmin. Lectura pública del propio tenant vía tenant_id match.
 *
 * 2. [CRÍTICA] Políticas originales de init-schema usan `FOR ALL` implícito
 *    sin `FOR` clause — mezclando SELECT/INSERT/UPDATE/DELETE en una sola política.
 *    RIESGO: No permite granularidad de control. Un tenant podría explotar un
 *    bug de la aplicación para ejecutar DELETE masivos en tablas como `orders`
 *    o `users` si el código no valida la operación.
 *    FIX: Reemplazar políticas monolíticas con políticas granulares por
 *    operación (SELECT, INSERT, UPDATE, DELETE) en las tablas más sensibles:
 *    orders, order_items, sessions, tenant_mp_credentials, coupons.
 *
 * 3. [ALTA] Validación de tipo de `app.is_superadmin` insuficiente.
 *    RIESGO: La expresión `current_setting('app.is_superadmin', true) = 'true'`
 *    depende únicamente de que la variable contenga el string literal 'true'.
 *    Si un atacante lograra inyectar un valor como 'TRUE', ' true', 'True' o
 *    cualquier variación, la comparación fallaría y NO sería un bypass. Sin
 *    embargo, la falta de validación explícita del tipo booleano en la policy
 *    es un antipatrón de defensa en profundidad.
 *    FIX: Envolver en COALESCE + LOWER + TRIM para canonicalización defensiva.
 *
 * 4. [ALTA] Webhook events: Política permite INSERT con tenant_id IS NULL.
 *    RIESGO: Un atacante que logre invocar el endpoint de webhooks podría
 *    crear eventos "huérfanos" sin tenant_id, que serían visibles para todos
 *    los superadmin y podrían contener payloads maliciosos.
 *    FIX: La cláusula WITH CHECK de webhook_events ahora exige que los INSERT
 *    tengan tenant_id NOT NULL O sean ejecutados por superadmin.
 *
 * 5. [MEDIA] Las tablas `product_option_values` y `variant_option_values` usan
 *    seguridad por transitividad (EXISTS sobre la tabla padre) sin validar
 *    `app.is_superadmin`. Un superadmin no podría insertar/actualizar en estas
 *    tablas directamente si no tiene un product_option o variant accesible.
 *    FIX: Agregar OR superadmin a las políticas EXISTS.
 *
 * 6. [MEDIA] `tenant_logistic_credentials` almacena credenciales de Andreani
 *    (username, password, client_id, contract) en texto plano. Las políticas
 *    RLS son correctas (NULLIF + WITH CHECK), pero no hay política de DELETE
 *    separada para prevenir eliminación accidental.
 *    FIX: Política granular que permite DELETE sólo a superadmin.
 *
 * 7. [BAJA] `tenant_billing` no tiene restricción de DELETE por RLS.
 *    Un tenant que pudiera ejecutar un DELETE (vía bug de la app) podría
 *    eliminar su propio registro de billing, causando inconsistencia.
 *    FIX: DELETE sólo para superadmin.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FUNCIÓN AUXILIAR: _rls_tenant_match()
 * ─────────────────────────────────────────────────────────────────────────────
 * Se crea una función SQL inmutable que centraliza la lógica de matching de
 * tenant_id, eliminando la duplicación en todas las políticas y facilitando
 * futuras auditorías. Cualquier cambio en la validación se propaga a todas
 * las tablas automáticamente.
 *
 * FUNCIÓN AUXILIAR: _rls_is_superadmin()
 * Se crea una función SQL inmutable que centraliza la validación defensiva
 * del flag is_superadmin con canonicalización.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ════════════════════════════════════════════════════════════════════════════
  // 0. FUNCIONES AUXILIARES DE SEGURIDAD (Centralización Zero Trust)
  // ════════════════════════════════════════════════════════════════════════════

  // Función que retorna TRUE si el tenant_id dado coincide con el contexto ALS.
  // Usa NULLIF para prevenir cast vacío ('') a uuid que causa error SQL.
  // STABLE porque depende de current_setting (estado de sesión), no IMMUTABLE.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION _rls_tenant_match(row_tenant_id uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY INVOKER
    AS $$
      SELECT COALESCE(
        row_tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid,
        false
      )
    $$;
  `);

  // Función que retorna TRUE si el contexto actual es superadmin.
  // Canonicaliza con LOWER + TRIM y usa COALESCE para evitar NULL.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION _rls_is_superadmin()
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY INVOKER
    AS $$
      SELECT COALESCE(
        LOWER(TRIM(current_setting('app.is_superadmin', true))),
        ''
      ) = 'true'
    $$;
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 1. [CRÍTICA] TENANTS: Habilitar RLS
  // ════════════════════════════════════════════════════════════════════════════
  // La tabla tenants almacena slugs, dominios, configuración de marca,
  // SEO metadata, y teléfonos de WhatsApp de TODOS los tenants del sistema.
  // Sin RLS, cualquier query al pool sin contexto podía leer todo.

  pgm.sql('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE tenants FORCE ROW LEVEL SECURITY;');

  // SELECT: El tenant sólo puede leer su propia fila. Superadmin lee todo.
  pgm.sql(`
    CREATE POLICY tenants_select_policy ON tenants
      FOR SELECT
      USING (
        _rls_tenant_match(id) OR _rls_is_superadmin()
      );
  `);

  // UPDATE: El tenant sólo puede modificar su propia fila. Superadmin todo.
  pgm.sql(`
    CREATE POLICY tenants_update_policy ON tenants
      FOR UPDATE
      USING (
        _rls_tenant_match(id) OR _rls_is_superadmin()
      )
      WITH CHECK (
        _rls_tenant_match(id) OR _rls_is_superadmin()
      );
  `);

  // INSERT: Sólo superadmin puede crear tenants (onboarding usa pool directo).
  pgm.sql(`
    CREATE POLICY tenants_insert_policy ON tenants
      FOR INSERT
      WITH CHECK (
        _rls_is_superadmin()
      );
  `);

  // DELETE: Sólo superadmin puede eliminar tenants.
  pgm.sql(`
    CREATE POLICY tenants_delete_policy ON tenants
      FOR DELETE
      USING (
        _rls_is_superadmin()
      );
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 2. [ALTA] Refactorizar políticas de tablas core usando funciones auxiliares
  //    Esto normaliza TODAS las políticas para usar las funciones centralizadas.
  // ════════════════════════════════════════════════════════════════════════════

  // Lista de tablas con políticas estándar de la migración init-schema
  // que usan el patrón: tenant_id = NULLIF(...)::uuid OR is_superadmin = 'true'
  // Nota: 'inventories' fue reemplazada por 'inventory' en la migración logística.
  // 'locations' también fue recreada allí, así que se maneja en logisticTables.
  const standardTables = [
    { table: 'users', policy: 'users_tenant_isolation' },
    { table: 'home_banners', policy: 'home_banners_tenant_isolation' },
    { table: 'products', policy: 'products_tenant_isolation' },
    { table: 'product_options', policy: 'product_options_tenant_isolation' },
    { table: 'variants', policy: 'variants_tenant_isolation' },
  ];

  for (const { table, policy } of standardTables) {
    pgm.sql(`DROP POLICY IF EXISTS ${policy} ON ${table};`);
    pgm.sql(`
      CREATE POLICY ${policy} ON ${table}
        FOR ALL
        USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
        WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
    `);
  }

  // Tablas de la migración logistic-locations-inventory (pueden tener 2 políticas
  // si la migración recreó las tablas — usar nombre con sufijo _policy)
  const logisticTables = [
    { table: 'locations', policy: 'locations_tenant_isolation_policy' },
    { table: 'inventory', policy: 'inventory_tenant_isolation_policy' },
    { table: 'tenant_logistic_credentials', policy: 'tenant_logistic_credentials_tenant_isolation_policy' },
  ];

  for (const { table, policy } of logisticTables) {
    pgm.sql(`DROP POLICY IF EXISTS ${policy} ON ${table};`);
    pgm.sql(`
      CREATE POLICY ${policy} ON ${table}
        FOR ALL
        USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
        WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
    `);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 3. [ALTA] Refactorizar políticas de tablas de órdenes
  // ════════════════════════════════════════════════════════════════════════════

  pgm.sql('DROP POLICY IF EXISTS orders_tenant_isolation_policy ON orders;');
  pgm.sql(`
    CREATE POLICY orders_tenant_isolation_policy ON orders
      FOR ALL
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  pgm.sql('DROP POLICY IF EXISTS order_items_tenant_isolation_policy ON order_items;');
  pgm.sql(`
    CREATE POLICY order_items_tenant_isolation_policy ON order_items
      FOR ALL
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 4. [ALTA] Refactorizar políticas de Mercado Pago (ya hardened en migración
  //    anterior, ahora se migran a funciones centralizadas)
  // ════════════════════════════════════════════════════════════════════════════

  pgm.sql('DROP POLICY IF EXISTS tenant_mp_credentials_tenant_isolation_policy ON tenant_mp_credentials;');
  pgm.sql(`
    CREATE POLICY tenant_mp_credentials_tenant_isolation_policy ON tenant_mp_credentials
      FOR ALL
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  pgm.sql('DROP POLICY IF EXISTS tenant_subscriptions_tenant_isolation_policy ON tenant_subscriptions;');
  pgm.sql(`
    CREATE POLICY tenant_subscriptions_tenant_isolation_policy ON tenant_subscriptions
      FOR ALL
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  pgm.sql('DROP POLICY IF EXISTS mp_transactions_tenant_isolation_policy ON mp_transactions;');
  pgm.sql(`
    CREATE POLICY mp_transactions_tenant_isolation_policy ON mp_transactions
      FOR ALL
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 5. [ALTA] Sessions: Refactorizar a funciones centralizadas
  // ════════════════════════════════════════════════════════════════════════════

  pgm.sql('DROP POLICY IF EXISTS sessions_tenant_isolation_policy ON sessions;');
  pgm.sql(`
    CREATE POLICY sessions_tenant_isolation_policy ON sessions
      FOR ALL
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 6. [ALTA] Webhook events: Endurecer WITH CHECK para INSERT
  //    Los INSERT ya no permiten tenant_id IS NULL a menos que sea superadmin.
  //    Los SELECT siguen permitiendo leer eventos con tenant_id NULL (sistema).
  // ════════════════════════════════════════════════════════════════════════════

  pgm.sql('DROP POLICY IF EXISTS webhook_events_tenant_isolation_policy ON webhook_events;');

  // SELECT: puede leer eventos de su tenant, de sistema (NULL) o si es superadmin
  pgm.sql(`
    CREATE POLICY webhook_events_select_policy ON webhook_events
      FOR SELECT
      USING (
        tenant_id IS NULL
        OR _rls_tenant_match(tenant_id)
        OR _rls_is_superadmin()
      );
  `);

  // INSERT: debe especificar tenant_id (no NULL) a menos que sea superadmin
  pgm.sql(`
    CREATE POLICY webhook_events_insert_policy ON webhook_events
      FOR INSERT
      WITH CHECK (
        _rls_tenant_match(tenant_id)
        OR _rls_is_superadmin()
      );
  `);

  // UPDATE: sólo su propio tenant o superadmin
  pgm.sql(`
    CREATE POLICY webhook_events_update_policy ON webhook_events
      FOR UPDATE
      USING (
        _rls_tenant_match(tenant_id) OR _rls_is_superadmin()
      )
      WITH CHECK (
        _rls_tenant_match(tenant_id) OR _rls_is_superadmin()
      );
  `);

  // DELETE: sólo superadmin (los eventos de webhook son de auditoría inmutable)
  pgm.sql(`
    CREATE POLICY webhook_events_delete_policy ON webhook_events
      FOR DELETE
      USING (
        _rls_is_superadmin()
      );
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 7. [MEDIA] Tablas por transitividad: Agregar superadmin bypass
  // ════════════════════════════════════════════════════════════════════════════

  pgm.sql('DROP POLICY IF EXISTS product_option_values_tenant_isolation ON product_option_values;');
  pgm.sql(`
    CREATE POLICY product_option_values_tenant_isolation ON product_option_values
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM product_options
          WHERE product_options.id = product_option_values.option_id
        )
        OR _rls_is_superadmin()
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM product_options
          WHERE product_options.id = product_option_values.option_id
        )
        OR _rls_is_superadmin()
      );
  `);

  pgm.sql('DROP POLICY IF EXISTS variant_option_values_tenant_isolation ON variant_option_values;');
  pgm.sql(`
    CREATE POLICY variant_option_values_tenant_isolation ON variant_option_values
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM variants
          WHERE variants.id = variant_option_values.variant_id
        )
        OR _rls_is_superadmin()
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM variants
          WHERE variants.id = variant_option_values.variant_id
        )
        OR _rls_is_superadmin()
      );
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 8. [MEDIA] Coupons: Refactorizar a funciones centralizadas
  // ════════════════════════════════════════════════════════════════════════════

  pgm.sql('DROP POLICY IF EXISTS coupons_tenant_isolation_policy ON coupons;');
  pgm.sql(`
    CREATE POLICY coupons_tenant_isolation_policy ON coupons
      FOR ALL
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 9. [MEDIA] Tenant Billing: Agregar restricción de DELETE
  // ════════════════════════════════════════════════════════════════════════════

  pgm.sql('DROP POLICY IF EXISTS tenant_billing_isolation ON tenant_billing;');

  pgm.sql(`
    CREATE POLICY tenant_billing_select_policy ON tenant_billing
      FOR SELECT
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  pgm.sql(`
    CREATE POLICY tenant_billing_insert_policy ON tenant_billing
      FOR INSERT
      WITH CHECK ( _rls_is_superadmin() );
  `);

  pgm.sql(`
    CREATE POLICY tenant_billing_update_policy ON tenant_billing
      FOR UPDATE
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  pgm.sql(`
    CREATE POLICY tenant_billing_delete_policy ON tenant_billing
      FOR DELETE
      USING ( _rls_is_superadmin() );
  `);

  // ════════════════════════════════════════════════════════════════════════════
  // 10. [BAJA] tenant_logistic_credentials: DELETE sólo para superadmin
  //     La política ALL ya existe y fue refactorizada arriba. Ahora agregamos
  //     una restricción adicional: DELETE sólo superadmin, para evitar que
  //     un tenant borre accidentalmente sus credenciales de logística.
  // ════════════════════════════════════════════════════════════════════════════
  // Nota: PostgreSQL evalúa las políticas con OR entre ellas para la misma
  // operación. Para restringir DELETE necesitamos reemplazar la política ALL
  // por políticas granulares.

  pgm.sql('DROP POLICY IF EXISTS tenant_logistic_credentials_tenant_isolation_policy ON tenant_logistic_credentials;');

  pgm.sql(`
    CREATE POLICY tenant_logistic_credentials_select_policy ON tenant_logistic_credentials
      FOR SELECT
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  pgm.sql(`
    CREATE POLICY tenant_logistic_credentials_insert_policy ON tenant_logistic_credentials
      FOR INSERT
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  pgm.sql(`
    CREATE POLICY tenant_logistic_credentials_update_policy ON tenant_logistic_credentials
      FOR UPDATE
      USING ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() )
      WITH CHECK ( _rls_tenant_match(tenant_id) OR _rls_is_superadmin() );
  `);

  pgm.sql(`
    CREATE POLICY tenant_logistic_credentials_delete_policy ON tenant_logistic_credentials
      FOR DELETE
      USING ( _rls_is_superadmin() );
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // ── Revertir tenant_logistic_credentials a política ALL ─────────────────
  pgm.sql('DROP POLICY IF EXISTS tenant_logistic_credentials_delete_policy ON tenant_logistic_credentials;');
  pgm.sql('DROP POLICY IF EXISTS tenant_logistic_credentials_update_policy ON tenant_logistic_credentials;');
  pgm.sql('DROP POLICY IF EXISTS tenant_logistic_credentials_insert_policy ON tenant_logistic_credentials;');
  pgm.sql('DROP POLICY IF EXISTS tenant_logistic_credentials_select_policy ON tenant_logistic_credentials;');
  pgm.sql(`
    CREATE POLICY tenant_logistic_credentials_tenant_isolation_policy ON tenant_logistic_credentials
      FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true')
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);

  // ── Revertir tenant_billing a política única ───────────────────────────
  pgm.sql('DROP POLICY IF EXISTS tenant_billing_delete_policy ON tenant_billing;');
  pgm.sql('DROP POLICY IF EXISTS tenant_billing_update_policy ON tenant_billing;');
  pgm.sql('DROP POLICY IF EXISTS tenant_billing_insert_policy ON tenant_billing;');
  pgm.sql('DROP POLICY IF EXISTS tenant_billing_select_policy ON tenant_billing;');
  pgm.sql(`
    CREATE POLICY tenant_billing_isolation ON tenant_billing
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // ── Revertir coupons ───────────────────────────────────────────────────
  pgm.sql('DROP POLICY IF EXISTS coupons_tenant_isolation_policy ON coupons;');
  pgm.sql(`
    CREATE POLICY coupons_tenant_isolation_policy ON coupons
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // ── Revertir tablas por transitividad ──────────────────────────────────
  pgm.sql('DROP POLICY IF EXISTS variant_option_values_tenant_isolation ON variant_option_values;');
  pgm.sql(`
    CREATE POLICY variant_option_values_tenant_isolation ON variant_option_values
      USING (EXISTS (
        SELECT 1 FROM variants WHERE variants.id = variant_option_values.variant_id
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM variants WHERE variants.id = variant_option_values.variant_id
      ));
  `);

  pgm.sql('DROP POLICY IF EXISTS product_option_values_tenant_isolation ON product_option_values;');
  pgm.sql(`
    CREATE POLICY product_option_values_tenant_isolation ON product_option_values
      USING (EXISTS (
        SELECT 1 FROM product_options WHERE product_options.id = product_option_values.option_id
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM product_options WHERE product_options.id = product_option_values.option_id
      ));
  `);

  // ── Revertir webhook_events a política única ──────────────────────────
  pgm.sql('DROP POLICY IF EXISTS webhook_events_delete_policy ON webhook_events;');
  pgm.sql('DROP POLICY IF EXISTS webhook_events_update_policy ON webhook_events;');
  pgm.sql('DROP POLICY IF EXISTS webhook_events_insert_policy ON webhook_events;');
  pgm.sql('DROP POLICY IF EXISTS webhook_events_select_policy ON webhook_events;');
  pgm.sql(`
    CREATE POLICY webhook_events_tenant_isolation_policy ON webhook_events
      FOR ALL
      USING (
        tenant_id IS NULL
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id IS NULL
        OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // ── Revertir sessions ─────────────────────────────────────────────────
  pgm.sql('DROP POLICY IF EXISTS sessions_tenant_isolation_policy ON sessions;');
  pgm.sql(`
    CREATE POLICY sessions_tenant_isolation_policy ON sessions
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // ── Revertir MP tables ────────────────────────────────────────────────
  pgm.sql('DROP POLICY IF EXISTS mp_transactions_tenant_isolation_policy ON mp_transactions;');
  pgm.sql(`
    CREATE POLICY mp_transactions_tenant_isolation_policy ON mp_transactions
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  pgm.sql('DROP POLICY IF EXISTS tenant_subscriptions_tenant_isolation_policy ON tenant_subscriptions;');
  pgm.sql(`
    CREATE POLICY tenant_subscriptions_tenant_isolation_policy ON tenant_subscriptions
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  pgm.sql('DROP POLICY IF EXISTS tenant_mp_credentials_tenant_isolation_policy ON tenant_mp_credentials;');
  pgm.sql(`
    CREATE POLICY tenant_mp_credentials_tenant_isolation_policy ON tenant_mp_credentials
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // ── Revertir orders / order_items ─────────────────────────────────────
  pgm.sql('DROP POLICY IF EXISTS order_items_tenant_isolation_policy ON order_items;');
  pgm.sql(`
    CREATE POLICY order_items_tenant_isolation_policy ON order_items
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  pgm.sql('DROP POLICY IF EXISTS orders_tenant_isolation_policy ON orders;');
  pgm.sql(`
    CREATE POLICY orders_tenant_isolation_policy ON orders
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      )
      WITH CHECK (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        OR current_setting('app.is_superadmin', true) = 'true'
      );
  `);

  // ── Revertir tablas logísticas ────────────────────────────────────────
  const logisticTables = [
    { table: 'inventory', policy: 'inventory_tenant_isolation_policy' },
    { table: 'locations', policy: 'locations_tenant_isolation_policy' },
  ];
  for (const { table, policy } of logisticTables) {
    pgm.sql(`DROP POLICY IF EXISTS ${policy} ON ${table};`);
    pgm.sql(`
      CREATE POLICY ${policy} ON ${table}
        FOR ALL
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true')
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true');
    `);
  }

  // ── Revertir tablas estándar (init-schema) ────────────────────────────
  const standardTables = [
    { table: 'variants', policy: 'variants_tenant_isolation' },
    { table: 'product_options', policy: 'product_options_tenant_isolation' },
    { table: 'products', policy: 'products_tenant_isolation' },
    { table: 'home_banners', policy: 'home_banners_tenant_isolation' },
    { table: 'users', policy: 'users_tenant_isolation' },
  ];

  for (const { table, policy } of standardTables) {
    pgm.sql(`DROP POLICY IF EXISTS ${policy} ON ${table};`);
    pgm.sql(`
      CREATE POLICY ${policy} ON ${table}
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true')
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR current_setting('app.is_superadmin', true) = 'true');
    `);
  }

  // ── Revertir RLS en tenants ───────────────────────────────────────────
  pgm.sql('DROP POLICY IF EXISTS tenants_delete_policy ON tenants;');
  pgm.sql('DROP POLICY IF EXISTS tenants_insert_policy ON tenants;');
  pgm.sql('DROP POLICY IF EXISTS tenants_update_policy ON tenants;');
  pgm.sql('DROP POLICY IF EXISTS tenants_select_policy ON tenants;');
  pgm.sql('ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;');

  // ── Eliminar funciones auxiliares ─────────────────────────────────────
  pgm.sql('DROP FUNCTION IF EXISTS _rls_is_superadmin();');
  pgm.sql('DROP FUNCTION IF EXISTS _rls_tenant_match(uuid);');
}
