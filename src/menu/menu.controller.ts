import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  CreateMenuCategoryDto,
  MenuCategoryListQueryDto,
  ReorderMenuCategoriesDto,
  UpdateMenuCategoryDto,
} from './dto/category.dto.js';
import { ReplaceMenuAllergensDto, AllergenListQueryDto } from './dto/allergen.dto.js';
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
import { LocationQueryDto, PublicMenuQueryDto } from './dto/menu-query.dto.js';
import {
  CreateMenuItemVariantDto,
  MenuVariantListQueryDto,
  UpdateMenuItemVariantDto,
} from './dto/variant.dto.js';
import {
  AdminCategoryPageDto,
  AdminCategoryResponseDto,
  AdminAllergenPageDto,
  AdminAvailabilityPageDto,
  AdminAvailabilityResponseDto,
  AdminItemPageDto,
  AdminItemResponseDto,
  AdminMenuAllergenResponseDto,
  AdminModifierGroupPageDto,
  AdminModifierGroupResponseDto,
  AdminModifierResponseDto,
  AdminOutagePageDto,
  AdminOutageResponseDto,
  AdminPricePageDto,
  AdminPriceResponseDto,
  AdminVariantPageDto,
  AdminVariantSummaryDto,
  PublicMenuDetailResponseDto,
  PublicMenuResponseDto,
} from './dto/menu-response.dto.js';
import { MenuService } from './menu.service.js';

