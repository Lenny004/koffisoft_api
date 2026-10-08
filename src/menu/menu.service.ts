import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { MenuChannel } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import {
  CreateMenuCategoryDto,
  MenuCategoryListQueryDto,
  ReorderMenuCategoriesDto,
  UpdateMenuCategoryDto,
} from './dto/category.dto.js';
import { AllergenListQueryDto, ReplaceMenuAllergensDto } from './dto/allergen.dto.js';
import {
  CreateMenuAvailabilityDto,
  CreateMenuItemOutageDto,
  MenuAvailabilityListQueryDto,
  MenuOutageListQueryDto,
  UpdateMenuAvailabilityDto,
  UpdateMenuItemOutageDto,
} from './dto/availability.dto.js';
import { CreateMenuItemDto, MenuItemListQueryDto, UpdateMenuItemDto } from './dto/item.dto.js';
import { CreateMenuPriceDto, MenuPriceListQueryDto, UpdateMenuPriceDto } from './dto/price.dto.js';
import {
  CreateModifierDto,
  CreateModifierGroupDto,
  ModifierGroupListQueryDto,
  ReplaceModifierGroupsDto,
  UpdateModifierDto,
  UpdateModifierGroupDto,
} from './dto/modifier.dto.js';
import { PublicMenuQueryDto } from './dto/menu-query.dto.js';
import {
  CreateMenuItemVariantDto,
  MenuVariantListQueryDto,
  UpdateMenuItemVariantDto,
} from './dto/variant.dto.js';
import {
  AdminAllergenResponseDto,
  AdminAllergenPageDto,
  AdminAvailabilityPageDto,
  AdminAvailabilityResponseDto,
  AdminCategoryPageDto,
  AdminCategoryResponseDto,
  AdminItemPageDto,
  AdminItemResponseDto,
  AdminMenuAllergenResponseDto,
  AdminModifierGroupPageDto,
  AdminModifierGroupResponseDto,
  AdminModifierResponseDto,
  AdminOutageResponseDto,
  AdminOutagePageDto,
  AdminPricePageDto,
  AdminPriceResponseDto,
  AdminVariantPageDto,
  AdminVariantSummaryDto,
  PageMetaDto,
  PublicMenuDetailResponseDto,
  PublicMenuItemDto,
  PublicMenuResponseDto,
  PublicMenuVariantDto,
} from './dto/menu-response.dto.js';

const adminVariantSummarySelect = {
  id: true,
  prepStationId: true,
  sku: true,
  nameEs: true,
  nameEn: true,
  isDefault: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.MenuItemVariantSelect;

const adminItemSelect = {
  id: true,
  categoryId: true,
  category: { select: { id: true, slug: true, nameEs: true } },
  sku: true,
  slug: true,
  itemType: true,
  nameEs: true,
  nameEn: true,
  descriptionEs: true,
  descriptionEn: true,
  publicVisible: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  variants: {
    orderBy: [{ isDefault: 'desc' }, { nameEs: 'asc' }],
    select: adminVariantSummarySelect,
  },
} as const satisfies Prisma.MenuItemSelect;

const adminCategorySelect = {
  id: true,
  locationId: true,
  slug: true,
  nameEs: true,
  nameEn: true,
  descriptionEs: true,
  descriptionEn: true,
  displayOrder: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { menuItems: true } },
} as const satisfies Prisma.MenuCategorySelect;

const adminPriceSelect = {
  id: true,
  variantId: true,
  locationId: true,
  channel: true,
  price: true,
  currency: true,
  includesTax: true,
  taxRateId: true,
  validFrom: true,
  validTo: true,
  active: true,
} as const satisfies Prisma.MenuPriceSelect;

const adminAvailabilitySelect = {
  id: true,
  variantId: true,
  locationId: true,
  channel: true,
  dayOfWeek: true,
  startsAt: true,
  endsAt: true,
  crossesMidnight: true,
  validFrom: true,
  validTo: true,
  active: true,
} as const satisfies Prisma.MenuAvailabilitySelect;

const adminOutageSelect = {
  id: true,
  variantId: true,
  locationId: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  active: true,
  createdAt: true,
} as const satisfies Prisma.MenuItemOutageSelect;

const adminModifierSelect = {
  id: true,
  modifierGroupId: true,
  code: true,
  nameEs: true,
  nameEn: true,
  priceDelta: true,
  active: true,
} as const satisfies Prisma.ModifierSelect;

const adminModifierGroupSelect = {
  id: true,
  locationId: true,
  code: true,
  nameEs: true,
  nameEn: true,
  selectionMin: true,
  selectionMax: true,
  required: true,
  active: true,
  modifiers: {
    orderBy: { nameEs: 'asc' },
    select: adminModifierSelect,
  },
} as const satisfies Prisma.ModifierGroupSelect;

type AdminCategoryRecord = Prisma.MenuCategoryGetPayload<{ select: typeof adminCategorySelect }>;
type AdminItemRecord = Prisma.MenuItemGetPayload<{ select: typeof adminItemSelect }>;
type AdminVariantRecord = Prisma.MenuItemVariantGetPayload<{
  select: typeof adminVariantSummarySelect;
}>;
type AdminPriceRecord = Prisma.MenuPriceGetPayload<{ select: typeof adminPriceSelect }>;
type AdminAvailabilityRecord = Prisma.MenuAvailabilityGetPayload<{
  select: typeof adminAvailabilitySelect;
}>;
type AdminOutageRecord = Prisma.MenuItemOutageGetPayload<{ select: typeof adminOutageSelect }>;
type AdminModifierRecord = Prisma.ModifierGetPayload<{ select: typeof adminModifierSelect }>;
type AdminModifierGroupRecord = Prisma.ModifierGroupGetPayload<{
  select: typeof adminModifierGroupSelect;
}>;

interface PublicPriceRecord {
  readonly id: string;
  readonly price: { toString(): string };
  readonly currency: string;
  readonly includesTax: boolean;
}

interface PublicAvailabilityRecord {
  readonly dayOfWeek: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly crossesMidnight: boolean;
  readonly validFrom: Date | null;
  readonly validTo: Date | null;
}

interface PublicAllergenRecord {
  readonly presenceType: string;
  readonly allergen: {
    readonly id: string;
    readonly code: string;
    readonly nameEs: string;
    readonly nameEn: string;
  };
}

interface PublicModifierRecord {
  readonly id: string;
  readonly nameEs: string;
  readonly nameEn: string;
  readonly priceDelta: { toString(): string };
}

interface PublicModifierGroupRecord {
  readonly selectionMin: number | null;
  readonly selectionMax: number | null;
  readonly modifierGroup: {
    readonly id: string;
    readonly nameEs: string;
    readonly nameEn: string;
    readonly selectionMin: number;
    readonly selectionMax: number;
    readonly required: boolean;
    readonly modifiers: readonly PublicModifierRecord[];
  };
}

