import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Toma el primer valor cuando Fastify entrega un encabezado repetido como arreglo. */
function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Rechaza escrituras con un Origin/Referer distinto a la lista CORS aprobada. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /**
   * Compara Origin o Referer de escrituras contra corsOrigins; métodos seguros pasan sin comprobar.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const origin = firstHeader(request.headers.origin);
    const referer = firstHeader(request.headers.referer);
    const origins = [origin, referer ? this.originFromReferer(referer) : undefined].filter(
      (value): value is string => value !== undefined,
    );

    if (origins.length === 0) {
      throw new ForbiddenException('Falta el origen de la solicitud.');
    }

    if (origins.some((requestOrigin) => !this.config.corsOrigins.includes(requestOrigin))) {
      throw new ForbiddenException('Origen no permitido.');
    }

    return true;
  }

  /** Deriva el origen scheme+host del Referer cuando el encabezado Origin no viene. */
  private originFromReferer(referer: string): string | undefined {
    try {
      const parsed = new URL(referer);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : undefined;
    } catch {
      return undefined;
    }
  }
}
