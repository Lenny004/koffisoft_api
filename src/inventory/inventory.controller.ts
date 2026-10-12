import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { requestMetadata, type AuthenticatedRequest } from '../auth/auth.types.js';
import {
  CreateGoodsReceiptDto,
  CreateIngredientDto,
  CreateInventoryAdjustmentDto,
  CreateRecipeDto,
  CreateSupplierDto,
  GoodsReceiptListQueryDto,
  IngredientListQueryDto,
  InventoryLocationQueryDto,
  InventoryAlertQueryDto,
  InventoryMovementListQueryDto,
  RecipeListQueryDto,
  StorageLocationListQueryDto,
  SupplierListQueryDto,
  UpdateIngredientDto,
  UpdateRecipeDto,
  UpdateSupplierDto,
} from './dto/inventory.dto.js';
import {
  GoodsReceiptPageDto,
  GoodsReceiptResponseDto,
  IngredientCategoryResponseDto,
  IngredientPageDto,
  IngredientResponseDto,
  InventoryAlertsResponseDto,
  InventoryMovementPageDto,
  InventoryMovementResponseDto,
  RecipePageDto,
  RecipeResponseDto,
  StorageLocationResponseDto,
  SupplierPageDto,
  SupplierResponseDto,
  UnitResponseDto,
} from './dto/inventory-response.dto.js';
import { InventoryService } from './inventory.service.js';