interface PublicVariantRecord {
  readonly id: string;
  readonly nameEs: string;
  readonly nameEn: string;
  readonly isDefault: boolean;
  readonly prices: readonly PublicPriceRecord[];
  readonly availabilities: readonly PublicAvailabilityRecord[];
  readonly outages: readonly { id: string }[];
  readonly menuItemAllergens: readonly PublicAllergenRecord[];
  readonly modifierGroups: readonly PublicModifierGroupRecord[];
}

interface PublicItemRecord {
  readonly id: string;
  readonly slug: string;
  readonly itemType: string;
  readonly nameEs: string;
  readonly nameEn: string;
  readonly descriptionEs: string | null;
  readonly descriptionEn: string | null;
  readonly category: {
    readonly id: string;
    readonly slug: string;
    readonly nameEs: string;
    readonly nameEn: string;
    readonly descriptionEs: string | null;
    readonly descriptionEn: string | null;
  };
  readonly variants: readonly PublicVariantRecord[];
}

interface PublicMenuContext {
  readonly now: Date;
  readonly today: Date;
  readonly dayOfWeek: number;
  readonly minuteOfDay: number;
}

interface VariantLocationRecord {
  readonly id: string;
  readonly menuItem: {
    readonly category: { readonly locationId: string };
  };
}

