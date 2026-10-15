import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { InventoryMovementType } from '../../generated/prisma/enums.js';

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/u;

function trimValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function parseBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

/** Filtros comunes para listados administrativos por sede. */
export class InventoryPageQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10_000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Transform(trimValue)
  search?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeInactive = false;
}

/** Filtros del catálogo de proveedores. */
export class SupplierListQueryDto extends InventoryPageQueryDto {}

/** Datos de un proveedor asociado a una sede. */
export class CreateSupplierDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimValue)
  supplierCode!: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  name!: string;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimValue)
  taxId?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimValue)
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  @Transform(trimValue)
  email?: string | null;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  addressLine?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active = true;
}

/** Campos editables de un proveedor sin cambiar su sede. */
export class UpdateSupplierDto {
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimValue)
  supplierCode?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  name?: string;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimValue)
  taxId?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimValue)
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  @Transform(trimValue)
  email?: string | null;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  addressLine?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active?: boolean;
}

/** Relación opcional de un ingrediente con un proveedor y su presentación. */
export class IngredientSupplierInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trimValue)
  supplierSku?: string | null;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  packQuantity!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  packUnitId!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  unitCost!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  isPreferred = false;
}

/** Datos del catálogo de ingredientes controlados por movimientos. */
export class CreateIngredientDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  baseUnitId!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(trimValue)
  sku!: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  name!: string;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  description?: string | null;

  @ApiPropertyOptional({ pattern: '^\\d+(\\.\\d{1,6})?$', default: '0' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  reorderLevel = '0';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  trackLots = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active = true;

  @ApiPropertyOptional({ type: () => [IngredientSupplierInputDto], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => IngredientSupplierInputDto)
  supplierLinks?: IngredientSupplierInputDto[];
}

/** Campos editables de un ingrediente; la existencia nunca se modifica aquí. */
export class UpdateIngredientDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  baseUnitId?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(trimValue)
  sku?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimValue)
  name?: string;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  description?: string | null;

  @ApiPropertyOptional({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  reorderLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  trackLots?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: () => [IngredientSupplierInputDto], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => IngredientSupplierInputDto)
  supplierLinks?: IngredientSupplierInputDto[];
}

/** Filtros del listado de ingredientes y su saldo calculado en movimientos. */
export class IngredientListQueryDto extends InventoryPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storageLocationId?: string;
}

/** Lista bodegas activas o históricas de una sede. */
export class StorageLocationListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  includeInactive = false;
}

/** Identifica la sede al consultar o modificar un ingrediente. */
export class InventoryLocationQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;
}

/** Filtros de recepciones de proveedores. */
export class GoodsReceiptListQueryDto extends InventoryPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;
}

/** Línea recibida en la unidad base del ingrediente y asociada a un lote. */
export class GoodsReceiptLineInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ingredientId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Transform(trimValue)
  lotCode!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  receivedOn!: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  expiresOn?: string | null;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  quantityReceived!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  unitCost!: string;
}

/** Cabecera y líneas de una recepción; receiptNumber hace la operación idempotente. */
export class CreateGoodsReceiptDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(trimValue)
  receiptNumber!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  receivedAt!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storageLocationId!: string;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  notes?: string | null;

  @ApiProperty({ type: () => [GoodsReceiptLineInputDto], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineInputDto)
  lines!: GoodsReceiptLineInputDto[];
}

/** Filtros del libro mayor de inventario. */
export class InventoryMovementListQueryDto extends InventoryPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  storageLocationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ingredientId?: string;

  @ApiPropertyOptional({ enum: InventoryMovementType })
  @IsOptional()
  @IsEnum(InventoryMovementType)
  movementType?: InventoryMovementType;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;
}

/** Ajuste positivo, ajuste negativo o merma append-only. */
export class CreateInventoryAdjustmentDto {
  @ApiProperty({ format: 'uuid', description: 'UUID opcional reutilizable para reintentos.' })
  @IsOptional()
  @IsUUID()
  operationId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storageLocationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ingredientId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  inventoryLotId?: string | null;

  @ApiProperty({
    enum: [
      InventoryMovementType.AdjustmentIn,
      InventoryMovementType.AdjustmentOut,
      InventoryMovementType.Waste,
    ],
  })
  @IsEnum(InventoryMovementType)
  movementType!: InventoryMovementType;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  quantity!: string;

  @ApiPropertyOptional({ pattern: '^\\d+(\\.\\d{1,6})?$', default: '0' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_PATTERN)
  unitCost = '0';

  @ApiProperty({ minLength: 3, maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimValue)
  reason!: string;
}

/** Ventana de alertas de vencimiento para una sede. */
export class InventoryAlertQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 365, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  expiryDays = 30;
}

/** Filtros de recetas asociadas a variantes vendibles del menú. */
export class RecipeListQueryDto extends InventoryPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  menuItemVariantId?: string;
}

/** Línea de ingrediente de una receta versionada. */
export class RecipeLineInputDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  ingredientId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  quantity!: string;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  notes?: string | null;
}

/** Crea una versión completa de receta para una variante de menú. */
export class CreateRecipeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  locationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  menuItemVariantId!: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  versionNo!: number;

  @ApiProperty({ format: 'date' })
  @IsDateString({ strict: true })
  effectiveFrom!: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  effectiveTo?: string | null;

  @ApiProperty({ pattern: '^\\d+(\\.\\d{1,6})?$' })
  @IsString()
  @Matches(DECIMAL_PATTERN)
  yieldQuantity!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  yieldUnitId!: string;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  notes?: string | null;

  @ApiProperty({ type: () => [RecipeLineInputDto], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RecipeLineInputDto)
  lines!: RecipeLineInputDto[];
}

/** Una receta activa se modifica creando otra versión; aquí solo se archiva o anota. */
export class UpdateRecipeDto {
  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  @Transform(trimValue)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(parseBoolean)
  @IsBoolean()
  active?: boolean;
}
