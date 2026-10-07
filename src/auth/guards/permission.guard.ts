import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../auth.types.js';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

/** Autoriza por la unión de permisos activos de roles activos del usuario. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) {
      throw new UnauthorizedException('Autenticación requerida.');
    }

    const permissions = new Set(request.auth.permissions);
    if (!required.every((permission) => permissions.has(permission))) {
      throw new ForbiddenException('No tiene permisos suficientes.');
    }

    return true;
  }
}
