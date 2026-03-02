import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminProductsController } from "./products.controller";
import { AdminVariantsController } from "./variants.controller";
import { AdminLocationsController } from "./locations.controller";
import { AdminInventoryController } from "./inventory.controller";

@Module({
  controllers: [
    AdminController,
    AdminProductsController,
    AdminVariantsController,
    AdminLocationsController,
    AdminInventoryController,
  ],
})
export class AdminModule {}