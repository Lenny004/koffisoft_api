import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  AuthEventType,
  MfaFactorStatus,
  MfaFactorType,
  UserStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import type { AccessSnapshot, AuthContext, RequestMetadata } from './auth.types.js';
import { ChangePasswordDto } from './dto/password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { MfaCodeDto, MfaSetupDto, PasswordAndMfaCodeDto, RecoveryCodeDto } from './dto/mfa.dto.js';
import { AuditService } from './security/audit.service.js';
import { MfaCryptoService } from './security/mfa-crypto.service.js';
import { PasswordService } from './security/password.service.js';
import { type CreatedSession, SessionService } from './security/session.service.js';
import { TotpService } from './security/totp.service.js';

export interface LoginResult {
  readonly session: CreatedSession;
  readonly requiresMfa: boolean;
  readonly requiresMfaSetup: boolean;
}

export interface MfaSessionResult {
  readonly session: CreatedSession;
  readonly usedRecoveryCode: boolean;
}

export interface TotpSetupResult {
  readonly label: string;
  readonly uri: string;
}

export interface MfaStateResult {
  readonly session: CreatedSession;
  readonly enabled: boolean;
}

interface LoginUser {
  readonly id: string;
  readonly passwordHash: string;
  readonly status: UserStatus;
  readonly failedLoginAttempts: number;
  readonly lockedUntil: Date | null;
}

interface RecoveryCodeMaterial {
  readonly plain: string;
  readonly hash: string;
}

const GENERIC_LOGIN_ERROR = 'Credenciales inválidas.';