/** Expone la carta pública y las operaciones autorizadas de catálogo. */
@ApiTags('Menú')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Devuelve la carta web agrupada por categoría' })
  @ApiResponse({ status: 200, type: PublicMenuResponseDto })
  async publicMenu(@Query() query: PublicMenuQueryDto): Promise<PublicMenuResponseDto> {
    return this.menuService.getPublicMenu(query);
  }

  @Get('items/:slug')
  @Public()
  @ApiParam({ name: 'slug', example: 'latte' })
  @ApiOperation({ summary: 'Devuelve el detalle público de un ítem por slug' })
  @ApiResponse({ status: 200, type: PublicMenuDetailResponseDto })
  async publicItem(
    @Param('slug') slug: string,
    @Query() query: PublicMenuQueryDto,
  ): Promise<PublicMenuDetailResponseDto> {
    return this.menuService.getPublicItem(slug, query);
  }

  @Get('admin/categories')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Lista categorías con paginación y búsqueda' })
  @ApiResponse({ status: 200, type: AdminCategoryPageDto })
  async listCategories(@Query() query: MenuCategoryListQueryDto): Promise<AdminCategoryPageDto> {
    return this.menuService.listCategories(query);
  }

  @Get('admin/categories/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una categoría administrativa' })
  @ApiResponse({ status: 200, type: AdminCategoryResponseDto })
  async getCategory(
    @Param('id') id: string,
    @Query() query: LocationQueryDto,
  ): Promise<AdminCategoryResponseDto> {
    return this.menuService.getCategory(id, query.locationId);
  }

  @Post('admin/categories')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiOperation({ summary: 'Crea una categoría' })
  @ApiResponse({ status: 201, type: AdminCategoryResponseDto })
  async createCategory(@Body() dto: CreateMenuCategoryDto): Promise<AdminCategoryResponseDto> {
    return this.menuService.createCategory(dto);
  }

  @Patch('admin/categories/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza una categoría o su estado active' })
  @ApiResponse({ status: 200, type: AdminCategoryResponseDto })
  async updateCategory(
    @Param('id') id: string,
    @Query() query: LocationQueryDto,
    @Body() dto: UpdateMenuCategoryDto,
  ): Promise<AdminCategoryResponseDto> {
    return this.menuService.updateCategory(id, query.locationId, dto);
  }

  @Delete('admin/categories/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente una categoría' })
  @ApiResponse({ status: 200, type: AdminCategoryResponseDto })
  async deleteCategory(
    @Param('id') id: string,
    @Query() query: LocationQueryDto,
  ): Promise<AdminCategoryResponseDto> {
    return this.menuService.deleteCategory(id, query.locationId);
  }

  @Post('admin/categories/reorder')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiOperation({ summary: 'Reordena categorías de una sede en una transacción' })
  @ApiResponse({ status: 200, type: [AdminCategoryResponseDto] })
  async reorderCategories(
    @Query() query: LocationQueryDto,
    @Body() dto: ReorderMenuCategoriesDto,
  ): Promise<AdminCategoryResponseDto[]> {
    return this.menuService.reorderCategories(query.locationId, dto);
  }

  @Get('admin/items')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Lista ítems con paginación y búsqueda' })
  @ApiResponse({ status: 200, type: AdminItemPageDto })
  async listItems(@Query() query: MenuItemListQueryDto): Promise<AdminItemPageDto> {
    return this.menuService.listItems(query);
  }

  @Get('admin/items/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un ítem y sus variantes' })
  @ApiResponse({ status: 200, type: AdminItemResponseDto })
  async getItem(@Param('id') id: string): Promise<AdminItemResponseDto> {
    return this.menuService.getItem(id);
  }

  @Post('admin/items')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiOperation({ summary: 'Crea un ítem de menú' })
  @ApiResponse({ status: 201, type: AdminItemResponseDto })
  async createItem(@Body() dto: CreateMenuItemDto): Promise<AdminItemResponseDto> {
    return this.menuService.createItem(dto);
  }

  @Patch('admin/items/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un ítem o su estado active/publicVisible' })
  @ApiResponse({ status: 200, type: AdminItemResponseDto })
  async updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<AdminItemResponseDto> {
    return this.menuService.updateItem(id, dto);
  }

  @Delete('admin/items/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un ítem' })
  @ApiResponse({ status: 200, type: AdminItemResponseDto })
  async deleteItem(@Param('id') id: string): Promise<AdminItemResponseDto> {
    return this.menuService.deleteItem(id);
  }

  @Get('admin/items/:itemId/variants')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOperation({ summary: 'Lista variantes de un ítem' })
  @ApiResponse({ status: 200, type: AdminVariantPageDto })
  async listVariants(
    @Param('itemId') itemId: string,
    @Query() query: MenuVariantListQueryDto,
  ): Promise<AdminVariantPageDto> {
    return this.menuService.listVariants(itemId, query);
  }

  @Post('admin/items/:itemId/variants')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOperation({ summary: 'Crea una variante vendible' })
  @ApiResponse({ status: 201, type: AdminVariantSummaryDto })
  async createVariant(
    @Param('itemId') itemId: string,
    @Body() dto: CreateMenuItemVariantDto,
  ): Promise<AdminVariantSummaryDto> {
    return this.menuService.createVariant(itemId, dto);
  }

  @Get('admin/variants/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una variante' })
  @ApiResponse({ status: 200, type: AdminVariantSummaryDto })
  async getVariant(@Param('id') id: string): Promise<AdminVariantSummaryDto> {
    return this.menuService.getVariant(id);
  }

  @Patch('admin/variants/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza o desactiva una variante' })
  @ApiResponse({ status: 200, type: AdminVariantSummaryDto })
  async updateVariant(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemVariantDto,
  ): Promise<AdminVariantSummaryDto> {
    return this.menuService.updateVariant(id, dto);
  }

  @Delete('admin/variants/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente una variante' })
  @ApiResponse({ status: 200, type: AdminVariantSummaryDto })
  async deleteVariant(@Param('id') id: string): Promise<AdminVariantSummaryDto> {
    return this.menuService.deleteVariant(id);
  }

  @Get('admin/variants/:variantId/prices')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Lista el historial de precios de una variante' })
  @ApiResponse({ status: 200, type: AdminPricePageDto })
  async listPrices(
    @Param('variantId') variantId: string,
    @Query() query: MenuPriceListQueryDto,
  ): Promise<AdminPricePageDto> {
    return this.menuService.listPrices(variantId, query);
  }

  @Post('admin/variants/:variantId/prices')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_prices.manage')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Agrega una vigencia de precio' })
  @ApiResponse({ status: 201, type: AdminPriceResponseDto })
  async createPrice(
    @Param('variantId') variantId: string,
    @Body() dto: CreateMenuPriceDto,
  ): Promise<AdminPriceResponseDto> {
    return this.menuService.createPrice(variantId, dto);
  }

  @Get('admin/prices/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un precio histórico' })
  @ApiResponse({ status: 200, type: AdminPriceResponseDto })
  async getPrice(@Param('id') id: string): Promise<AdminPriceResponseDto> {
    return this.menuService.getPrice(id);
  }

  @Patch('admin/prices/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_prices.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Corrige una vigencia de precio' })
  @ApiResponse({ status: 200, type: AdminPriceResponseDto })
  async updatePrice(
    @Param('id') id: string,
    @Body() dto: UpdateMenuPriceDto,
  ): Promise<AdminPriceResponseDto> {
    return this.menuService.updatePrice(id, dto);
  }

  @Delete('admin/prices/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_prices.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva un precio histórico' })
  @ApiResponse({ status: 200, type: AdminPriceResponseDto })
  async deletePrice(@Param('id') id: string): Promise<AdminPriceResponseDto> {
    return this.menuService.deletePrice(id);
  }

  @Get('admin/allergens')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Lista el catálogo global de alérgenos' })
  @ApiResponse({ status: 200, type: AdminAllergenPageDto })
  async listAllergens(@Query() query: AllergenListQueryDto): Promise<AdminAllergenPageDto> {
    return this.menuService.listAllergens(query);
  }

  @Get('admin/variants/:variantId/allergens')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Lista alérgenos declarados para una variante' })
  @ApiResponse({ status: 200, type: [AdminMenuAllergenResponseDto] })
  async listVariantAllergens(@Param('variantId') variantId: string) {
    return this.menuService.listVariantAllergens(variantId);
  }

  @Put('admin/variants/:variantId/allergens')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.manage')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Reemplaza alérgenos de una variante' })
  @ApiResponse({ status: 200, type: [AdminMenuAllergenResponseDto] })
  async replaceVariantAllergens(
    @Param('variantId') variantId: string,
    @Body() dto: ReplaceMenuAllergensDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminMenuAllergenResponseDto[]> {
    return this.menuService.replaceVariantAllergens(variantId, dto, this.requiredUserId(request));
  }

  @Get('admin/variants/:variantId/availability')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Lista ventanas de disponibilidad' })
  @ApiResponse({ status: 200, type: AdminAvailabilityPageDto })
  async listAvailability(
    @Param('variantId') variantId: string,
    @Query() query: MenuAvailabilityListQueryDto,
  ): Promise<AdminAvailabilityPageDto> {
    return this.menuService.listAvailability(variantId, query);
  }

  @Post('admin/variants/:variantId/availability')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_availability.manage')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Crea una ventana de disponibilidad' })
  @ApiResponse({ status: 201, type: AdminAvailabilityResponseDto })
  async createAvailability(
    @Param('variantId') variantId: string,
    @Body() dto: CreateMenuAvailabilityDto,
  ): Promise<AdminAvailabilityResponseDto> {
    return this.menuService.createAvailability(variantId, dto);
  }

  @Get('admin/availability/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una ventana de disponibilidad' })
  @ApiResponse({ status: 200, type: AdminAvailabilityResponseDto })
  async getAvailability(@Param('id') id: string): Promise<AdminAvailabilityResponseDto> {
    return this.menuService.getAvailability(id);
  }

  @Patch('admin/availability/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_availability.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza o desactiva una ventana de disponibilidad' })
  @ApiResponse({ status: 200, type: AdminAvailabilityResponseDto })
  async updateAvailability(
    @Param('id') id: string,
    @Body() dto: UpdateMenuAvailabilityDto,
  ): Promise<AdminAvailabilityResponseDto> {
    return this.menuService.updateAvailability(id, dto);
  }

  @Delete('admin/availability/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_availability.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva una ventana de disponibilidad' })
  @ApiResponse({ status: 200, type: AdminAvailabilityResponseDto })
  async deleteAvailability(@Param('id') id: string): Promise<AdminAvailabilityResponseDto> {
    return this.menuService.deleteAvailability(id);
  }

  @Get('admin/variants/:variantId/outages')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Lista agotados temporales' })
  @ApiResponse({ status: 200, type: AdminOutagePageDto })
  async listOutages(
    @Param('variantId') variantId: string,
    @Query() query: MenuOutageListQueryDto,
  ): Promise<AdminOutagePageDto> {
    return this.menuService.listOutages(variantId, query);
  }

  @Post('admin/variants/:variantId/outages')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_availability.manage')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Registra un agotado temporal' })
  @ApiResponse({ status: 201, type: AdminOutageResponseDto })
  async createOutage(
    @Param('variantId') variantId: string,
    @Body() dto: CreateMenuItemOutageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdminOutageResponseDto> {
    return this.menuService.createOutage(variantId, dto, this.requiredUserId(request));
  }

  @Get('admin/outages/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un agotado temporal' })
  @ApiResponse({ status: 200, type: AdminOutageResponseDto })
  async getOutage(@Param('id') id: string): Promise<AdminOutageResponseDto> {
    return this.menuService.getOutage(id);
  }

  @Patch('admin/outages/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_availability.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza o desactiva un agotado temporal' })
  @ApiResponse({ status: 200, type: AdminOutageResponseDto })
  async updateOutage(
    @Param('id') id: string,
    @Body() dto: UpdateMenuItemOutageDto,
  ): Promise<AdminOutageResponseDto> {
    return this.menuService.updateOutage(id, dto);
  }

  @Delete('admin/outages/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('menu_availability.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva un agotado temporal' })
  @ApiResponse({ status: 200, type: AdminOutageResponseDto })
  async deleteOutage(@Param('id') id: string): Promise<AdminOutageResponseDto> {
    return this.menuService.deleteOutage(id);
  }

  @Get('admin/modifier-groups')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiOperation({ summary: 'Lista grupos de modificadores' })
  @ApiResponse({ status: 200, type: AdminModifierGroupPageDto })
  async listModifierGroups(
    @Query() query: ModifierGroupListQueryDto,
  ): Promise<AdminModifierGroupPageDto> {
    return this.menuService.listModifierGroups(query);
  }

  @Get('admin/modifier-groups/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un grupo de modificadores' })
  @ApiResponse({ status: 200, type: AdminModifierGroupResponseDto })
  async getModifierGroup(@Param('id') id: string): Promise<AdminModifierGroupResponseDto> {
    return this.menuService.getModifierGroup(id);
  }

  @Post('admin/modifier-groups')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('modifiers.manage')
  @ApiOperation({ summary: 'Crea un grupo de modificadores' })
  @ApiResponse({ status: 201, type: AdminModifierGroupResponseDto })
  async createModifierGroup(
    @Body() dto: CreateModifierGroupDto,
  ): Promise<AdminModifierGroupResponseDto> {
    return this.menuService.createModifierGroup(dto);
  }

  @Patch('admin/modifier-groups/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('modifiers.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza o desactiva un grupo de modificadores' })
  @ApiResponse({ status: 200, type: AdminModifierGroupResponseDto })
  async updateModifierGroup(
    @Param('id') id: string,
    @Body() dto: UpdateModifierGroupDto,
  ): Promise<AdminModifierGroupResponseDto> {
    return this.menuService.updateModifierGroup(id, dto);
  }

  @Delete('admin/modifier-groups/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('modifiers.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva un grupo de modificadores' })
  @ApiResponse({ status: 200, type: AdminModifierGroupResponseDto })
  async deleteModifierGroup(@Param('id') id: string): Promise<AdminModifierGroupResponseDto> {
    return this.menuService.deleteModifierGroup(id);
  }

  @Post('admin/modifier-groups/:groupId/modifiers')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('modifiers.manage')
  @ApiParam({ name: 'groupId', format: 'uuid' })
  @ApiOperation({ summary: 'Agrega un modificador a un grupo' })
  @ApiResponse({ status: 201, type: AdminModifierResponseDto })
  async createModifier(
    @Param('groupId') groupId: string,
    @Body() dto: CreateModifierDto,
  ): Promise<AdminModifierResponseDto> {
    return this.menuService.createModifier(groupId, dto);
  }

  @Get('admin/modifiers/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('catalog.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un modificador' })
  @ApiResponse({ status: 200, type: AdminModifierResponseDto })
  async getModifier(@Param('id') id: string): Promise<AdminModifierResponseDto> {
    return this.menuService.getModifier(id);
  }

  @Patch('admin/modifiers/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('modifiers.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza o desactiva un modificador' })
  @ApiResponse({ status: 200, type: AdminModifierResponseDto })
  async updateModifier(
    @Param('id') id: string,
    @Body() dto: UpdateModifierDto,
  ): Promise<AdminModifierResponseDto> {
    return this.menuService.updateModifier(id, dto);
  }

  @Delete('admin/modifiers/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('modifiers.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva un modificador' })
  @ApiResponse({ status: 200, type: AdminModifierResponseDto })
  async deleteModifier(@Param('id') id: string): Promise<AdminModifierResponseDto> {
    return this.menuService.deleteModifier(id);
  }

  @Put('admin/variants/:variantId/modifier-groups')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('modifiers.manage')
  @ApiParam({ name: 'variantId', format: 'uuid' })
  @ApiOperation({ summary: 'Reemplaza y reordena grupos permitidos para una variante' })
  @ApiResponse({ status: 200, type: [AdminModifierGroupResponseDto] })
  async replaceVariantModifierGroups(
    @Param('variantId') variantId: string,
    @Body() dto: ReplaceModifierGroupsDto,
  ): Promise<AdminModifierGroupResponseDto[]> {
    return this.menuService.replaceVariantModifierGroups(variantId, dto);
  }

  private requiredUserId(request: AuthenticatedRequest): string {
    if (!request.auth) throw new UnauthorizedException('Autenticación requerida.');
    return request.auth.userId;
  }
}
