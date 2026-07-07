import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { DbModule } from "./db/db.module";
import { TenantInterceptor } from "./db/tenant.interceptor";
import { APP_INTERCEPTOR } from "@nestjs/core";
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

@Module({
  imports: [
    // Sirve la carpeta uploads/ bajo la ruta pública /uploads
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),

    DbModule,
    AdminModule,
    PublicTenantModule,
    UploadModule,
    AuthModule,
    MpAuthModule,
    MpWebhooksModule,
    CheckoutModule,
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
  ],
})
export class AppModule {}