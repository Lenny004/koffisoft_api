/**
 * Eventos del dominio de inventario.
 */

export interface LowStockDetectedEvent {
  readonly ingredientId: string;
  readonly ingredientName: string;
  readonly sku: string;
  readonly locationId: string;
  readonly currentStock: string;
  readonly reorderLevel: string;
  readonly baseUnitCode: string;
}

export interface LotExpiringEvent {
  readonly inventoryLotId: string;
  readonly ingredientId: string;
  readonly ingredientName: string;
  readonly lotCode: string;
  readonly storageLocationId: string;
  readonly storageLocationCode: string;
  readonly locationId: string;
  readonly remainingStock: string;
  readonly expiresOn: string;
  readonly daysUntilExpiry: number;
}

export interface SupplierReminderDueEvent {
  readonly supplierId: string;
  readonly supplierName: string;
  readonly locationId: string;
  readonly reminderType: 'delivery' | 'order';
  readonly dueDate: string;
}
