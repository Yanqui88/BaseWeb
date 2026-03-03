import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { PublicController } from "./public/public.controller";
import { AdminModule } from "./admin/admin.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { PublicProductsController } from "./public/products.controller";
import { PublicProductDetailController } from "./public/product-detail.controller";

@Module({
  imports: [ServeStaticModule.forRoot({
  rootPath: join(process.cwd(), "uploads"),
  serveRoot: "/uploads",
}), PrismaModule, AdminModule],
  controllers: [AppController, PublicController, PublicProductsController, PublicProductDetailController,],
  providers: [AppService],
})
export class AppModule {}