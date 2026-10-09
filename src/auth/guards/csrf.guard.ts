import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Rechaza escrituras con un Origin/Referer distinto a la lista CORS aprobada. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

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

    // Clientes no navegador como curl pueden omitirlos al iniciar sesión, cuando
    // todavía no existe una cookie de sesión que proteger.
    if (origins.length === 0) {
      if (request.cookies?.[this.config.cookieName]) {
        throw new ForbiddenException('Falta el origen de la solicitud.');
      }
      return true;
    }

    if (origins.some((requestOrigin) => !this.config.corsOrigins.includes(requestOrigin))) {
      throw new ForbiddenException('Origen no permitido.');
    }

    return true;
  }

  private originFromReferer(referer: string): string | undefined {
    try {
      const parsed = new URL(referer);
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.origin : undefined;
    } catch {
      return undefined;
    }
  }
}
