import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { AccessScopeService } from '../auth/security/access-scope.service.js';
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
  constructor(
    private readonly service: InventoryService,
    private readonly scope: AccessScopeService,
  ) {}

  @Get('inventory/admin/catalog/units')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista unidades de inventario' })
  @ApiResponse({ status: 200, type: [UnitResponseDto] })
/**
 * Expone el catálogo global de unidades de inventario.
 */
  listUnits(): Promise<UnitResponseDto[]> {
    return this.service.listUnits();
  }

  @Get('inventory/admin/catalog/categories')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista categorías de ingredientes' })
  @ApiResponse({ status: 200, type: [IngredientCategoryResponseDto] })
/**
 * Expone categorías de ingredientes para formularios administrativos.
 */
  listCategories(): Promise<IngredientCategoryResponseDto[]> {
    return this.service.listIngredientCategories();
  }

  @Get('inventory/admin/storage-locations')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista bodegas de una sede' })
  @ApiResponse({ status: 200, type: [StorageLocationResponseDto] })
/**
 * Lista bodegas verificando acceso del usuario a la sede.
 */
  listStorageLocations(
    @Query() query: StorageLocationListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<StorageLocationResponseDto[]> {
    return this.withLocation(request, query.locationId, () =>
      this.service.listStorageLocations(query),
    );
  }

  @Get('inventory/admin/items')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista ingredientes con saldo calculado por movimientos' })
  @ApiResponse({ status: 200, type: IngredientPageDto })
/**
 * Lista ingredientes con saldo; exige alcance sobre locationId.
 */
  listIngredients(
    @Query() query: IngredientListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<IngredientPageDto> {
    return this.withLocation(request, query.locationId, () => this.service.listIngredients(query));
  }

  @Get('inventory/admin/items/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta un ingrediente y su saldo actual' })
  @ApiResponse({ status: 200, type: IngredientResponseDto })
/**
 * Consulta un ingrediente y su saldo en la sede autorizada.
 */
  getIngredient(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InventoryLocationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<IngredientResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.getIngredient(id, query.locationId),
    );
  }

  @Post('inventory/admin/items')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.manage')
  @ApiOperation({ summary: 'Crea un ingrediente sin alterar existencias' })
  @ApiResponse({ status: 201, type: IngredientResponseDto })
/**
 * Crea un ingrediente sin modificar existencias.
 */
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
/**
 * Actualiza metadatos de ingrediente en la sede del query.
 */
  updateIngredient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIngredientDto,
    @Req() request: AuthenticatedRequest,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<IngredientResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.updateIngredient(
        id,
        dto,
        query.locationId,
        this.actorId(request),
        requestMetadata(request),
      ),
    );
  }

  @Delete('inventory/admin/items/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un ingrediente' })
  @ApiResponse({ status: 200, type: IngredientResponseDto })
/**
 * Desactiva un ingrediente en la sede autorizada.
 */
  removeIngredient(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<IngredientResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.removeIngredient(
        id,
        query.locationId,
        this.actorId(request),
        requestMetadata(request),
      ),
    );
  }

  @Get('suppliers/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista proveedores con filtros y paginación' })
  @ApiResponse({ status: 200, type: SupplierPageDto })
/**
 * Lista proveedores paginados con alcance de sede.
 */
  listSuppliers(
    @Query() query: SupplierListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupplierPageDto> {
    return this.withLocation(request, query.locationId, () => this.service.listSuppliers(query));
  }

  @Get('suppliers/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta el detalle de un proveedor' })
  @ApiResponse({ status: 200, type: SupplierResponseDto })
/**
 * Detalle de proveedor acotado a la sede del usuario.
 */
  getSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InventoryLocationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupplierResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.getSupplier(id, query.locationId),
    );
  }

  @Post('suppliers/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('suppliers.manage')
  @ApiOperation({ summary: 'Crea un proveedor' })
  @ApiResponse({ status: 201, type: SupplierResponseDto })
/**
 * Crea proveedor validando acceso a la sede del cuerpo.
 */
  createSupplier(
    @Body() dto: CreateSupplierDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupplierResponseDto> {
    return this.withLocation(request, dto.locationId, () =>
      this.service.createSupplier(dto, this.actorId(request), requestMetadata(request)),
    );
  }

  @Patch('suppliers/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('suppliers.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Actualiza un proveedor' })
  @ApiResponse({ status: 200, type: SupplierResponseDto })
/**
 * Actualiza proveedor en la sede indicada por query.
 */
  updateSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @Req() request: AuthenticatedRequest,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<SupplierResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.updateSupplier(
        id,
        query.locationId,
        dto,
        this.actorId(request),
        requestMetadata(request),
      ),
    );
  }

  @Delete('suppliers/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('suppliers.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un proveedor' })
  @ApiResponse({ status: 200, type: SupplierResponseDto })
/**
 * Desactiva proveedor tras validar alcance de sede.
 */
  removeSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<SupplierResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.removeSupplier(
        id,
        query.locationId,
        this.actorId(request),
        requestMetadata(request),
      ),
    );
  }

  @Get('inventory/admin/receipts')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista recepciones con filtros y paginación' })
  @ApiResponse({ status: 200, type: GoodsReceiptPageDto })
