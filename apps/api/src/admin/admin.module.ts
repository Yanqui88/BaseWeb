import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AdminController } from "./admin.controller";
import { AdminProductsController } from "./products.controller";
import { AdminVariantsController } from "./variants.controller";
import { AdminLocationsController } from "./locations.controller";
import { AdminInventoryController } from "./inventory.controller";
import { ProductsCsvController } from "./products-csv.controller";
import { ProductsCsvService } from "./products-csv.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
    }),
  ],
  controllers: [
    AdminController,
    AdminProductsController,
    AdminVariantsController,
    AdminLocationsController,
    AdminInventoryController,
    // Hito 10 – Fase 4: Importación/Exportación CSV
    ProductsCsvController,
  ],
  providers: [
    // Hito 10 – Fase 4: Servicio de procesamiento CSV
    ProductsCsvService,
  ],
})
export class AdminModule {}