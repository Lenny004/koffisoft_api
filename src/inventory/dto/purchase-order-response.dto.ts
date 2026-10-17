import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PurchaseOrderStatus } from '../../generated/prisma/enums.js';

export class PurchaseOrderLineResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ingredientId!: string;

  @ApiProperty()
  ingredientName!: string;

  @ApiProperty()
  unitId!: string;

  @ApiProperty()
  unitCode!: string;

  @ApiProperty()
  quantityOrdered!: string;

  @ApiProperty()
  unitCost!: string;

  @ApiProperty()
  totalCost!: string;

  @ApiPropertyOptional()
  quantityReceived!: string | null;

  @ApiPropertyOptional()
  receivedAt!: string | null;
}

export class PurchaseOrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderNumber!: string;

  @ApiProperty()
  locationId!: string;

  @ApiProperty()
  supplierId!: string;

  @ApiProperty()
  supplierName!: string;

  @ApiProperty({ enum: PurchaseOrderStatus })
  status!: PurchaseOrderStatus;

  @ApiProperty()
  orderDate!: string;

  @ApiPropertyOptional()
  expectedDelivery!: string | null;

  @ApiProperty()
  totalAmount!: string;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiProperty()
  createdByUserId!: string;

  @ApiPropertyOptional()
  approvedByUserId!: string | null;

  @ApiPropertyOptional()
  approvedAt!: string | null;

  @ApiProperty({ type: () => [PurchaseOrderLineResponseDto] })
  lines!: PurchaseOrderLineResponseDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PurchaseOrderPageDto {
  @ApiProperty({ type: () => [PurchaseOrderResponseDto] })
  data!: PurchaseOrderResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class SupplierResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  locationId!: string;

  @ApiProperty()
  supplierCode!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  taxId!: string | null;

  @ApiPropertyOptional()
  phone!: string | null;

  @ApiPropertyOptional()
  email!: string | null;

  @ApiPropertyOptional()
  addressLine!: string | null;

  @ApiPropertyOptional()
  deliveryDays!: number | null;

  @ApiPropertyOptional()
  orderReminderDays!: number | null;

  @ApiPropertyOptional()
  lastOrderDate!: string | null;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class SupplierPageDto {
  @ApiProperty({ type: () => [SupplierResponseDto] })
  data!: SupplierResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class SupplierOrderHistoryDto {
  @ApiProperty({ type: () => [PurchaseOrderResponseDto] })
  orders!: PurchaseOrderResponseDto[];

  @ApiProperty()
  totalOrders!: number;

  @ApiProperty()
  totalAmount!: string;
}