/**
 * Lista recepciones con filtros en la sede autorizada.
 */
  listReceipts(
    @Query() query: GoodsReceiptListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoodsReceiptPageDto> {
    return this.withLocation(request, query.locationId, () => this.service.listReceipts(query));
  }

  @Get('inventory/admin/receipts/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una recepción con sus lotes y líneas' })
  @ApiResponse({ status: 200, type: GoodsReceiptResponseDto })
/**
 * Detalle de recepción con lotes en sede autorizada.
 */
  getReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InventoryLocationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoodsReceiptResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.getReceipt(id, query.locationId),
    );
  }

  @Post('inventory/admin/receipts')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.receive')
  @ApiOperation({ summary: 'Registra una recepción y genera movimientos de entrada' })
  @ApiResponse({ status: 201, type: GoodsReceiptResponseDto })
/**
 * Registra recepción y movimientos; requiere permiso inventory.receive.
 */
  createReceipt(
    @Body() dto: CreateGoodsReceiptDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoodsReceiptResponseDto> {
    return this.withLocation(request, dto.locationId, () =>
      this.service.createReceipt(dto, this.actorId(request), requestMetadata(request)),
    );
  }

  @Get('inventory/admin/movements')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Consulta el historial de movimientos con paginación' })
  @ApiResponse({ status: 200, type: InventoryMovementPageDto })
/**
 * Historial paginado de movimientos en la sede.
 */
  listMovements(
    @Query() query: InventoryMovementListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<InventoryMovementPageDto> {
    return this.withLocation(request, query.locationId, () => this.service.listMovements(query));
  }

  @Post('inventory/admin/movements/adjustments')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.adjust')
  @ApiOperation({ summary: 'Registra un ajuste o merma con motivo' })
  @ApiResponse({ status: 201, type: InventoryMovementResponseDto })
/**
 * Registra ajuste o merma con motivo en bodega autorizada.
 */
  createAdjustment(
    @Body() dto: CreateInventoryAdjustmentDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<InventoryMovementResponseDto> {
    return this.withLocation(request, dto.locationId, () =>
      this.service.createAdjustment(dto, this.actorId(request), requestMetadata(request)),
    );
  }

  @Get('inventory/admin/alerts')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista alertas de stock bajo y vencimientos próximos' })
  @ApiResponse({ status: 200, type: InventoryAlertsResponseDto })
/**
 * Alertas de stock bajo y vencimientos para la sede.
 */
  listAlerts(
    @Query() query: InventoryAlertQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<InventoryAlertsResponseDto> {
    return this.withLocation(request, query.locationId, () => this.service.listAlerts(query));
  }

  @Get('inventory/admin/recipes')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lista recetas por variante del menú' })
  @ApiResponse({ status: 200, type: RecipePageDto })
/**
 * Lista recetas de la sede con paginación.
 */
  listRecipes(
    @Query() query: RecipeListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RecipePageDto> {
    return this.withLocation(request, query.locationId, () => this.service.listRecipes(query));
  }

  @Get('inventory/admin/recipes/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('inventory.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta una receta con sus ingredientes' })
  @ApiResponse({ status: 200, type: RecipeResponseDto })
/**
 * Detalle de receta validando sede del query.
 */
  getRecipe(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: InventoryLocationQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RecipeResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.getRecipe(id, query.locationId),
    );
  }

  @Post('inventory/admin/recipes')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('recipes.manage')
  @ApiOperation({ summary: 'Crea una receta versionada para una variante' })
  @ApiResponse({ status: 201, type: RecipeResponseDto })
/**
 * Crea receta versionada en la sede del DTO.
 */
  createRecipe(
    @Body() dto: CreateRecipeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RecipeResponseDto> {
    return this.withLocation(request, dto.locationId, () =>
      this.service.createRecipe(dto, this.actorId(request), requestMetadata(request)),
    );
  }

  @Patch('inventory/admin/recipes/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('recipes.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Archiva o anota una receta existente' })
  @ApiResponse({ status: 200, type: RecipeResponseDto })
/**
 * Actualiza notas o vigencia de receta en sede autorizada.
 */
  updateRecipe(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecipeDto,
    @Req() request: AuthenticatedRequest,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<RecipeResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.updateRecipe(
        id,
        query.locationId,
        dto,
        this.actorId(request),
        requestMetadata(request),
      ),
    );
  }

  @Delete('inventory/admin/recipes/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('recipes.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva una receta sin borrar su historial' })
  @ApiResponse({ status: 200, type: RecipeResponseDto })
/**
 * Desactiva receta delegando en actualización con active false.
 */
  removeRecipe(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: InventoryLocationQueryDto,
  ): Promise<RecipeResponseDto> {
    return this.withLocation(request, query.locationId, () =>
      this.service.updateRecipe(
        id,
        query.locationId,
        { active: false },
        this.actorId(request),
        requestMetadata(request),
      ),
    );
  }

/**
 * Obtiene el id de usuario autenticado o falla en rutas administrativas.
 */
  private actorId(request: AuthenticatedRequest): string {
    if (!request.auth?.userId) {
      throw new Error('La ruta administrativa requiere una sesión autenticada.');
    }
    return request.auth.userId;
  }

/**
 * Ejecuta una operación tras comprobar acceso del actor a la sede.
 */
  private async withLocation<T>(
    request: AuthenticatedRequest,
    locationId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    await this.scope.assertLocationAccess(this.actorId(request), locationId);
    return operation();
  }
}
