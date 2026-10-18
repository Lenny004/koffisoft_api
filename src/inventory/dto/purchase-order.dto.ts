import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PurchaseOrderStatus } from '../../generated/prisma/enums.js';

export class PurchaseOrderLineItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  ingredientId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty()
  @IsPositive()
  quantityOrdered!: number;

  @ApiProperty()
  @IsPositive()
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  orderDate!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expectedDelivery?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: () => [PurchaseOrderLineItemDto] })
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineItemDto)
  lines!: PurchaseOrderLineItemDto[];
}

export class UpdatePurchaseOrderLineDto {
  @ApiPropertyOptional({
    description: 'Identificador de la línea existente; si se omite, se crea.',
  })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  ingredientId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty()
  @IsPositive()
  quantityOrdered!: number;

  @ApiProperty()
  @IsPositive()
  unitCost!: number;
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expectedDelivery?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    type: () => [UpdatePurchaseOrderLineDto],
    description: 'Reemplazo de líneas (solo Draft): las omitidas se eliminan.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseOrderLineDto)
  lines?: UpdatePurchaseOrderLineDto[];
}

export class ReplacePurchaseOrderLinesDto {
  @ApiProperty({
    type: () => [UpdatePurchaseOrderLineDto],
    description: 'Conjunto completo de líneas. Las existentes no listadas se eliminan.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseOrderLineDto)
  lines!: UpdatePurchaseOrderLineDto[];
}

export class SubmitPurchaseOrderDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ApprovePurchaseOrderDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReceiveLineItemDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  lineId!: string;

  @ApiProperty()
  @IsPositive()
  quantityReceived!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lotCode!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiresOn?: string;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  storageLocationId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: () => [ReceiveLineItemDto] })
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineItemDto)
  lines!: ReceiveLineItemDto[];
}

export class PurchaseOrderListQueryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsEnum(PurchaseOrderStatus)
  @IsOptional()
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsPositive()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsPositive()
  @IsOptional()
  perPage?: number;
}

export class SupplierListQueryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @ApiPropertyOptional()
  @IsPositive()
  @IsOptional()
  page?: number;

  @ApiPropertyOptional()
  @IsPositive()
  @IsOptional()
  perPage?: number;
}

export class CreateSupplierDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  supplierCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressLine?: string;

  @ApiPropertyOptional()
  @IsPositive()
  @IsOptional()
  deliveryDays?: number;

  @ApiPropertyOptional()
  @IsPositive()
  @IsOptional()
  orderReminderDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  addressLine?: string;

  @ApiPropertyOptional()
  @IsPositive()
  @IsOptional()
  deliveryDays?: number;

  @ApiPropertyOptional()
  @IsPositive()
  @IsOptional()
  orderReminderDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  active?: boolean;
}
