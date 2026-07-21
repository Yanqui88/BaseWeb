/**
 * @file app.module.ts
 * @description Módulo raíz de la aplicación NestJS.
 *
 * Hito 8 – Rate Limiting global con Redis:
 * ─────────────────────────────────────────────────────────────────────────────
 * `ThrottlerModule` con `ThrottlerRedisStorage` personalizado (ioredis).
 * Comparte contadores entre múltiples instancias (escalado horizontal).
 *
 * Tres niveles de protección:
 *   short:  20 req / 1 seg   → anti-burst DDoS
 *   medium: 100 req / 10 seg → anti-scraping lento
 *   long:   500 req / 60 seg → límite por minuto
 *
 * Excepciones aplicadas:
 *   @SkipThrottle() en WebhooksController, MpWebhooksController
 *   @Throttle({ short: { limit: 5, ttl: 60000 } }) en CheckoutController
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { DbModule } from "./db/db.module";
import { TenantInterceptor } from "./db/tenant.interceptor";
import { PublicController } from "./public/public.controller";
import { AdminModule } from "./admin/admin.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { PublicProductsController } from "./public/products.controller";
import { PublicProductDetailController } from "./public/product-detail.controller";
import { PublicTenantModule } from "./public/public-tenant.module";
import { UploadModule } from "./upload/upload.module";
import { AuthModule } from "./auth/auth.module";
import { MpAuthModule } from "./mp-auth/mp-auth.module";
import { MpWebhooksModule } from "./mp-webhooks/mp-webhooks.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { LogisticsModule } from "./logistics/logistics.module";
import { OrdersModule } from "./orders/orders.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { EmailModule } from "./email/email.module";
import { AppCacheModule } from "./cache/cache.module";
import { MetricsModule } from "./metrics/metrics.module";
import { ThrottlerRedisStorage } from "./cache/throttler-redis.storage";
import { TenantsModule } from "./tenants/tenants.module";
import { CouponsModule } from "./coupons/coupons.module.js";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { BillingModule } from "./billing/billing.module.js";

@Module({
  imports: [
    // ── Sirve la carpeta uploads/ bajo la ruta pública /uploads ──────────────
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),

    // ── Scheduler de tareas (Cronjobs) ────────────────────────────────────────
    // Habilita el decorador @Cron() en toda la aplicación (BillingModule, etc.)
    ScheduleModule.forRoot(),

    // ── Caché global con Redis (o en memoria si REDIS_URL no está definida) ──
    AppCacheModule,

    // ── Rate Limiting global (respaldado en Redis) ────────────────────────────
    // El storage se instancia aquí con ioredis. El ThrottlerGuard se registra
    // como APP_GUARD global en los providers.
    //
    // Personalización por endpoint:
    //   @SkipThrottle()           → sin límite (webhooks externos)
    //   @Throttle({ short: {...} }) → límite personalizado (checkout)
    ThrottlerModule.forRoot({
      throttlers: [
        { name: "short",  ttl: 1000,  limit: 20  },
        { name: "medium", ttl: 10000, limit: 100 },
        { name: "long",   ttl: 60000, limit: 500 },
      ],
      // Storage Redis: comparte contadores entre instancias del API.
      // Instanciado directamente con la URL del entorno.
      storage: new ThrottlerRedisStorage(),
    }),

    DbModule,
    AdminModule,
    PublicTenantModule,
    UploadModule,
    AuthModule,
    MpAuthModule,
    MpWebhooksModule,
    CheckoutModule,
    LogisticsModule,
    OrdersModule,
    WebhooksModule,
    EmailModule,
    MetricsModule,
    TenantsModule,
    CouponsModule,
    AnalyticsModule,
    // ── Hito 10: Billing y Ciclo de Vida del Tenant ──────────────────────────
    BillingModule,
  ],
  controllers: [
    AppController,
    PublicController,
    PublicProductsController,
    PublicProductDetailController,
  ],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    // ── Guard global de rate limiting ─────────────────────────────────────────
    // Protege todos los endpoints automáticamente.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}