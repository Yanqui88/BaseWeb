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

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),

    DbModule,
    AdminModule,
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