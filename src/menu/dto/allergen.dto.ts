import { Type, Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsUUID, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminListQueryDto } from './menu-query.dto.js';

export const MENU_ALLERGEN_PRESENCE_TYPES = ['contains', 'may_contain'] as const;
export type MenuAllergenPresenceType = (typeof MENU_ALLERGEN_PRESENCE_TYPES)[number];

/** Declaración de un alérgeno para una variante vendible. */
export class MenuAllergenAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  allergenId!: string;

  @ApiProperty({ enum: MENU_ALLERGEN_PRESENCE_TYPES })
  @IsIn(MENU_ALLERGEN_PRESENCE_TYPES)
  presenceType!: MenuAllergenPresenceType;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @Transform(({ value }) => value ?? false)
  isReviewed = false;
}

/** Reemplaza el conjunto completo para evitar filas huérfanas o declaraciones obsoletas. */
export class ReplaceMenuAllergensDto {
  @ApiProperty({ type: () => [MenuAllergenAssignmentDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MenuAllergenAssignmentDto)
  allergens!: MenuAllergenAssignmentDto[];
}

/** Búsqueda administrativa del catálogo global de alérgenos. */
export class AllergenListQueryDto extends AdminListQueryDto {}
