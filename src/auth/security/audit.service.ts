import { Injectable } from '@nestjs/common';

import { AuthEventType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { RequestMetadata } from '../auth.types.js';

export interface AuthAuditDetails {
  readonly [key: string]: string | number | boolean | null;
}

/** Escribe hechos de autenticación sin contraseñas, códigos, secretos ni tokens. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    eventType: AuthEventType,
    metadata: RequestMetadata,
    options: {
      readonly userId?: string;
      readonly sessionId?: string;
      readonly details?: AuthAuditDetails;
    } = {},
  ): Promise<void> {
    await this.prisma.authEvent.create({
      data: {
        userId: options.userId,
        sessionId: options.sessionId,
        eventType,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        requestId: metadata.requestId,
        details: options.details,
      },
    });
  }
}
