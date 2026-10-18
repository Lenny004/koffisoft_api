import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { PurchaseOrdersController, SuppliersController } from './purchase-orders.controller.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InventoryController, PurchaseOrdersController, SuppliersController],
  providers: [InventoryService, PurchaseOrdersService],
  exports: [InventoryService],
})
export class InventoryModule {}
