import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuditService } from './security/audit.service.js';
import { MfaCryptoService } from './security/mfa-crypto.service.js';
import { PasswordService } from './security/password.service.js';
import { SessionService } from './security/session.service.js';
import { TotpService } from './security/totp.service.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { PermissionGuard } from './guards/permission.guard.js';
import { SessionGuard } from './guards/session.guard.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuditService,
    MfaCryptoService,
    PasswordService,
    SessionService,
    TotpService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  exports: [AuthService, PasswordService, MfaCryptoService, TotpService, SessionService],
})
export class AuthModule {}
