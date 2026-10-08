import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PageMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PublicMenuAllergenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty({ enum: ['contains', 'may_contain'] })
  presenceType!: string;
}

export class PublicMenuModifierDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  priceDelta!: string;
}

export class PublicMenuModifierGroupDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  selectionMin!: number;

  @ApiProperty()
  selectionMax!: number;

  @ApiProperty()
  required!: boolean;

  @ApiProperty({ type: () => [PublicMenuModifierDto] })
  modifiers!: PublicMenuModifierDto[];
}

export class PublicMenuPriceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  includesTax!: boolean;
}

export class PublicMenuVariantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  available!: boolean;

  @ApiProperty({ type: () => PublicMenuPriceDto })
  price!: PublicMenuPriceDto;

  @ApiProperty({ type: () => [PublicMenuAllergenDto] })
  allergens!: PublicMenuAllergenDto[];

  @ApiProperty({ type: () => [PublicMenuModifierGroupDto] })
  modifierGroups!: PublicMenuModifierGroupDto[];
}

export class PublicMenuItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  itemType!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiPropertyOptional()
  descriptionEs!: string | null;

  @ApiPropertyOptional()
  descriptionEn!: string | null;

  @ApiProperty({ type: () => [PublicMenuVariantDto] })
  variants!: PublicMenuVariantDto[];
}

export class PublicMenuCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiPropertyOptional()
  descriptionEs!: string | null;

  @ApiPropertyOptional()
  descriptionEn!: string | null;

  @ApiProperty({ type: () => [PublicMenuItemDto] })
  items!: PublicMenuItemDto[];
}

export class PublicMenuResponseDto {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ example: 'web' })
  channel!: string;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ type: () => [PublicMenuCategoryDto] })
  categories!: PublicMenuCategoryDto[];
}

export class PublicMenuDetailResponseDto {
  @ApiProperty({ type: () => PublicMenuCategoryDto })
  category!: Omit<PublicMenuCategoryDto, 'items'>;

  @ApiProperty({ type: () => PublicMenuItemDto })
  item!: PublicMenuItemDto;
}

export class AdminCategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiPropertyOptional()
  descriptionEs!: string | null;

  @ApiPropertyOptional()
  descriptionEn!: string | null;

  @ApiProperty()
  displayOrder!: number;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  itemCount!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class AdminCategoryPageDto {
  @ApiProperty({ type: () => [AdminCategoryResponseDto] })
  data!: AdminCategoryResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class AdminVariantSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  prepStationId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class AdminItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  categoryId!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  category!: { id: string; slug: string; nameEs: string };

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  itemType!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiPropertyOptional()
  descriptionEs!: string | null;

  @ApiPropertyOptional()
  descriptionEn!: string | null;

  @ApiProperty()
  publicVisible!: boolean;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ type: () => [AdminVariantSummaryDto] })
  variants!: AdminVariantSummaryDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class AdminItemPageDto {
  @ApiProperty({ type: () => [AdminItemResponseDto] })
  data!: AdminItemResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class AdminVariantPageDto {
  @ApiProperty({ type: () => [AdminVariantSummaryDto] })
  data!: AdminVariantSummaryDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class AdminPriceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  channel!: string;

  @ApiProperty()
  price!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  includesTax!: boolean;

  @ApiProperty({ format: 'uuid' })
  taxRateId!: string;

  @ApiProperty({ format: 'date' })
  validFrom!: string;

  @ApiPropertyOptional({ format: 'date' })
  validTo!: string | null;

  @ApiProperty()
  active!: boolean;
}

export class AdminPricePageDto {
  @ApiProperty({ type: () => [AdminPriceResponseDto] })
  data!: AdminPriceResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class AdminAllergenResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  active!: boolean;
}

export class AdminAllergenPageDto {
  @ApiProperty({ type: () => [AdminAllergenResponseDto] })
  data!: AdminAllergenResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class AdminMenuAllergenResponseDto extends AdminAllergenResponseDto {
  @ApiProperty({ enum: ['contains', 'may_contain'] })
  presenceType!: string;

  @ApiProperty()
  isReviewed!: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  reviewedAt!: string | null;
}

export class AdminAvailabilityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  channel!: string;

  @ApiProperty()
  dayOfWeek!: number;

  @ApiProperty({ example: '07:30' })
  startsAt!: string;

  @ApiProperty({ example: '11:00' })
  endsAt!: string;

  @ApiProperty()
  crossesMidnight!: boolean;

  @ApiPropertyOptional({ format: 'date' })
  validFrom!: string | null;

  @ApiPropertyOptional({ format: 'date' })
  validTo!: string | null;

  @ApiProperty()
  active!: boolean;
}

export class AdminAvailabilityPageDto {
  @ApiProperty({ type: () => [AdminAvailabilityResponseDto] })
  data!: AdminAvailabilityResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class AdminOutageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  endsAt!: string | null;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class AdminOutagePageDto {
  @ApiProperty({ type: () => [AdminOutageResponseDto] })
  data!: AdminOutageResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class AdminModifierResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  modifierGroupId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  priceDelta!: string;

  @ApiProperty()
  active!: boolean;
}

export class AdminModifierGroupResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  nameEs!: string;

  @ApiProperty()
  nameEn!: string;

  @ApiProperty()
  selectionMin!: number;

  @ApiProperty()
  selectionMax!: number;

  @ApiProperty()
  required!: boolean;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ type: () => [AdminModifierResponseDto] })
  modifiers!: AdminModifierResponseDto[];
}

export class AdminModifierGroupPageDto {
  @ApiProperty({ type: () => [AdminModifierGroupResponseDto] })
  data!: AdminModifierGroupResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}
