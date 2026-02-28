import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { PublicController } from "./public/public.controller";
import { AdminModule } from "./admin/admin.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";

@Module({
  imports: [ServeStaticModule.forRoot({
  rootPath: join(process.cwd(), "uploads"),
  serveRoot: "/uploads",
}), PrismaModule, AdminModule],
  controllers: [AppController, PublicController],
  providers: [AppService],
})
export class AppModule {}