import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  ReplacePurchaseOrderLinesDto,
  PurchaseOrderListQueryDto,
  ReceivePurchaseOrderDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  SupplierListQueryDto,
} from './dto/purchase-order.dto.js';
import {
  PurchaseOrderResponseDto,
  PurchaseOrderPageDto,
  SupplierResponseDto,
  SupplierPageDto,
  SupplierOrderHistoryDto,
} from './dto/purchase-order-response.dto.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';

@Controller('purchase-orders')
@ApiTags('Purchase Orders')
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('purchase_orders.read')
  @ApiOperation({ summary: 'Listar órdenes de compra' })
  @ApiOkResponse({ type: PurchaseOrderPageDto })
/**
 * Lista órdenes de compra según filtros de query.
 */
  async listOrders(@Query() query: PurchaseOrderListQueryDto): Promise<PurchaseOrderPageDto> {
    return this.service.listOrders(query);
  }

  @Get(':id')
  @RequirePermissions('purchase_orders.read')
  @ApiOperation({ summary: 'Obtener una orden de compra' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
/**
 * Consulta detalle de una orden por id.
 */
  async getOrder(@Param('id') id: string): Promise<PurchaseOrderResponseDto> {
    return this.service.getOrder(id);
  }

  @Post()
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Crear orden de compra (estado Draft)' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
/**
 * Crea orden en borrador con actor y metadatos de petición.
 */
  async createOrder(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrderResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.createOrder(dto, actorUserId, metadata);
  }

  @Put(':id/lines')
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Reemplazar líneas de una orden en Draft y recalcular el total' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
/**
 * Reemplaza líneas de una orden en estado Draft.
 */
  async replaceDraftLines(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReplacePurchaseOrderLinesDto,
  ): Promise<PurchaseOrderResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.replaceDraftLines(id, dto.lines, actorUserId, metadata);
  }

  @Patch(':id')
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({
    summary: 'Actualizar orden de compra (notas en Draft/Submitted; líneas solo Draft)',
  })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
/**
 * Actualiza cabecera o líneas según reglas del servicio.
 */
  async updateOrder(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdatePurchaseOrderDto,
  ): Promise<PurchaseOrderResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.updateOrder(id, dto, actorUserId, metadata);
  }

  @Post(':id/submit')
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Enviar orden para aprobación (Draft → Submitted)' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
/**
 * Envía orden Draft a revisión (Submitted).
 */
  async submitOrder(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseOrderResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.submitOrder(id, actorUserId, metadata);
  }

  @Post(':id/approve')
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Aprobar orden (Submitted → Approved)' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
/**
 * Aprueba orden en estado Submitted.
 */
  async approveOrder(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseOrderResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.approveOrder(id, actorUserId, metadata);
  }

  @Post(':id/cancel')
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Cancelar orden (cualquier estado → Cancelled)' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
/**
 * Cancela orden si aún no fue recibida.
 */
  async cancelOrder(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<PurchaseOrderResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.cancelOrder(id, actorUserId, metadata);
  }

  @Post(':id/receive')
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({
    summary: 'Recibir orden (Approved → Received), genera movimientos de inventario',
  })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
/**
 * Recibe mercancía de orden Approved y genera inventario.
 */
  async receiveOrder(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReceivePurchaseOrderDto,
  ): Promise<PurchaseOrderResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.receiveOrder(id, dto, actorUserId, metadata);
  }
}

@Controller('suppliers')
@ApiTags('Suppliers')
export class SuppliersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('purchase_orders.read')
  @ApiOperation({ summary: 'Listar proveedores' })
  @ApiOkResponse({ type: SupplierPageDto })
/**
 * Lista proveedores del flujo de compras.
 */
  async listSuppliers(@Query() query: SupplierListQueryDto): Promise<SupplierPageDto> {
    return this.service.listSuppliers(query);
  }

  @Get(':id')
  @RequirePermissions('purchase_orders.read')
  @ApiOperation({ summary: 'Obtener un proveedor' })
  @ApiOkResponse({ type: SupplierResponseDto })
/**
 * Consulta un proveedor por id.
 */
  async getSupplier(@Param('id') id: string): Promise<SupplierResponseDto> {
    return this.service.getSupplier(id);
  }

  @Get(':id/orders')
  @RequirePermissions('purchase_orders.read')
  @ApiOperation({ summary: 'Historial de órdenes recibidas del proveedor' })
  @ApiOkResponse({ type: SupplierOrderHistoryDto })
/**
 * Historial de órdenes recibidas del proveedor.
 */
  async getSupplierOrderHistory(@Param('id') id: string): Promise<SupplierOrderHistoryDto> {
    return this.service.getSupplierOrderHistory(id);
  }

  @Post()
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Crear proveedor' })
  @ApiOkResponse({ type: SupplierResponseDto })
/**
 * Alta de proveedor con permiso purchase_orders.manage.
 */
  async createSupplier(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.createSupplier(dto, actorUserId, metadata);
  }

  @Patch(':id')
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Actualizar proveedor' })
  @ApiOkResponse({ type: SupplierResponseDto })
/**
 * Actualiza proveedor del módulo de compras.
 */
  async updateSupplier(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    const actorUserId = req.auth!.userId;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.id,
    };
    return this.service.updateSupplier(id, dto, actorUserId, metadata);
  }
}
