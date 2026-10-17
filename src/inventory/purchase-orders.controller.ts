import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
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
  async listOrders(@Query() query: PurchaseOrderListQueryDto): Promise<PurchaseOrderPageDto> {
    return this.service.listOrders(query);
  }

  @Get(':id')
  @RequirePermissions('purchase_orders.read')
  @ApiOperation({ summary: 'Obtener una orden de compra' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
  async getOrder(@Param('id') id: string): Promise<PurchaseOrderResponseDto> {
    return this.service.getOrder(id);
  }

  @Post()
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Crear orden de compra (estado Draft)' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
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

  @Patch(':id')
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Actualizar orden de compra (solo Draft/Submitted)' })
  @ApiOkResponse({ type: PurchaseOrderResponseDto })
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
  async listSuppliers(@Query() query: SupplierListQueryDto): Promise<SupplierPageDto> {
    return this.service.listSuppliers(query);
  }

  @Get(':id')
  @RequirePermissions('purchase_orders.read')
  @ApiOperation({ summary: 'Obtener un proveedor' })
  @ApiOkResponse({ type: SupplierResponseDto })
  async getSupplier(@Param('id') id: string): Promise<SupplierResponseDto> {
    return this.service.getSupplier(id);
  }

  @Get(':id/orders')
  @RequirePermissions('purchase_orders.read')
  @ApiOperation({ summary: 'Historial de órdenes recibidas del proveedor' })
  @ApiOkResponse({ type: SupplierOrderHistoryDto })
  async getSupplierOrderHistory(@Param('id') id: string): Promise<SupplierOrderHistoryDto> {
    return this.service.getSupplierOrderHistory(id);
  }

  @Post()
  @RequirePermissions('purchase_orders.manage')
  @ApiOperation({ summary: 'Crear proveedor' })
  @ApiOkResponse({ type: SupplierResponseDto })
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
