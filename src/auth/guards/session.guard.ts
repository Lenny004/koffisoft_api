import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserStatus } from '../../generated/prisma/enums.js';
import { requestMetadata, type AuthenticatedRequest } from '../auth.types.js';
import {
  ALLOW_MFA_ENROLLMENT_KEY,
  ALLOW_MFA_PENDING_KEY,
} from '../decorators/auth-flow.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AuthService } from '../auth.service.js';
import { SessionService } from '../security/session.service.js';

/** Carga la sesión desde PostgreSQL y aplica el estado MFA antes del controlador. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.sessions.getToken(request);
    if (!token) {
      throw new UnauthorizedException('Autenticación requerida.');
    }

    const session = await this.sessions.findValidSession(token, requestMetadata(request));
    if (!session) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    const access = await this.authService.getAccessSnapshot(session.userId);
    if (!access) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    if (access.user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_MFA_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowEnrollment = this.reflector.getAllAndOverride<boolean>(ALLOW_MFA_ENROLLMENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (access.mfa.required && !access.mfa.enabled) {
      if (!allowEnrollment) {
        throw new ForbiddenException('Debe configurar MFA antes de continuar.');
      }
    } else if (!session.mfaVerified && !allowPending) {
      throw new ForbiddenException('Debe verificar MFA antes de continuar.');
    }

    if (!access.mfa.enabled && allowPending) {
      throw new ForbiddenException('No existe un factor MFA activo para esta sesión.');
    }

    request.auth = {
      ...access,
      userId: session.userId,
      sessionId: session.id,
      mfaVerified: session.mfaVerified,
    };

    return true;
  }
}
