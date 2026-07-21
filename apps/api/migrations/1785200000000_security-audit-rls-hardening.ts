import { MigrationBuilder } from 'node-pg-migrate';

export const shorthands = undefined;

/**
 * Hito 10 – Fase 3: Auditoría de Seguridad Enterprise
 * ─────────────────────────────────────────────────────────────────────────────
 * Migración de hardening de RLS surgida de la auditoría de caja blanca.
 *
 * Vulnerabilidades corregidas:
 *
 * 1. [CRÍTICA] webhook_events: Sin RLS habilitado. Cualquier query sin contexto
 *    ALS podía leer/escribir todos los eventos de todos los tenants.
 *    FIX: ENABLE + FORCE RLS con política de aislamiento estándar.
 *
 * 2. [MEDIA] tenant_mp_credentials, tenant_subscriptions, mp_transactions:
 *    Usaban `current_setting(...)::uuid` sin NULLIF, lo que causa un error SQL
 *    si la variable de sesión está vacía (''), en lugar de devolver NULL y fallar
 *    silenciosamente (deny por defecto). Esto es inconsistente con el patrón
 *    del resto de tablas y puede generar errores 500 no controlados.
 *    FIX: DROP POLICY + CREATE POLICY con NULLIF y WITH CHECK explícito.
 *
 * 3. [MEDIA] sessions: Política sin WITH CHECK, permitiendo teóricamente INSERT
 *    con tenant_id ajeno si el código de aplicación tiene un bug.
 *    FIX: DROP POLICY + CREATE POLICY con WITH CHECK simétrico.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // ════════════════════════════════════════════════════════════════════════════
  // 1. [CRÍTICA] webhook_events: Habilitar RLS
  // ════════════════════════════════════════════════════════════════════════════
  // La tabla almacena payloads de webhooks con datos sensibles de pago.
  // tenant_id es nullable (por diseño: webhooks de sistema sin tenant).
  // La política permite:
  //   - Lectura/escritura si tenant_id coincide con el contexto ALS.
  //   - Lectura/escritura si el usuario es superadmin.
  //   - Lectura/escritura si tenant_id es NULL (eventos de sistema).
  pgm.sql('ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;');
  pgm.sql('ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;');

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

  // ════════════════════════════════════════════════════════════════════════════
  // 2. [MEDIA] tenant_mp_credentials: Normalizar política con NULLIF + WITH CHECK
  // ════════════════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════════════════
  // 3. [MEDIA] tenant_subscriptions: Normalizar política con NULLIF + WITH CHECK
  // ════════════════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════════════════
  // 4. [MEDIA] mp_transactions: Normalizar política con NULLIF + WITH CHECK
  // ════════════════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════════════════
  // 5. [MEDIA] sessions: Agregar WITH CHECK simétrico
  // ════════════════════════════════════════════════════════════════════════════
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
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // ── Revertir webhook_events RLS ─────────────────────────────────────────
  pgm.sql('DROP POLICY IF EXISTS webhook_events_tenant_isolation_policy ON webhook_events;');
  pgm.sql('ALTER TABLE webhook_events DISABLE ROW LEVEL SECURITY;');

  // ── Restaurar políticas originales sin NULLIF ───────────────────────────
  pgm.sql('DROP POLICY IF EXISTS tenant_mp_credentials_tenant_isolation_policy ON tenant_mp_credentials;');
  pgm.sql(`
    CREATE POLICY tenant_mp_credentials_tenant_isolation_policy ON tenant_mp_credentials
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);

  pgm.sql('DROP POLICY IF EXISTS tenant_subscriptions_tenant_isolation_policy ON tenant_subscriptions;');
  pgm.sql(`
    CREATE POLICY tenant_subscriptions_tenant_isolation_policy ON tenant_subscriptions
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);

  pgm.sql('DROP POLICY IF EXISTS mp_transactions_tenant_isolation_policy ON mp_transactions;');
  pgm.sql(`
    CREATE POLICY mp_transactions_tenant_isolation_policy ON mp_transactions
      USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR current_setting('app.is_superadmin', true) = 'true');
  `);

  // ── Restaurar sessions sin WITH CHECK ───────────────────────────────────
  pgm.sql('DROP POLICY IF EXISTS sessions_tenant_isolation_policy ON sessions;');
  pgm.sql(`
    CREATE POLICY sessions_tenant_isolation_policy ON sessions
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR
        current_setting('app.is_superadmin', true) = 'true'
      );
  `);
}