/** Coordina la publicación pública y la administración del catálogo persistido en Prisma. */
@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve la carta web agrupada, evaluando el precio vigente y la disponibilidad local.
   * La selección de Prisma solo trae campos comerciales que pueden exponerse al sitio.
   */
  async getPublicMenu(query: PublicMenuQueryDto): Promise<PublicMenuResponseDto> {
    const location = await this.findPublicLocation(query.locationId);
    const now = new Date();
    const context = this.publicContext(now, location.timezone);
    const variantWhere = this.publicVariantWhere(query.locationId, context.today, query.allergen);
    const itemWhere: Prisma.MenuItemWhereInput = {
      active: true,
      publicVisible: true,
      variants: { some: variantWhere },
    };

    const categories = await this.prisma.menuCategory.findMany({
      where: {
        locationId: query.locationId,
        active: true,
        ...(query.category ? { slug: query.category } : {}),
        menuItems: { some: itemWhere },
      },
      orderBy: [{ displayOrder: 'asc' }, { nameEs: 'asc' }],
      select: {
        id: true,
        slug: true,
        nameEs: true,
        nameEn: true,
        descriptionEs: true,
        descriptionEn: true,
        menuItems: {
          where: itemWhere,
          orderBy: { nameEs: 'asc' },
          select: this.publicItemSelect(query.locationId, context.today, context.now, variantWhere),
        },
      },
    });

    return {
      locationId: location.id,
      channel: 'web',
      generatedAt: now.toISOString(),
      categories: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        nameEs: category.nameEs,
        nameEn: category.nameEn,
        descriptionEs: category.descriptionEs,
        descriptionEn: category.descriptionEn,
        items: category.menuItems
          .map((item) => this.toPublicItem(item as unknown as PublicItemRecord, context))
          .filter((item): item is PublicMenuItemDto => item !== null),
      })),
    };
  }

  /** Devuelve un ítem visible por slug dentro de una sede y aplica el mismo filtro de carta. */
  async getPublicItem(
    slug: string,
    query: PublicMenuQueryDto,
  ): Promise<PublicMenuDetailResponseDto> {
    const location = await this.findPublicLocation(query.locationId);
    const now = new Date();
    const context = this.publicContext(now, location.timezone);
    const variantWhere = this.publicVariantWhere(query.locationId, context.today, query.allergen);
    const item = await this.prisma.menuItem.findFirst({
      where: {
        slug,
        active: true,
        publicVisible: true,
        category: {
          locationId: query.locationId,
          active: true,
          ...(query.category ? { slug: query.category } : {}),
        },
        variants: { some: variantWhere },
      },
      select: this.publicItemSelect(query.locationId, context.today, context.now, variantWhere),
    });

    if (!item) {
      throw new NotFoundException('Ítem de menú no encontrado.');
    }

    const mappedItem = this.toPublicItem(item as unknown as PublicItemRecord, context);
    if (!mappedItem) {
      throw new NotFoundException('Ítem de menú no encontrado.');
    }

    return {
      category: {
        id: item.category.id,
        slug: item.category.slug,
        nameEs: item.category.nameEs,
        nameEn: item.category.nameEn,
        descriptionEs: item.category.descriptionEs,
        descriptionEn: item.category.descriptionEn,
      },
      item: mappedItem,
    };
  }

  async listCategories(query: MenuCategoryListQueryDto): Promise<AdminCategoryPageDto> {
    const where: Prisma.MenuCategoryWhereInput = {
      locationId: query.locationId,
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.search
        ? {
            OR: [
              { slug: { contains: query.search, mode: 'insensitive' } },
              { nameEs: { contains: query.search, mode: 'insensitive' } },
              { nameEn: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.menuCategory.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { nameEs: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
        select: adminCategorySelect,
      }),
      this.prisma.menuCategory.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toAdminCategory(row)),
      meta: this.pageMeta(query, total),
    };
  }

  async getCategory(id: string, locationId: string): Promise<AdminCategoryResponseDto> {
    const row = await this.prisma.menuCategory.findFirst({
      where: { id, locationId },
      select: adminCategorySelect,
    });
    if (!row) {
      throw new NotFoundException('Categoría no encontrada.');
    }
    return this.toAdminCategory(row);
  }

  async createCategory(dto: CreateMenuCategoryDto): Promise<AdminCategoryResponseDto> {
    await this.requireLocation(dto.locationId);
    const data: Prisma.MenuCategoryUncheckedCreateInput = {
      locationId: dto.locationId,
      slug: dto.slug,
      nameEs: dto.nameEs,
      nameEn: dto.nameEn,
      descriptionEs: dto.descriptionEs,
      descriptionEn: dto.descriptionEn,
      displayOrder: dto.displayOrder,
      active: dto.active,
    };
    const row = await this.db(() =>
      this.prisma.menuCategory.create({ data, select: adminCategorySelect }),
    );
    return this.toAdminCategory(row);
  }

  async updateCategory(id: string, locationId: string, dto: UpdateMenuCategoryDto) {
    await this.getCategory(id, locationId);
    const data: Prisma.MenuCategoryUncheckedUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.nameEs !== undefined) data.nameEs = dto.nameEs;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.descriptionEs !== undefined) data.descriptionEs = dto.descriptionEs;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length > 0) {
      await this.db(() => this.prisma.menuCategory.update({ where: { id }, data }));
    }
    return this.getCategory(id, locationId);
  }

  async deleteCategory(id: string, locationId: string): Promise<AdminCategoryResponseDto> {
    await this.getCategory(id, locationId);
    await this.db(() =>
      this.prisma.menuCategory.update({ where: { id }, data: { active: false } }),
    );
    return this.getCategory(id, locationId);
  }

  /** Actualiza display_order de categorías verificadas de la misma sede en una transacción. */
  async reorderCategories(
    locationId: string,
    dto: ReorderMenuCategoriesDto,
  ): Promise<AdminCategoryResponseDto[]> {
    const ids = dto.categories.map((category) => category.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Una categoría no puede aparecer dos veces en el reordenamiento.',
      );
    }
    const existing = await this.prisma.menuCategory.findMany({
      where: { locationId, id: { in: ids } },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      throw new NotFoundException('Una o más categorías no pertenecen a la sede.');
    }

    await this.db(() =>
      this.prisma.$transaction(
        dto.categories.map((category) =>
          this.prisma.menuCategory.update({
            where: { id: category.id },
            data: { displayOrder: category.displayOrder },
          }),
        ),
      ),
    );

    return Promise.all(ids.map((id) => this.getCategory(id, locationId)));
  }

  async listItems(query: MenuItemListQueryDto): Promise<AdminItemPageDto> {
    const where: Prisma.MenuItemWhereInput = {
      category: { locationId: query.locationId },
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { nameEs: { contains: query.search, mode: 'insensitive' } },
              { nameEn: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.menuItem.findMany({
        where,
        orderBy: [{ nameEs: 'asc' }, { id: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
        select: adminItemSelect,
      }),
      this.prisma.menuItem.count({ where }),
    ]);
    return { data: rows.map((row) => this.toAdminItem(row)), meta: this.pageMeta(query, total) };
  }

  async getItem(id: string): Promise<AdminItemResponseDto> {
    const row = await this.prisma.menuItem.findUnique({ where: { id }, select: adminItemSelect });
    if (!row) {
      throw new NotFoundException('Ítem de menú no encontrado.');
    }
    return this.toAdminItem(row);
  }

  async createItem(dto: CreateMenuItemDto): Promise<AdminItemResponseDto> {
    await this.requireCategory(dto.categoryId);
    const data: Prisma.MenuItemUncheckedCreateInput = {
      categoryId: dto.categoryId,
      sku: dto.sku,
      slug: dto.slug,
      itemType: dto.itemType,
      nameEs: dto.nameEs,
      nameEn: dto.nameEn,
      descriptionEs: dto.descriptionEs,
      descriptionEn: dto.descriptionEn,
      publicVisible: dto.publicVisible,
      active: dto.active,
    };
    const row = await this.db(() => this.prisma.menuItem.create({ data, select: adminItemSelect }));
    return this.toAdminItem(row);
  }

  async updateItem(id: string, dto: UpdateMenuItemDto): Promise<AdminItemResponseDto> {
    await this.getItem(id);
    if (dto.categoryId !== undefined) {
      await this.requireCategory(dto.categoryId);
    }
    const data: Prisma.MenuItemUncheckedUpdateInput = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.itemType !== undefined) data.itemType = dto.itemType;
    if (dto.nameEs !== undefined) data.nameEs = dto.nameEs;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.descriptionEs !== undefined) data.descriptionEs = dto.descriptionEs;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.publicVisible !== undefined) data.publicVisible = dto.publicVisible;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length > 0) {
      await this.db(() => this.prisma.menuItem.update({ where: { id }, data }));
    }
    return this.getItem(id);
  }

  async deleteItem(id: string): Promise<AdminItemResponseDto> {
    await this.db(() => this.prisma.menuItem.update({ where: { id }, data: { active: false } }));
    return this.getItem(id);
  }

  async listVariants(itemId: string, query: MenuVariantListQueryDto): Promise<AdminVariantPageDto> {
    await this.requireItem(itemId);
    const where: Prisma.MenuItemVariantWhereInput = {
      menuItemId: itemId,
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: 'insensitive' } },
              { nameEs: { contains: query.search, mode: 'insensitive' } },
              { nameEn: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.menuItemVariant.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { nameEs: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
        select: adminVariantSummarySelect,
      }),
      this.prisma.menuItemVariant.count({ where }),
    ]);
    return { data: rows.map((row) => this.toAdminVariant(row)), meta: this.pageMeta(query, total) };
  }

  async getVariant(id: string): Promise<AdminVariantSummaryDto> {
    const row = await this.prisma.menuItemVariant.findUnique({
      where: { id },
      select: adminVariantSummarySelect,
    });
    if (!row) {
      throw new NotFoundException('Variante de menú no encontrada.');
    }
    return this.toAdminVariant(row);
  }

  async createVariant(
    itemId: string,
    dto: CreateMenuItemVariantDto,
  ): Promise<AdminVariantSummaryDto> {
    const item = await this.requireItemWithLocation(itemId);
    await this.requirePrepStation(dto.prepStationId, item.menuItem.category.locationId);
    const data: Prisma.MenuItemVariantUncheckedCreateInput = {
      menuItemId: itemId,
      prepStationId: dto.prepStationId,
      sku: dto.sku,
      nameEs: dto.nameEs,
      nameEn: dto.nameEn,
      isDefault: dto.isDefault,
      active: dto.active,
    };
    const row = await this.db(() =>
      this.prisma.$transaction(async (tx) => {
        if (dto.isDefault && dto.active) {
          await tx.menuItemVariant.updateMany({
            where: { menuItemId: itemId, isDefault: true, active: true },
            data: { isDefault: false },
          });
        }
        return tx.menuItemVariant.create({ data, select: adminVariantSummarySelect });
      }),
    );
    return this.toAdminVariant(row);
  }

  async updateVariant(id: string, dto: UpdateMenuItemVariantDto): Promise<AdminVariantSummaryDto> {
    const current = await this.requireVariantWithLocation(id);
    if (dto.prepStationId !== undefined) {
      await this.requirePrepStation(dto.prepStationId, current.menuItem.category.locationId);
    }
    const data: Prisma.MenuItemVariantUncheckedUpdateInput = {};
    if (dto.prepStationId !== undefined) data.prepStationId = dto.prepStationId;
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.nameEs !== undefined) data.nameEs = dto.nameEs;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.active !== undefined) data.active = dto.active;

    const row = await this.db(() =>
      this.prisma.$transaction(async (tx) => {
        if (dto.isDefault === true && dto.active !== false) {
          await tx.menuItemVariant.updateMany({
            where: {
              menuItemId: current.menuItemId,
              id: { not: id },
              isDefault: true,
              active: true,
            },
            data: { isDefault: false },
          });
        }
        if (Object.keys(data).length > 0) {
          await tx.menuItemVariant.update({ where: { id }, data });
        }
        return tx.menuItemVariant.findUniqueOrThrow({
          where: { id },
          select: adminVariantSummarySelect,
        });
      }),
    );
    return this.toAdminVariant(row);
  }

  async deleteVariant(id: string): Promise<AdminVariantSummaryDto> {
    await this.db(() =>
      this.prisma.menuItemVariant.update({ where: { id }, data: { active: false } }),
    );
    return this.getVariant(id);
  }

  async listPrices(variantId: string, query: MenuPriceListQueryDto): Promise<AdminPricePageDto> {
    await this.requireVariantWithLocation(variantId);
    const where: Prisma.MenuPriceWhereInput = {
      variantId,
      ...(query.includeInactive ? {} : { active: true }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.menuPrice.findMany({
        where,
        orderBy: [{ validFrom: 'desc' }, { channel: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
        select: adminPriceSelect,
      }),
      this.prisma.menuPrice.count({ where }),
    ]);
    return { data: rows.map((row) => this.toAdminPrice(row)), meta: this.pageMeta(query, total) };
  }

  async createPrice(variantId: string, dto: CreateMenuPriceDto): Promise<AdminPriceResponseDto> {
    const variant = await this.requireVariantWithLocation(variantId);
    this.ensureSameLocation(dto.locationId, variant.menuItem.category.locationId);
    const validFrom = dateOnly(dto.validFrom);
    const validTo = dto.validTo ? dateOnly(dto.validTo) : null;
    const data: Prisma.MenuPriceUncheckedCreateInput = {
      variantId,
      locationId: dto.locationId,
      channel: dto.channel,
      price: dto.price,
      currency: 'USD',
      includesTax: dto.includesTax,
      taxRateId: dto.taxRateId,
      validFrom,
      validTo,
      active: dto.active,
    };
    this.validatePriceDates(validFrom, validTo);
    const row = await this.db(() =>
      this.prisma.menuPrice.create({ data, select: adminPriceSelect }),
    );
    return this.toAdminPrice(row);
  }

  async updatePrice(id: string, dto: UpdateMenuPriceDto): Promise<AdminPriceResponseDto> {
    const current = await this.getPriceRecord(id);
    const data: Prisma.MenuPriceUncheckedUpdateInput = {};
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.includesTax !== undefined) data.includesTax = dto.includesTax;
    if (dto.taxRateId !== undefined) data.taxRateId = dto.taxRateId;
    if (dto.validFrom !== undefined) data.validFrom = dateOnly(dto.validFrom);
    if (dto.validTo !== undefined) data.validTo = dto.validTo ? dateOnly(dto.validTo) : null;
    if (dto.active !== undefined) data.active = dto.active;
    this.validatePriceDates(
      (data.validFrom as Date | undefined) ?? current.validFrom,
      data.validTo === undefined ? current.validTo : (data.validTo as Date | null),
    );
    if (Object.keys(data).length > 0) {
      await this.db(() => this.prisma.menuPrice.update({ where: { id }, data }));
    }
    return this.getPrice(id);
  }

  async getPrice(id: string): Promise<AdminPriceResponseDto> {
    const row = await this.prisma.menuPrice.findUnique({ where: { id }, select: adminPriceSelect });
    if (!row) {
      throw new NotFoundException('Precio no encontrado.');
    }
    return this.toAdminPrice(row);
  }

  async deletePrice(id: string): Promise<AdminPriceResponseDto> {
    await this.db(() => this.prisma.menuPrice.update({ where: { id }, data: { active: false } }));
    return this.getPrice(id);
  }

  async listAllergens(query: AllergenListQueryDto): Promise<AdminAllergenPageDto> {
    const where: Prisma.AllergenWhereInput = {
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { nameEs: { contains: query.search, mode: 'insensitive' } },
              { nameEn: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.allergen.findMany({
        where,
        orderBy: { nameEs: 'asc' },
        skip: this.skip(query),
        take: query.pageSize,
      }),
      this.prisma.allergen.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toAdminAllergen(row)),
      meta: this.pageMeta(query, total),
    };
  }

  async listVariantAllergens(variantId: string): Promise<AdminMenuAllergenResponseDto[]> {
    await this.requireVariantWithLocation(variantId);
    const rows = await this.prisma.menuItemAllergen.findMany({
      where: { menuItemVariantId: variantId },
      orderBy: { allergen: { nameEs: 'asc' } },
      include: { allergen: true },
    });
    return rows.map((row) => ({
      ...this.toAdminAllergen(row.allergen),
      presenceType: row.presenceType,
      isReviewed: row.isReviewed,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    }));
  }

  /** Reemplaza declaraciones y conserva en la fila quién confirmó la revisión. */
  async replaceVariantAllergens(
    variantId: string,
    dto: ReplaceMenuAllergensDto,
    userId: string,
  ): Promise<AdminMenuAllergenResponseDto[]> {
    await this.requireVariantWithLocation(variantId);
    const ids = dto.allergens.map((allergen) => allergen.allergenId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un alérgeno no puede repetirse en la misma variante.');
    }
    const activeAllergens = ids.length
      ? await this.prisma.allergen.findMany({
          where: { id: { in: ids }, active: true },
          select: { id: true },
        })
      : [];
    if (activeAllergens.length !== ids.length) {
      throw new BadRequestException('Uno o más alérgenos no existen o están inactivos.');
    }

    await this.db(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.menuItemAllergen.deleteMany({ where: { menuItemVariantId: variantId } });
        if (dto.allergens.length > 0) {
          await tx.menuItemAllergen.createMany({
            data: dto.allergens.map((allergen) => ({
              menuItemVariantId: variantId,
              allergenId: allergen.allergenId,
              presenceType: allergen.presenceType,
              isReviewed: allergen.isReviewed,
              reviewedAt: allergen.isReviewed ? new Date() : null,
              reviewedByUserId: allergen.isReviewed ? userId : null,
            })),
          });
        }
      }),
    );
    return this.listVariantAllergens(variantId);
  }

  async listAvailability(
    variantId: string,
    query: MenuAvailabilityListQueryDto,
  ): Promise<AdminAvailabilityPageDto> {
    await this.requireVariantWithLocation(variantId);
    const where: Prisma.MenuAvailabilityWhereInput = {
      variantId,
      ...(query.includeInactive ? {} : { active: true }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.menuAvailability.findMany({
        where,
        orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
        select: adminAvailabilitySelect,
      }),
      this.prisma.menuAvailability.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toAdminAvailability(row)),
      meta: this.pageMeta(query, total),
    };
  }

  async createAvailability(
    variantId: string,
    dto: CreateMenuAvailabilityDto,
  ): Promise<AdminAvailabilityResponseDto> {
    const variant = await this.requireVariantWithLocation(variantId);
    this.ensureSameLocation(dto.locationId, variant.menuItem.category.locationId);
    this.validateAvailability(
      dto.startsAt,
      dto.endsAt,
      dto.crossesMidnight,
      dto.validFrom,
      dto.validTo,
    );
    const data: Prisma.MenuAvailabilityUncheckedCreateInput = {
      variantId,
      locationId: dto.locationId,
      channel: dto.channel,
      dayOfWeek: dto.dayOfWeek,
      startsAt: timeOnly(dto.startsAt),
      endsAt: timeOnly(dto.endsAt),
      crossesMidnight: dto.crossesMidnight,
      validFrom: dto.validFrom ? dateOnly(dto.validFrom) : null,
      validTo: dto.validTo ? dateOnly(dto.validTo) : null,
      active: dto.active,
    };
    const row = await this.db(() =>
      this.prisma.menuAvailability.create({ data, select: adminAvailabilitySelect }),
    );
    return this.toAdminAvailability(row);
  }

  async updateAvailability(
    id: string,
    dto: UpdateMenuAvailabilityDto,
  ): Promise<AdminAvailabilityResponseDto> {
    const current = await this.requireAvailability(id);
    const startsAt = dto.startsAt ?? formatTime(current.startsAt);
    const endsAt = dto.endsAt ?? formatTime(current.endsAt);
    const crossesMidnight = dto.crossesMidnight ?? current.crossesMidnight;
    this.validateAvailability(
      startsAt,
      endsAt,
      crossesMidnight,
      dto.validFrom ?? (current.validFrom ? dateString(current.validFrom) : undefined),
      dto.validTo ?? (current.validTo ? dateString(current.validTo) : undefined),
    );
    const data: Prisma.MenuAvailabilityUncheckedUpdateInput = {};
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.dayOfWeek !== undefined) data.dayOfWeek = dto.dayOfWeek;
    if (dto.startsAt !== undefined) data.startsAt = timeOnly(dto.startsAt);
    if (dto.endsAt !== undefined) data.endsAt = timeOnly(dto.endsAt);
    if (dto.crossesMidnight !== undefined) data.crossesMidnight = dto.crossesMidnight;
    if (dto.validFrom !== undefined)
      data.validFrom = dto.validFrom ? dateOnly(dto.validFrom) : null;
    if (dto.validTo !== undefined) data.validTo = dto.validTo ? dateOnly(dto.validTo) : null;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length > 0) {
      await this.db(() => this.prisma.menuAvailability.update({ where: { id }, data }));
    }
    return this.getAvailability(id);
  }

  async getAvailability(id: string): Promise<AdminAvailabilityResponseDto> {
    const row = await this.prisma.menuAvailability.findUnique({
      where: { id },
      select: adminAvailabilitySelect,
    });
    if (!row) throw new NotFoundException('Ventana de disponibilidad no encontrada.');
    return this.toAdminAvailability(row);
  }

  async deleteAvailability(id: string): Promise<AdminAvailabilityResponseDto> {
    await this.db(() =>
      this.prisma.menuAvailability.update({ where: { id }, data: { active: false } }),
    );
    return this.getAvailability(id);
  }

  async listOutages(variantId: string, query: MenuOutageListQueryDto): Promise<AdminOutagePageDto> {
    await this.requireVariantWithLocation(variantId);
    const where: Prisma.MenuItemOutageWhereInput = {
      variantId,
      ...(query.includeInactive ? {} : { active: true }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.menuItemOutage.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        skip: this.skip(query),
        take: query.pageSize,
        select: adminOutageSelect,
      }),
      this.prisma.menuItemOutage.count({ where }),
    ]);
    return { data: rows.map((row) => this.toAdminOutage(row)), meta: this.pageMeta(query, total) };
  }

  async createOutage(
    variantId: string,
    dto: CreateMenuItemOutageDto,
    userId: string,
  ): Promise<AdminOutageResponseDto> {
    const variant = await this.requireVariantWithLocation(variantId);
    this.ensureSameLocation(dto.locationId, variant.menuItem.category.locationId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    this.validateOutage(startsAt, endsAt);
    const data: Prisma.MenuItemOutageUncheckedCreateInput = {
      variantId,
      locationId: dto.locationId,
      startsAt,
      endsAt,
      reason: dto.reason,
      createdByUserId: userId,
      active: dto.active,
    };
    const row = await this.db(() =>
      this.prisma.menuItemOutage.create({ data, select: adminOutageSelect }),
    );
    return this.toAdminOutage(row);
  }

  async updateOutage(id: string, dto: UpdateMenuItemOutageDto): Promise<AdminOutageResponseDto> {
    const current = await this.requireOutage(id);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt =
      dto.endsAt === undefined ? current.endsAt : dto.endsAt ? new Date(dto.endsAt) : null;
    this.validateOutage(startsAt, endsAt);
    const data: Prisma.MenuItemOutageUncheckedUpdateInput = {};
    if (dto.startsAt !== undefined) data.startsAt = startsAt;
    if (dto.endsAt !== undefined) data.endsAt = endsAt;
    if (dto.reason !== undefined) data.reason = dto.reason;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length > 0) {
      await this.db(() => this.prisma.menuItemOutage.update({ where: { id }, data }));
    }
    return this.getOutage(id);
  }

  async getOutage(id: string): Promise<AdminOutageResponseDto> {
    const row = await this.prisma.menuItemOutage.findUnique({
      where: { id },
      select: adminOutageSelect,
    });
    if (!row) throw new NotFoundException('Agotado temporal no encontrado.');
    return this.toAdminOutage(row);
  }

  async deleteOutage(id: string): Promise<AdminOutageResponseDto> {
    await this.db(() =>
      this.prisma.menuItemOutage.update({ where: { id }, data: { active: false } }),
    );
    return this.getOutage(id);
  }

  async listModifierGroups(query: ModifierGroupListQueryDto): Promise<AdminModifierGroupPageDto> {
    const where: Prisma.ModifierGroupWhereInput = {
      locationId: query.locationId,
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { nameEs: { contains: query.search, mode: 'insensitive' } },
              { nameEn: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.modifierGroup.findMany({
        where,
        orderBy: [{ nameEs: 'asc' }, { id: 'asc' }],
        skip: this.skip(query),
        take: query.pageSize,
        select: adminModifierGroupSelect,
      }),
      this.prisma.modifierGroup.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.toAdminModifierGroup(row)),
      meta: this.pageMeta(query, total),
    };
  }

  async createModifierGroup(dto: CreateModifierGroupDto): Promise<AdminModifierGroupResponseDto> {
    this.validateSelectionLimits(dto.selectionMin, dto.selectionMax);
    await this.requireLocation(dto.locationId);
    const data: Prisma.ModifierGroupUncheckedCreateInput = {
      locationId: dto.locationId,
      code: dto.code,
      nameEs: dto.nameEs,
      nameEn: dto.nameEn,
      selectionMin: dto.selectionMin,
      selectionMax: dto.selectionMax,
      required: dto.required,
      active: dto.active,
    };
    const row = await this.db(() =>
      this.prisma.modifierGroup.create({ data, select: adminModifierGroupSelect }),
    );
    return this.toAdminModifierGroup(row);
  }

  async updateModifierGroup(
    id: string,
    dto: UpdateModifierGroupDto,
  ): Promise<AdminModifierGroupResponseDto> {
    const current = await this.requireModifierGroup(id);
    this.validateSelectionLimits(
      dto.selectionMin ?? current.selectionMin,
      dto.selectionMax ?? current.selectionMax,
    );
    const data: Prisma.ModifierGroupUncheckedUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.nameEs !== undefined) data.nameEs = dto.nameEs;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.selectionMin !== undefined) data.selectionMin = dto.selectionMin;
    if (dto.selectionMax !== undefined) data.selectionMax = dto.selectionMax;
    if (dto.required !== undefined) data.required = dto.required;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length > 0) {
      await this.db(() => this.prisma.modifierGroup.update({ where: { id }, data }));
    }
    return this.getModifierGroup(id);
  }

  async getModifierGroup(id: string): Promise<AdminModifierGroupResponseDto> {
    const row = await this.prisma.modifierGroup.findUnique({
      where: { id },
      select: adminModifierGroupSelect,
    });
    if (!row) throw new NotFoundException('Grupo de modificadores no encontrado.');
    return this.toAdminModifierGroup(row);
  }

  async deleteModifierGroup(id: string): Promise<AdminModifierGroupResponseDto> {
    await this.db(() =>
      this.prisma.modifierGroup.update({ where: { id }, data: { active: false } }),
    );
    return this.getModifierGroup(id);
  }

  async createModifier(groupId: string, dto: CreateModifierDto): Promise<AdminModifierResponseDto> {
    await this.requireModifierGroup(groupId);
    const data: Prisma.ModifierUncheckedCreateInput = {
      modifierGroupId: groupId,
      code: dto.code,
      nameEs: dto.nameEs,
      nameEn: dto.nameEn,
      priceDelta: dto.priceDelta,
      active: dto.active,
    };
    const row = await this.db(() =>
      this.prisma.modifier.create({ data, select: adminModifierSelect }),
    );
    return this.toAdminModifier(row);
  }

  async updateModifier(id: string, dto: UpdateModifierDto): Promise<AdminModifierResponseDto> {
    await this.requireModifier(id);
    const data: Prisma.ModifierUncheckedUpdateInput = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.nameEs !== undefined) data.nameEs = dto.nameEs;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.priceDelta !== undefined) data.priceDelta = dto.priceDelta;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length > 0) {
      await this.db(() => this.prisma.modifier.update({ where: { id }, data }));
    }
    return this.getModifier(id);
  }

  async getModifier(id: string): Promise<AdminModifierResponseDto> {
    const row = await this.prisma.modifier.findUnique({
      where: { id },
      select: adminModifierSelect,
    });
    if (!row) throw new NotFoundException('Modificador no encontrado.');
    return this.toAdminModifier(row);
  }

  async deleteModifier(id: string): Promise<AdminModifierResponseDto> {
    await this.db(() => this.prisma.modifier.update({ where: { id }, data: { active: false } }));
    return this.getModifier(id);
  }

  /** Reemplaza los grupos permitidos de una variante y aplica sus órdenes en una transacción. */
  async replaceVariantModifierGroups(
    variantId: string,
    dto: ReplaceModifierGroupsDto,
  ): Promise<AdminModifierGroupResponseDto[]> {
    const variant = await this.requireVariantWithLocation(variantId);
    const ids = dto.groups.map((group) => group.modifierGroupId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException(
        'Un grupo de modificadores no puede repetirse en una variante.',
      );
    }
    const groups = ids.length
      ? await this.prisma.modifierGroup.findMany({
          where: {
            id: { in: ids },
            locationId: variant.menuItem.category.locationId,
            active: true,
          },
          select: { id: true, selectionMin: true, selectionMax: true },
        })
      : [];
    if (groups.length !== ids.length) {
      throw new BadRequestException(
        'Uno o más grupos no existen, están inactivos o pertenecen a otra sede.',
      );
    }
    const groupById = new Map(groups.map((group) => [group.id, group]));
    for (const assignment of dto.groups) {
      const group = groupById.get(assignment.modifierGroupId);
      if (!group) continue;
      this.validateSelectionLimits(
        assignment.selectionMin ?? group.selectionMin,
        assignment.selectionMax ?? group.selectionMax,
      );
    }

    await this.db(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.menuItemModifierGroup.deleteMany({ where: { variantId } });
        if (dto.groups.length > 0) {
          await tx.menuItemModifierGroup.createMany({
            data: dto.groups.map((group) => ({
              variantId,
              modifierGroupId: group.modifierGroupId,
              selectionMin: group.selectionMin ?? null,
              selectionMax: group.selectionMax ?? null,
              displayOrder: group.displayOrder,
            })),
          });
        }
      }),
    );
    const assigned = await this.prisma.menuItemModifierGroup.findMany({
      where: { variantId },
      orderBy: { displayOrder: 'asc' },
      select: {
        selectionMin: true,
        selectionMax: true,
        displayOrder: true,
        modifierGroup: { select: adminModifierGroupSelect },
      },
    });
    return assigned.map((assignment) => this.toAdminModifierGroup(assignment.modifierGroup));
  }

  private publicVariantWhere(
    locationId: string,
    today: Date,
    allergen?: string,
  ): Prisma.MenuItemVariantWhereInput {
    const currentPrice: Prisma.MenuPriceWhereInput = {
      locationId,
      channel: MenuChannel.Web,
      active: true,
      validFrom: { lte: today },
      OR: [{ validTo: null }, { validTo: { gt: today } }],
    };
    return {
      active: true,
      prices: { some: currentPrice },
      ...(allergen
        ? {
            menuItemAllergens: {
              some: { allergen: { active: true, code: { equals: allergen, mode: 'insensitive' } } },
            },
          }
        : {}),
    };
  }

  private publicItemSelect(
    locationId: string,
    today: Date,
    now: Date,
    variantWhere: Prisma.MenuItemVariantWhereInput,
  ): Prisma.MenuItemSelect {
    const priceWhere: Prisma.MenuPriceWhereInput = {
      locationId,
      channel: MenuChannel.Web,
      active: true,
      validFrom: { lte: today },
      OR: [{ validTo: null }, { validTo: { gt: today } }],
    };
    return {
      id: true,
      slug: true,
      itemType: true,
      nameEs: true,
      nameEn: true,
      descriptionEs: true,
      descriptionEn: true,
      category: {
        select: {
          id: true,
          slug: true,
          nameEs: true,
          nameEn: true,
          descriptionEs: true,
          descriptionEn: true,
        },
      },
      variants: {
        where: variantWhere,
        orderBy: [{ isDefault: 'desc' }, { nameEs: 'asc' }],
        select: {
          id: true,
          nameEs: true,
          nameEn: true,
          isDefault: true,
          prices: {
            where: priceWhere,
            orderBy: { validFrom: 'desc' },
            take: 1,
            select: { id: true, price: true, currency: true, includesTax: true },
          },
          availabilities: {
            where: { locationId, channel: MenuChannel.Web, active: true },
            select: {
              dayOfWeek: true,
              startsAt: true,
              endsAt: true,
              crossesMidnight: true,
              validFrom: true,
              validTo: true,
            },
          },
          outages: {
            where: {
              locationId,
              active: true,
              startsAt: { lte: now },
              OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            },
            select: { id: true },
            take: 1,
          },
          menuItemAllergens: {
            where: { allergen: { active: true } },
            orderBy: { allergen: { nameEs: 'asc' } },
            select: {
              presenceType: true,
              allergen: { select: { id: true, code: true, nameEs: true, nameEn: true } },
            },
          },
          modifierGroups: {
            where: { modifierGroup: { active: true } },
            orderBy: { displayOrder: 'asc' },
            select: {
              selectionMin: true,
              selectionMax: true,
              modifierGroup: {
                select: {
                  id: true,
                  nameEs: true,
                  nameEn: true,
                  selectionMin: true,
                  selectionMax: true,
                  required: true,
                  modifiers: {
                    where: { active: true },
                    orderBy: { nameEs: 'asc' },
                    select: { id: true, nameEs: true, nameEn: true, priceDelta: true },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  private toPublicItem(
    item: PublicItemRecord,
    context: PublicMenuContext,
  ): PublicMenuItemDto | null {
    const variants = item.variants
      .map((variant) => this.toPublicVariant(variant, context))
      .filter((variant): variant is PublicMenuVariantDto => variant !== null);
    if (variants.length === 0) return null;
    return {
      id: item.id,
      slug: item.slug,
      itemType: item.itemType.toLowerCase(),
      nameEs: item.nameEs,
      nameEn: item.nameEn,
      descriptionEs: item.descriptionEs,
      descriptionEn: item.descriptionEn,
      variants,
    };
  }

  private toPublicVariant(
    variant: PublicVariantRecord,
    context: PublicMenuContext,
  ): PublicMenuVariantDto | null {
    const price = variant.prices[0];
    if (!price) return null;
    const scheduled =
      variant.availabilities.length === 0 ||
      variant.availabilities.some((availability) =>
        this.availabilityMatches(availability, context),
      );
    return {
      id: variant.id,
      nameEs: variant.nameEs,
      nameEn: variant.nameEn,
      isDefault: variant.isDefault,
      available: scheduled && variant.outages.length === 0,
      price: {
        id: price.id,
        amount: price.price.toString(),
        currency: price.currency,
        includesTax: price.includesTax,
      },
      allergens: variant.menuItemAllergens.map((entry) => ({
        id: entry.allergen.id,
        code: entry.allergen.code,
        nameEs: entry.allergen.nameEs,
        nameEn: entry.allergen.nameEn,
        presenceType: entry.presenceType,
      })),
      modifierGroups: variant.modifierGroups.map((entry) => ({
        id: entry.modifierGroup.id,
        nameEs: entry.modifierGroup.nameEs,
        nameEn: entry.modifierGroup.nameEn,
        selectionMin: entry.selectionMin ?? entry.modifierGroup.selectionMin,
        selectionMax: entry.selectionMax ?? entry.modifierGroup.selectionMax,
        required: entry.modifierGroup.required,
        modifiers: entry.modifierGroup.modifiers.map((modifier) => ({
          id: modifier.id,
          nameEs: modifier.nameEs,
          nameEn: modifier.nameEn,
          priceDelta: modifier.priceDelta.toString(),
        })),
      })),
    };
  }

  private availabilityMatches(
    availability: PublicAvailabilityRecord,
    context: PublicMenuContext,
  ): boolean {
    const currentDate = context.today.getTime();
    const previousDate = new Date(currentDate - 86_400_000);
    const startDateValid = this.dateWindowContains(
      availability.validFrom,
      availability.validTo,
      context.today,
    );
    const previousDateValid = this.dateWindowContains(
      availability.validFrom,
      availability.validTo,
      previousDate,
    );
    const start = timeMinutes(availability.startsAt);
    const end = timeMinutes(availability.endsAt);
    if (!availability.crossesMidnight) {
      return (
        availability.dayOfWeek === context.dayOfWeek &&
        startDateValid &&
        context.minuteOfDay >= start &&
        context.minuteOfDay < end
      );
    }
    const previousDay = context.dayOfWeek === 1 ? 7 : context.dayOfWeek - 1;
    return (
      (availability.dayOfWeek === context.dayOfWeek &&
        startDateValid &&
        context.minuteOfDay >= start) ||
      (availability.dayOfWeek === previousDay && previousDateValid && context.minuteOfDay < end)
    );
  }

  private publicContext(now: Date, timezone: string): PublicMenuContext {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '0';
    const weekdays: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    const today = new Date(
      Date.UTC(Number(value('year')), Number(value('month')) - 1, Number(value('day'))),
    );
    return {
      now,
      today,
      dayOfWeek: weekdays[value('weekday')] ?? 1,
      minuteOfDay: Number(value('hour')) * 60 + Number(value('minute')),
    };
  }

  private async findPublicLocation(locationId: string): Promise<{ id: string; timezone: string }> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, active: true },
      select: { id: true, timezone: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');
    return location;
  }

  private async requireLocation(id: string): Promise<void> {
    const location = await this.prisma.location.findUnique({ where: { id }, select: { id: true } });
    if (!location) throw new NotFoundException('Sede no encontrada.');
  }

  private async requireCategory(id: string): Promise<{ id: string; locationId: string }> {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id },
      select: { id: true, locationId: true },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada.');
    return category;
  }

  private async requireItem(id: string): Promise<void> {
    const item = await this.prisma.menuItem.findUnique({ where: { id }, select: { id: true } });
    if (!item) throw new NotFoundException('Ítem de menú no encontrado.');
  }

  private async requireItemWithLocation(id: string): Promise<{
    id: string;
    menuItem: { category: { locationId: string } };
  }> {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      select: { id: true, category: { select: { locationId: true } } },
    });
    if (!item) throw new NotFoundException('Ítem de menú no encontrado.');
    return { id: item.id, menuItem: item };
  }

  private async requirePrepStation(id: string, locationId: string): Promise<void> {
    const station = await this.prisma.prepStation.findFirst({
      where: { id, locationId },
      select: { id: true },
    });
    if (!station)
      throw new BadRequestException('La estación de preparación no pertenece a la sede.');
  }

  private async requireVariantWithLocation(
    id: string,
  ): Promise<VariantLocationRecord & { menuItemId: string }> {
    const variant = await this.prisma.menuItemVariant.findUnique({
      where: { id },
      select: {
        id: true,
        menuItemId: true,
        menuItem: { select: { category: { select: { locationId: true } } } },
      },
    });
    if (!variant) throw new NotFoundException('Variante de menú no encontrada.');
    return variant;
  }

  private async getPriceRecord(id: string): Promise<{ validFrom: Date; validTo: Date | null }> {
    const price = await this.prisma.menuPrice.findUnique({
      where: { id },
      select: { validFrom: true, validTo: true },
    });
    if (!price) throw new NotFoundException('Precio no encontrado.');
    return price;
  }

  private async requireAvailability(id: string): Promise<AdminAvailabilityRecord> {
    const row = await this.prisma.menuAvailability.findUnique({
      where: { id },
      select: adminAvailabilitySelect,
    });
    if (!row) throw new NotFoundException('Ventana de disponibilidad no encontrada.');
    return row;
  }

  private async requireOutage(id: string): Promise<AdminOutageRecord> {
    const row = await this.prisma.menuItemOutage.findUnique({
      where: { id },
      select: adminOutageSelect,
    });
    if (!row) throw new NotFoundException('Agotado temporal no encontrado.');
    return row;
  }

  private async requireModifierGroup(id: string): Promise<AdminModifierGroupRecord> {
    const row = await this.prisma.modifierGroup.findUnique({
      where: { id },
      select: adminModifierGroupSelect,
    });
    if (!row) throw new NotFoundException('Grupo de modificadores no encontrado.');
    return row;
  }

  private async requireModifier(id: string): Promise<void> {
    const row = await this.prisma.modifier.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('Modificador no encontrado.');
  }

  private ensureSameLocation(requested: string, actual: string): void {
    if (requested !== actual) {
      throw new BadRequestException('El recurso no pertenece a la sede indicada.');
    }
  }

  private validateAvailability(
    startsAt: string,
    endsAt: string,
    crossesMidnight: boolean,
    validFrom?: string,
    validTo?: string,
  ): void {
    const starts = timeMinutes(timeOnly(startsAt));
    const ends = timeMinutes(timeOnly(endsAt));
    if (starts === ends || (!crossesMidnight && ends <= starts)) {
      throw new BadRequestException('La ventana horaria no es coherente.');
    }
    if (validFrom && validTo && dateOnly(validTo) < dateOnly(validFrom)) {
      throw new BadRequestException('La fecha final debe ser posterior o igual a la inicial.');
    }
  }

  private validateOutage(startsAt: Date, endsAt: Date | null): void {
    if (Number.isNaN(startsAt.getTime()) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      throw new BadRequestException('Las fechas del agotado temporal no son válidas.');
    }
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('La fecha final debe ser posterior a la inicial.');
    }
  }

  private validatePriceDates(validFrom: Date, validTo: Date | null): void {
    if (Number.isNaN(validFrom.getTime()) || (validTo && Number.isNaN(validTo.getTime()))) {
      throw new BadRequestException('Las fechas de vigencia del precio no son válidas.');
    }
    if (validTo && validTo <= validFrom) {
      throw new BadRequestException('La fecha final del precio debe ser posterior a la inicial.');
    }
  }

  private validateSelectionLimits(minimum: number, maximum: number): void {
    if (maximum < minimum) {
      throw new BadRequestException('selectionMax debe ser mayor o igual que selectionMin.');
    }
  }

  private dateWindowContains(validFrom: Date | null, validTo: Date | null, date: Date): boolean {
    const time = date.getTime();
    return (!validFrom || time >= validFrom.getTime()) && (!validTo || time <= validTo.getTime());
  }

  private toAdminCategory(row: AdminCategoryRecord): AdminCategoryResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      slug: row.slug,
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      descriptionEs: row.descriptionEs,
      descriptionEn: row.descriptionEn,
      displayOrder: row.displayOrder,
      active: row.active,
      itemCount: row._count.menuItems,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAdminItem(row: AdminItemRecord): AdminItemResponseDto {
    return {
      id: row.id,
      categoryId: row.categoryId,
      category: row.category,
      sku: row.sku,
      slug: row.slug,
      itemType: row.itemType.toLowerCase(),
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      descriptionEs: row.descriptionEs,
      descriptionEn: row.descriptionEn,
      publicVisible: row.publicVisible,
      active: row.active,
      variants: row.variants.map((variant) => this.toAdminVariant(variant)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAdminVariant(row: AdminVariantRecord): AdminVariantSummaryDto {
    return {
      id: row.id,
      prepStationId: row.prepStationId,
      sku: row.sku,
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      isDefault: row.isDefault,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAdminPrice(row: AdminPriceRecord): AdminPriceResponseDto {
    return {
      id: row.id,
      variantId: row.variantId,
      locationId: row.locationId,
      channel: row.channel.toLowerCase(),
      price: row.price.toString(),
      currency: row.currency,
      includesTax: row.includesTax,
      taxRateId: row.taxRateId,
      validFrom: dateString(row.validFrom),
      validTo: row.validTo ? dateString(row.validTo) : null,
      active: row.active,
    };
  }

  private toAdminAllergen(row: {
    id: string;
    code: string;
    nameEs: string;
    nameEn: string;
    active: boolean;
  }): AdminAllergenResponseDto {
    return {
      id: row.id,
      code: row.code,
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      active: row.active,
    };
  }

  private toAdminAvailability(row: AdminAvailabilityRecord): AdminAvailabilityResponseDto {
    return {
      id: row.id,
      variantId: row.variantId,
      locationId: row.locationId,
      channel: row.channel.toLowerCase(),
      dayOfWeek: row.dayOfWeek,
      startsAt: formatTime(row.startsAt),
      endsAt: formatTime(row.endsAt),
      crossesMidnight: row.crossesMidnight,
      validFrom: row.validFrom ? dateString(row.validFrom) : null,
      validTo: row.validTo ? dateString(row.validTo) : null,
      active: row.active,
    };
  }

  private toAdminOutage(row: AdminOutageRecord): AdminOutageResponseDto {
    return {
      id: row.id,
      variantId: row.variantId,
      locationId: row.locationId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      reason: row.reason,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toAdminModifier(row: AdminModifierRecord): AdminModifierResponseDto {
    return {
      id: row.id,
      modifierGroupId: row.modifierGroupId,
      code: row.code,
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      priceDelta: row.priceDelta.toString(),
      active: row.active,
    };
  }

  private toAdminModifierGroup(row: AdminModifierGroupRecord): AdminModifierGroupResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      code: row.code,
      nameEs: row.nameEs,
      nameEn: row.nameEn,
      selectionMin: row.selectionMin,
      selectionMax: row.selectionMax,
      required: row.required,
      active: row.active,
      modifiers: row.modifiers.map((modifier) => this.toAdminModifier(modifier)),
    };
  }

  private skip(query: { page: number; pageSize: number }): number {
    return (query.page - 1) * query.pageSize;
  }

  private pageMeta(query: { page: number; pageSize: number }, total: number): PageMetaDto {
    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    };
  }

  private async db<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.translateDatabaseError(error);
    }
  }

  private translateDatabaseError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('El recurso ya existe.');
      if (error.code === 'P2003')
        throw new BadRequestException('Una relación del catálogo no es válida.');
      if (error.code === 'P2025') throw new NotFoundException('El recurso no existe.');
    }
    throw error;
  }
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function timeOnly(value: string): Date {
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hours ?? 0, minutes ?? 0));
}

function formatTime(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

function timeMinutes(value: Date): number {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}
