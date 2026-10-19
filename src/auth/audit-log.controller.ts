import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';

import { SessionGuard } from '../auth/guards/session.guard.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { AuditLogQueryDto, AuditLogPageDto, AuditLogResponseDto } from './dto/audit-log.dto.js';

/** Consulta de bitácora de auditoría para administradores. */
@ApiTags('audit')
@Controller('audit-logs')
@UseGuards(SessionGuard)
@ApiBearerAuth('session')
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista entradas de auditoría con filtros opcionales y paginación en una sola transacción de conteo y datos. */
  @Get()
  @RequirePermissions('audit_logs.read')
  @ApiOperation({ summary: 'Consultar bitácora de auditoría' })
  @ApiOkResponse({ type: AuditLogPageDto })
  async listAuditLogs(@Query() query: AuditLogQueryDto): Promise<AuditLogPageDto> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };

    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: query.pageSize,
      }),
    ]);

    const data: AuditLogResponseDto[] = rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      beforeData: row.beforeData as Record<string, unknown> | null,
      afterData: row.afterData as Record<string, unknown> | null,
      requestId: row.requestId,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }
}