/** Endpoints administrativos de inventario, compras, proveedores y recetas. */
@ApiTags('Inventario')
@Controller()
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('inventory/admin/catalog/units')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista unidades de inventario' })
  @ApiResponse({ status: 200, type: [UnitResponseDto] })
  listUnits(): Promise<UnitResponseDto[]> {
    return this.service.listUnits();
  }

  @Get('inventory/admin/catalog/categories')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista categorías de ingredientes' })
  @ApiResponse({ status: 200, type: [IngredientCategoryResponseDto] })
  listCategories(): Promise<IngredientCategoryResponseDto[]> {
    return this.service.listIngredientCategories();
  }

  @Get('inventory/admin/storage-locations')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista bodegas de una sede' })
  @ApiResponse({ status: 200, type: [StorageLocationResponseDto] })
  listStorageLocations(
    @Query() query: StorageLocationListQueryDto,
  ): Promise<StorageLocationResponseDto[]> {
    return this.service.listStorageLocations(query);
  }

  @Get('inventory/admin/items')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista ingredientes con saldo calculado por movimientos' })
  @ApiResponse({ status: 200, type: IngredientPageDto })
  listIngredients(@Query() query: IngredientListQueryDto): Promise<IngredientPageDto> {
    return this.service.listIngredients(query);
  }

  @Get('inventory/admin/items/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un ingrediente y su saldo actual' })
  @ApiResponse({ status: 200, type: IngredientResponseDto })
  getIngredient(
    @Param('id') id: string,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<IngredientResponseDto> {
    return this.service.getIngredient(id, query.locationId);
  }

  @Post('inventory/admin/items')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.manage')
  @ApiOperation({ summary: 'Crea un ingrediente sin alterar existencias' })
  @ApiResponse({ status: 201, type: IngredientResponseDto })
  createIngredient(
    @Body() dto: CreateIngredientDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<IngredientResponseDto> {
    return this.service.createIngredient(dto, this.actorId(request), requestMetadata(request));
  }

  @Patch('inventory/admin/items/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza datos de un ingrediente sin editar el stock' })
  @ApiResponse({ status: 200, type: IngredientResponseDto })
  updateIngredient(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @Req() request: AuthenticatedRequest,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<IngredientResponseDto> {
    return this.service.updateIngredient(
      id,
      dto,
      query.locationId,
      this.actorId(request),
      requestMetadata(request),
    );
  }

  @Delete('inventory/admin/items/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un ingrediente' })
  @ApiResponse({ status: 200, type: IngredientResponseDto })
  removeIngredient(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<IngredientResponseDto> {
    return this.service.removeIngredient(
      id,
      query.locationId,
      this.actorId(request),
      requestMetadata(request),
    );
  }

  @Get('suppliers/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista proveedores con filtros y paginación' })
  @ApiResponse({ status: 200, type: SupplierPageDto })
  listSuppliers(@Query() query: SupplierListQueryDto): Promise<SupplierPageDto> {
    return this.service.listSuppliers(query);
  }

  @Get('suppliers/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta el detalle de un proveedor' })
  @ApiResponse({ status: 200, type: SupplierResponseDto })
  getSupplier(@Param('id') id: string): Promise<SupplierResponseDto> {
    return this.service.getSupplier(id);
  }

  @Post('suppliers/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('suppliers.manage')
  @ApiOperation({ summary: 'Crea un proveedor' })
  @ApiResponse({ status: 201, type: SupplierResponseDto })
  createSupplier(
    @Body() dto: CreateSupplierDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupplierResponseDto> {
    return this.service.createSupplier(dto, this.actorId(request), requestMetadata(request));
  }

  @Patch('suppliers/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('suppliers.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un proveedor' })
  @ApiResponse({ status: 200, type: SupplierResponseDto })
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupplierResponseDto> {
    return this.service.updateSupplier(id, dto, this.actorId(request), requestMetadata(request));
  }

  @Delete('suppliers/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('suppliers.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un proveedor' })
  @ApiResponse({ status: 200, type: SupplierResponseDto })
  removeSupplier(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupplierResponseDto> {
    return this.service.removeSupplier(id, this.actorId(request), requestMetadata(request));
  }

  @Get('inventory/admin/receipts')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista recepciones con filtros y paginación' })
  @ApiResponse({ status: 200, type: GoodsReceiptPageDto })
  listReceipts(@Query() query: GoodsReceiptListQueryDto): Promise<GoodsReceiptPageDto> {
    return this.service.listReceipts(query);
  }

  @Get('inventory/admin/receipts/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una recepción con sus lotes y líneas' })
  @ApiResponse({ status: 200, type: GoodsReceiptResponseDto })
  getReceipt(@Param('id') id: string): Promise<GoodsReceiptResponseDto> {
    return this.service.getReceipt(id);
  }

  @Post('inventory/admin/receipts')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.receive')
  @ApiOperation({ summary: 'Registra una recepción y genera movimientos de entrada' })
  @ApiResponse({ status: 201, type: GoodsReceiptResponseDto })
  createReceipt(
    @Body() dto: CreateGoodsReceiptDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoodsReceiptResponseDto> {
    return this.service.createReceipt(dto, this.actorId(request), requestMetadata(request));
  }

  @Get('inventory/admin/movements')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Consulta el historial de movimientos con paginación' })
  @ApiResponse({ status: 200, type: InventoryMovementPageDto })
  listMovements(@Query() query: InventoryMovementListQueryDto): Promise<InventoryMovementPageDto> {
    return this.service.listMovements(query);
  }

  @Post('inventory/admin/movements/adjustments')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.adjust')
  @ApiOperation({ summary: 'Registra un ajuste o merma con motivo' })
  @ApiResponse({ status: 201, type: InventoryMovementResponseDto })
  createAdjustment(
    @Body() dto: CreateInventoryAdjustmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<InventoryMovementResponseDto> {
    return this.service.createAdjustment(dto, this.actorId(request), requestMetadata(request));
  }

  @Get('inventory/admin/alerts')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista alertas de stock bajo y vencimientos próximos' })
  @ApiResponse({ status: 200, type: InventoryAlertsResponseDto })
  listAlerts(@Query() query: InventoryAlertQueryDto): Promise<InventoryAlertsResponseDto> {
    return this.service.listAlerts(query);
  }

  @Get('inventory/admin/recipes')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista recetas por variante del menú' })
  @ApiResponse({ status: 200, type: RecipePageDto })
  listRecipes(@Query() query: RecipeListQueryDto): Promise<RecipePageDto> {
    return this.service.listRecipes(query);
  }

  @Get('inventory/admin/recipes/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una receta con sus ingredientes' })
  @ApiResponse({ status: 200, type: RecipeResponseDto })
  getRecipe(@Param('id') id: string): Promise<RecipeResponseDto> {
    return this.service.getRecipe(id);
  }

  @Post('inventory/admin/recipes')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('recipes.manage')
  @ApiOperation({ summary: 'Crea una receta versionada para una variante' })
  @ApiResponse({ status: 201, type: RecipeResponseDto })
  createRecipe(
    @Body() dto: CreateRecipeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RecipeResponseDto> {
    return this.service.createRecipe(dto, this.actorId(request), requestMetadata(request));
  }

  @Patch('inventory/admin/recipes/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('recipes.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Archiva o anota una receta existente' })
  @ApiResponse({ status: 200, type: RecipeResponseDto })
  updateRecipe(
    @Param('id') id: string,
    @Body() dto: UpdateRecipeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RecipeResponseDto> {
    return this.service.updateRecipe(id, dto, this.actorId(request), requestMetadata(request));
  }

  @Delete('inventory/admin/recipes/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('recipes.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva una receta sin borrar su historial' })
  @ApiResponse({ status: 200, type: RecipeResponseDto })
  removeRecipe(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<RecipeResponseDto> {
    return this.service.updateRecipe(
      id,
      { active: false },
      this.actorId(request),
      requestMetadata(request),
    );
  }

  private actorId(request: AuthenticatedRequest): string {
    if (!request.auth?.userId) {
      throw new Error('La ruta administrativa requiere una sesión autenticada.');
    }
    return request.auth.userId;
  }
}