/** Coordina autenticación, MFA, recuperación, cambio de contraseña y auditoría. */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mfaCrypto: MfaCryptoService,
    private readonly totp: TotpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async getAccessSnapshot(userId: string): Promise<AccessSnapshot | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        passwordChangedAt: true,
        emailVerifiedAt: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                active: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: { code: true, active: true },
                    },
                  },
                },
              },
            },
          },
        },
        mfaFactors: {
          where: { factorType: MfaFactorType.Totp },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            factorType: true,
            label: true,
            status: true,
            verifiedAt: true,
            disabledAt: true,
            keyVersion: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const activeRoles = user.roles.filter(({ role }) => role.active);
    const roles = activeRoles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        activeRoles.flatMap(({ role }) =>
          role.rolePermissions
            .filter(({ permission }) => permission.active)
            .map(({ permission }) => permission.code),
        ),
      ),
    ];
    const factors = user.mfaFactors.map((factor) => ({
      id: factor.id,
      factorType: factor.factorType.toLowerCase(),
      label: factor.label,
      status: factor.status.toLowerCase(),
      verifiedAt: factor.verifiedAt,
      disabledAt: factor.disabledAt,
      keyVersion: factor.keyVersion,
    }));
    const enabled = factors.some((factor) => factor.status === 'active');
    const required = roles.some((role) => this.config.mfaRequiredRoles.includes(role));

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        passwordChangedAt: user.passwordChangedAt,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      roles,
      permissions,
      mfa: { enabled, required, factors },
    };
  }

  async login(
    dto: LoginDto,
    metadata: RequestMetadata,
    existingToken?: string,
  ): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    let passwordValid = false;
    let needsRehash = false;

    if (user) {
      passwordValid = await this.passwords.verify(user.passwordHash, dto.password);
      needsRehash = passwordValid && this.passwords.needsRehash(user.passwordHash);
    } else {
      await this.passwords.burn(dto.password);
    }

    const now = new Date();
    const locked =
      user?.status === UserStatus.Locked && !!user.lockedUntil && user.lockedUntil > now;
    const active =
      user?.status === UserStatus.Active || (user?.status === UserStatus.Locked && !locked);

    if (!user || !passwordValid || !active || locked) {
      if (user && active && !locked && !passwordValid) {
        await this.registerLoginFailure(user, metadata, now);
      } else {
        await this.audit.record(AuthEventType.LoginFailed, metadata, {
          userId: user?.id,
          details: { reason: locked ? 'account_locked' : 'invalid_credentials' },
        });
      }

      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    if (needsRehash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwords.hash(dto.password) },
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.Active,
        failedLoginAttempts: 0,
        lockedAt: null,
        lockedUntil: null,
        lastFailedLoginAt: null,
        lastLoginAt: now,
      },
    });

    if (existingToken) {
      await this.sessions.revokeToken(existingToken, 'login_rotation', metadata);
    }

    const access = await this.getAccessSnapshot(user.id);
    if (!access) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const requiresMfa = access.mfa.enabled;
    const requiresMfaSetup = access.mfa.required && !access.mfa.enabled;
    const session = await this.sessions.createSession(
      user.id,
      !requiresMfa && !requiresMfaSetup,
      metadata,
      now,
    );

    await this.audit.record(AuthEventType.LoginSucceeded, metadata, {
      userId: user.id,
      sessionId: session.record.id,
      details: { mfaPending: requiresMfa, mfaSetupRequired: requiresMfaSetup },
    });

    return { session, requiresMfa, requiresMfaSetup };
  }

  async verifyMfa(
    context: AuthContext,
    dto: MfaCodeDto,
    metadata: RequestMetadata,
  ): Promise<MfaSessionResult> {
    const valid = await this.consumeTotp(context.userId, dto.code);
    if (!valid) {
      await this.audit.record(AuthEventType.MfaFailed, metadata, {
        userId: context.userId,
        sessionId: context.sessionId,
        details: { method: 'totp' },
      });
      throw new UnauthorizedException('Código MFA inválido.');
    }

    const session = await this.rotateContextSession(context, true, metadata, 'mfa_verified');
    await this.audit.record(AuthEventType.MfaSucceeded, metadata, {
      userId: context.userId,
      sessionId: session.record.id,
      details: { method: 'totp' },
    });

    return { session, usedRecoveryCode: false };
  }

  async verifyRecovery(
    context: AuthContext,
    dto: RecoveryCodeDto,
    metadata: RequestMetadata,
  ): Promise<MfaSessionResult> {
    const used = await this.consumeRecoveryCode(context.userId, dto.code);
    if (!used) {
      await this.audit.record(AuthEventType.MfaFailed, metadata, {
        userId: context.userId,
        sessionId: context.sessionId,
        details: { method: 'recovery_code' },
      });
      throw new UnauthorizedException('Código de recuperación inválido.');
    }

    const session = await this.rotateContextSession(context, true, metadata, 'mfa_recovery');
    await this.audit.record(AuthEventType.RecoveryCodeUsed, metadata, {
      userId: context.userId,
      sessionId: session.record.id,
      details: { method: 'recovery_code' },
    });
    await this.audit.record(AuthEventType.MfaSucceeded, metadata, {
      userId: context.userId,
      sessionId: session.record.id,
      details: { method: 'recovery_code' },
    });

    return { session, usedRecoveryCode: true };
  }

  async setupTotp(
    context: AuthContext,
    dto: MfaSetupDto,
    metadata: RequestMetadata,
  ): Promise<TotpSetupResult> {
    if (context.mfa.enabled) {
      throw new ConflictException('Ya existe un factor MFA activo.');
    }

    const label = (dto.label?.trim() || `Koffi-Soft:${context.user.email}`).slice(0, 100);
    const secret = this.totp.generateSecret();
    const uri = this.totp.generateUri(context.user.email, secret);
    const encrypted = this.mfaCrypto.encrypt(secret);

    await this.prisma.userMfaFactor.deleteMany({
      where: { userId: context.userId, status: MfaFactorStatus.Pending },
    });
    const factor = await this.prisma.userMfaFactor.create({
      data: {
        userId: context.userId,
        factorType: MfaFactorType.Totp,
        label,
        status: MfaFactorStatus.Pending,
        secretCiphertext: encrypted.ciphertext,
        secretIv: encrypted.iv,
        secretAuthTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
      },
    });

    await this.audit.record(AuthEventType.MfaFactorCreated, metadata, {
      userId: context.userId,
      sessionId: context.sessionId,
      details: { factorType: 'totp', status: 'pending' },
    });

    return { label: factor.label, uri };
  }

  async confirmTotp(
    context: AuthContext,
    dto: MfaCodeDto,
    metadata: RequestMetadata,
  ): Promise<{ session: CreatedSession; recoveryCodes: string[] }> {
    const factor = await this.prisma.userMfaFactor.findFirst({
      where: {
        userId: context.userId,
        factorType: MfaFactorType.Totp,
        status: MfaFactorStatus.Pending,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!factor) {
      throw new BadRequestException('No existe un alta de MFA pendiente.');
    }

    const secret = this.mfaCrypto.decrypt(
      factor.secretCiphertext,
      factor.secretIv,
      factor.secretAuthTag,
      factor.keyVersion,
    );
    const verification = await this.totp.verifyCode(secret, dto.code);
    if (!verification) {
      await this.audit.record(AuthEventType.MfaFailed, metadata, {
        userId: context.userId,
        sessionId: context.sessionId,
        details: { method: 'totp_setup' },
      });
      throw new UnauthorizedException('Código MFA inválido.');
    }

    const recoveryCodes = await this.buildRecoveryCodes();
    await this.prisma.$transaction(async (transaction) => {
      const activated = await transaction.userMfaFactor.updateMany({
        where: { id: factor.id, status: MfaFactorStatus.Pending },
        data: {
          status: MfaFactorStatus.Active,
          verifiedAt: new Date(),
          lastUsedTimeStep: BigInt(verification.timeStep),
        },
      });

      if (activated.count !== 1) {
        throw new ConflictException('El alta de MFA ya no está pendiente.');
      }

      await transaction.userMfaRecoveryCode.deleteMany({ where: { userId: context.userId } });
      await transaction.userMfaRecoveryCode.createMany({
        data: recoveryCodes.map(({ hash }) => ({ userId: context.userId, codeHash: hash })),
      });
    });

    const session = await this.rotateContextSession(context, true, metadata, 'mfa_enrollment');
    await this.audit.record(AuthEventType.MfaFactorVerified, metadata, {
      userId: context.userId,
      sessionId: session.record.id,
      details: { factorType: 'totp' },
    });
    await this.audit.record(AuthEventType.MfaSucceeded, metadata, {
      userId: context.userId,
      sessionId: session.record.id,
      details: { method: 'totp_setup' },
    });

    return {
      session,
      recoveryCodes: recoveryCodes.map(({ plain }) => plain),
    };
  }

  async regenerateRecoveryCodes(
    context: AuthContext,
    dto: PasswordAndMfaCodeDto,
    metadata: RequestMetadata,
  ): Promise<string[]> {
    const user = await this.getUserPassword(context.userId);
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.password))) {
      await this.audit.record(AuthEventType.MfaFailed, metadata, {
        userId: context.userId,
        sessionId: context.sessionId,
        details: { method: 'recovery_codes_password' },
      });
      throw new UnauthorizedException('No fue posible verificar la contraseña y el MFA.');
    }

    if (!(await this.consumeTotp(context.userId, dto.code))) {
      await this.audit.record(AuthEventType.MfaFailed, metadata, {
        userId: context.userId,
        sessionId: context.sessionId,
        details: { method: 'recovery_codes_totp' },
      });
      throw new UnauthorizedException('No fue posible verificar la contraseña y el MFA.');
    }

    const recoveryCodes = await this.buildRecoveryCodes();
    await this.replaceRecoveryCodes(context.userId, recoveryCodes);
    await this.audit.record(AuthEventType.MfaFactorVerified, metadata, {
      userId: context.userId,
      sessionId: context.sessionId,
      details: { action: 'recovery_codes_regenerated' },
    });

    return recoveryCodes.map(({ plain }) => plain);
  }

  async disableTotp(
    context: AuthContext,
    dto: PasswordAndMfaCodeDto,
    metadata: RequestMetadata,
  ): Promise<MfaStateResult> {
    const user = await this.getUserPassword(context.userId);
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.password))) {
      await this.audit.record(AuthEventType.MfaFailed, metadata, {
        userId: context.userId,
        sessionId: context.sessionId,
        details: { method: 'disable_password' },
      });
      throw new UnauthorizedException('No fue posible verificar la contraseña y el MFA.');
    }

    if (!(await this.consumeTotp(context.userId, dto.code))) {
      await this.audit.record(AuthEventType.MfaFailed, metadata, {
        userId: context.userId,
        sessionId: context.sessionId,
        details: { method: 'disable_totp' },
      });
      throw new UnauthorizedException('No fue posible verificar la contraseña y el MFA.');
    }

    const disabled = await this.prisma.userMfaFactor.updateMany({
      where: {
        userId: context.userId,
        factorType: MfaFactorType.Totp,
        status: MfaFactorStatus.Active,
      },
      data: { status: MfaFactorStatus.Disabled, disabledAt: new Date() },
    });

    if (disabled.count !== 1) {
      throw new BadRequestException('No existe un factor MFA activo.');
    }

    await this.prisma.userMfaRecoveryCode.deleteMany({ where: { userId: context.userId } });
    const access = await this.getAccessSnapshot(context.userId);
    if (!access) {
      throw new UnauthorizedException('Sesión inválida o expirada.');
    }

    await this.sessions.revokeAll(context.userId, metadata, 'mfa_disabled', context.sessionId);
    const session = await this.rotateContextSession(
      context,
      !access.mfa.required,
      metadata,
      'mfa_disabled',
    );
    await this.audit.record(AuthEventType.MfaFactorDisabled, metadata, {
      userId: context.userId,
      sessionId: session.record.id,
      details: { factorType: 'totp' },
    });

    return { session, enabled: false };
  }

  async changePassword(
    context: AuthContext,
    dto: ChangePasswordDto,
    metadata: RequestMetadata,
  ): Promise<CreatedSession> {
    const user = await this.getUserPassword(context.userId);
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      await this.audit.record(AuthEventType.LoginFailed, metadata, {
        userId: context.userId,
        sessionId: context.sessionId,
        details: { reason: 'password_change_failed' },
      });
      throw new UnauthorizedException('La contraseña actual no es válida.');
    }

    if (await this.passwords.verify(user.passwordHash, dto.newPassword)) {
      throw new BadRequestException('La nueva contraseña debe ser diferente.');
    }

    await this.prisma.user.update({
      where: { id: context.userId },
      data: {
        passwordHash: await this.passwords.hash(dto.newPassword),
        passwordChangedAt: new Date(),
      },
    });

    await this.sessions.revokeAll(context.userId, metadata, 'password_changed', context.sessionId);
    const session = await this.rotateContextSession(
      context,
      context.mfaVerified,
      metadata,
      'password_changed',
    );
    await this.audit.record(AuthEventType.PasswordChanged, metadata, {
      userId: context.userId,
      sessionId: session.record.id,
    });

    return session;
  }

  async logout(token: string | undefined, metadata: RequestMetadata): Promise<void> {
    if (token) {
      await this.sessions.revokeToken(token, 'logout', metadata);
    }
  }

  async logoutAll(context: AuthContext, metadata: RequestMetadata): Promise<number> {
    return this.sessions.revokeAll(context.userId, metadata, 'logout_all');
  }

  me(context: AuthContext): Record<string, unknown> {
    return {
      user: context.user,
      roles: [...context.roles],
      permissions: [...context.permissions],
      mfa: {
        enabled: context.mfa.enabled,
        required: context.mfa.required,
        verified: context.mfaVerified,
        factors: context.mfa.factors,
      },
    };
  }

  private async registerLoginFailure(
    user: LoginUser,
    metadata: RequestMetadata,
    now: Date,
  ): Promise<void> {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedLoginAttempts >= this.config.loginMaxAttempts;
    const lockedUntil = shouldLock
      ? new Date(now.getTime() + this.config.loginLockMinutes * 60 * 1000)
      : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts,
        lastFailedLoginAt: now,
        ...(shouldLock ? { status: UserStatus.Locked, lockedAt: now, lockedUntil } : {}),
      },
    });
    await this.audit.record(AuthEventType.LoginFailed, metadata, {
      userId: user.id,
      details: { reason: 'invalid_credentials' },
    });

    if (shouldLock) {
      await this.audit.record(AuthEventType.AccountLocked, metadata, {
        userId: user.id,
        details: { failedLoginAttempts },
      });
    }
  }

  private async getUserPassword(userId: string): Promise<{ passwordHash: string } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
  }

  private async getActiveFactor(userId: string) {
    return this.prisma.userMfaFactor.findFirst({
      where: {
        userId,
        factorType: MfaFactorType.Totp,
        status: MfaFactorStatus.Active,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async consumeTotp(userId: string, code: string): Promise<boolean> {
    const factor = await this.getActiveFactor(userId);
    if (!factor) {
      return false;
    }

    const secret = this.mfaCrypto.decrypt(
      factor.secretCiphertext,
      factor.secretIv,
      factor.secretAuthTag,
      factor.keyVersion,
    );
    const verification = await this.totp.verifyCode(secret, code);
    if (!verification) {
      return false;
    }

    const accepted = await this.prisma.userMfaFactor.updateMany({
      where: {
        id: factor.id,
        status: MfaFactorStatus.Active,
        OR: [
          { lastUsedTimeStep: null },
          { lastUsedTimeStep: { lt: BigInt(verification.timeStep) } },
        ],
      },
      data: { lastUsedTimeStep: BigInt(verification.timeStep) },
    });

    return accepted.count === 1;
  }

  private async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const normalized = code.replaceAll('-', '').trim().toUpperCase();
    const candidates = await this.prisma.userMfaRecoveryCode.findMany({
      where: { userId, usedAt: null },
    });
    let match: string | undefined;

    for (const candidate of candidates) {
      if (await this.passwords.verify(candidate.codeHash, normalized)) {
        match = candidate.id;
      }
    }

    if (!match) {
      return false;
    }

    const used = await this.prisma.userMfaRecoveryCode.updateMany({
      where: { id: match, usedAt: null },
      data: { usedAt: new Date() },
    });

    return used.count === 1;
  }

  private async buildRecoveryCodes(): Promise<RecoveryCodeMaterial[]> {
    const codes: RecoveryCodeMaterial[] = [];
    for (let index = 0; index < 10; index += 1) {
      const plain = randomBytes(10).toString('hex').toUpperCase();
      codes.push({ plain, hash: await this.passwords.hash(plain) });
    }
    return codes;
  }

  private async replaceRecoveryCodes(userId: string, codes: RecoveryCodeMaterial[]): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.userMfaRecoveryCode.deleteMany({ where: { userId } });
      await transaction.userMfaRecoveryCode.createMany({
        data: codes.map(({ hash }) => ({ userId, codeHash: hash })),
      });
    });
  }

  private async rotateContextSession(
    context: AuthContext,
    mfaVerified: boolean,
    metadata: RequestMetadata,
    reason: string,
  ): Promise<CreatedSession> {
    const current = await this.prisma.userSession.findUnique({ where: { id: context.sessionId } });
    if (!current || current.revokedAt) {
      throw new ForbiddenException('La sesión ya no está activa.');
    }

    return this.sessions.rotateSession(current, mfaVerified, metadata, reason);
  }
}
