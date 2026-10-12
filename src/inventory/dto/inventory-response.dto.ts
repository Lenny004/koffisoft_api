import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { InventoryMovementType } from '../../generated/prisma/enums.js';

export class InventoryPageMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class UnitResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  precisionScale!: number;

  @ApiProperty()
  active!: boolean;
}

export class IngredientCategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  active!: boolean;
}

export class StorageLocationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  active!: boolean;
}

export class SupplierLinkResponseDto {
  @ApiProperty({ format: 'uuid' })
  supplierId!: string;

  @ApiProperty()
  supplierName!: string;

  @ApiPropertyOptional({ nullable: true })
  supplierSku!: string | null;

  @ApiProperty({ pattern: '^\\d+(\\.\\d+)?$' })
  packQuantity!: string;

  @ApiProperty({ format: 'uuid' })
  packUnitId!: string;

  @ApiProperty()
  packUnitCode!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d+)?$' })
  unitCost!: string;

  @ApiProperty()
  isPreferred!: boolean;
}

export class SupplierResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  supplierCode!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  taxId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  addressLine!: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  ingredientCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class SupplierPageDto {
  @ApiProperty({ type: () => [SupplierResponseDto] })
  data!: SupplierResponseDto[];

  @ApiProperty({ type: () => InventoryPageMetaDto })
  meta!: InventoryPageMetaDto;
}

export class IngredientResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty()
  categoryName!: string;

  @ApiProperty({ format: 'uuid' })
  baseUnitId!: string;

  @ApiProperty()
  baseUnitCode!: string;

  @ApiProperty()
  baseUnitName!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ pattern: '^\\d+(\\.\\d+)?$' })
  reorderLevel!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d+)?$' })
  currentStock!: string;

  @ApiProperty()
  lowStock!: boolean;

  @ApiProperty()
  trackLots!: boolean;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ type: () => [SupplierLinkResponseDto] })
  supplierLinks!: SupplierLinkResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class IngredientPageDto {
  @ApiProperty({ type: () => [IngredientResponseDto] })
  data!: IngredientResponseDto[];

  @ApiProperty({ type: () => InventoryPageMetaDto })
  meta!: InventoryPageMetaDto;
}

export class GoodsReceiptLineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ingredientId!: string;

  @ApiProperty()
  ingredientName!: string;

  @ApiProperty({ format: 'uuid' })
  inventoryLotId!: string;

  @ApiProperty()
  lotCode!: string;

  @ApiProperty({ format: 'uuid' })
  unitId!: string;

  @ApiProperty()
  unitCode!: string;

  @ApiProperty()
  quantityReceived!: string;

  @ApiProperty()
  unitCost!: string;

  @ApiProperty()
  totalCost!: string;

  @ApiProperty({ format: 'date' })
  receivedOn!: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  expiresOn!: string | null;
}

export class GoodsReceiptListItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ format: 'uuid' })
  supplierId!: string;

  @ApiProperty()
  supplierName!: string;

  @ApiProperty()
  receiptNumber!: string;

  @ApiProperty({ format: 'date-time' })
  receivedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  lineCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class GoodsReceiptResponseDto extends GoodsReceiptListItemDto {
  @ApiProperty({ format: 'uuid' })
  storageLocationId!: string;

  @ApiProperty({ type: () => [GoodsReceiptLineResponseDto] })
  lines!: GoodsReceiptLineResponseDto[];
}

export class GoodsReceiptPageDto {
  @ApiProperty({ type: () => [GoodsReceiptListItemDto] })
  data!: GoodsReceiptListItemDto[];

  @ApiProperty({ type: () => InventoryPageMetaDto })
  meta!: InventoryPageMetaDto;
}

export class InventoryMovementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  storageLocationId!: string;

  @ApiProperty()
  storageLocationCode!: string;

  @ApiProperty({ format: 'uuid' })
  ingredientId!: string;

  @ApiProperty()
  ingredientName!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  inventoryLotId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lotCode!: string | null;

  @ApiProperty({ enum: InventoryMovementType })
  movementType!: InventoryMovementType;

  @ApiProperty()
  quantityDelta!: string;

  @ApiProperty()
  unitCost!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  goodsReceiptLineId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  orderLineId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class InventoryMovementPageDto {
  @ApiProperty({ type: () => [InventoryMovementResponseDto] })
  data!: InventoryMovementResponseDto[];

  @ApiProperty({ type: () => InventoryPageMetaDto })
  meta!: InventoryPageMetaDto;
}

export class LowStockAlertDto {
  @ApiProperty({ format: 'uuid' })
  ingredientId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  baseUnitCode!: string;

  @ApiProperty()
  currentStock!: string;

  @ApiProperty()
  reorderLevel!: string;
}

export class ExpiringLotAlertDto {
  @ApiProperty({ format: 'uuid' })
  inventoryLotId!: string;

  @ApiProperty({ format: 'uuid' })
  ingredientId!: string;

  @ApiProperty()
  ingredientName!: string;

  @ApiProperty()
  lotCode!: string;

  @ApiProperty({ format: 'uuid' })
  storageLocationId!: string;

  @ApiProperty()
  storageLocationCode!: string;

  @ApiProperty()
  remainingStock!: string;

  @ApiProperty({ format: 'date' })
  expiresOn!: string;
}

export class InventoryAlertsResponseDto {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ type: () => [LowStockAlertDto] })
  lowStock!: LowStockAlertDto[];

  @ApiProperty({ type: () => [ExpiringLotAlertDto] })
  expiringLots!: ExpiringLotAlertDto[];
}

export class RecipeLineResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ingredientId!: string;

  @ApiProperty()
  ingredientName!: string;

  @ApiProperty()
  ingredientSku!: string;

  @ApiProperty({ format: 'uuid' })
  unitId!: string;

  @ApiProperty()
  unitCode!: string;

  @ApiProperty()
  quantity!: string;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;
}

export class RecipeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  menuItemVariantId!: string;

  @ApiProperty()
  menuItemSku!: string;

  @ApiProperty()
  menuItemName!: string;

  @ApiProperty()
  variantName!: string;

  @ApiProperty()
  versionNo!: number;

  @ApiProperty({ format: 'date' })
  effectiveFrom!: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  effectiveTo!: string | null;

  @ApiProperty()
  yieldQuantity!: string;

  @ApiProperty({ format: 'uuid' })
  yieldUnitId!: string;

  @ApiProperty()
  yieldUnitCode!: string;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ type: () => [RecipeLineResponseDto] })
  lines!: RecipeLineResponseDto[];
}

export class RecipePageDto {
  @ApiProperty({ type: () => [RecipeResponseDto] })
  data!: RecipeResponseDto[];

  @ApiProperty({ type: () => InventoryPageMetaDto })
  meta!: InventoryPageMetaDto;
}
