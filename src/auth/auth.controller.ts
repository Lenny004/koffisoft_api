import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';

import type { AuthenticatedRequest } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { requestMetadata } from './auth.types.js';
import { AllowMfaEnrollment, AllowMfaPending } from './decorators/auth-flow.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginResponseDto, MeResponseDto } from './dto/auth-response.dto.js';
import {
  MfaCodeDto,
  MfaSetupDto,
  MfaSetupResponseDto,
  MfaResultDto,
  PasswordAndMfaCodeDto,
  RecoveryCodeDto,
  RecoveryCodesResponseDto,
} from './dto/mfa.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangePasswordDto } from './dto/password.dto.js';
import { SessionService } from './security/session.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inicia una sesión con contraseña' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(
      dto,
      requestMetadata(request),
      this.sessions.getToken(request),
    );
    this.sessions.setCookie(reply, result.session.token, result.session.record.expiresAt);

    return {
      authenticated: true,
      requiresMfa: result.requiresMfa,
      requiresMfaSetup: result.requiresMfaSetup,
      expiresAt: result.session.record.expiresAt.toISOString(),
    };
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @AllowMfaPending()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Verifica el TOTP de una sesión pendiente' })
  @ApiResponse({ status: 200, type: MfaResultDto })
  async verifyMfa(
    @Body() dto: MfaCodeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MfaResultDto> {
    const result = await this.authService.verifyMfa(
      this.requiredContext(request),
      dto,
      requestMetadata(request),
    );
    this.sessions.setCookie(reply, result.session.token, result.session.record.expiresAt);

    return {
      authenticated: true,
      mfaVerified: true,
      expiresAt: result.session.record.expiresAt.toISOString(),
    };
  }

  @Post('mfa/recovery')
  @HttpCode(HttpStatus.OK)
  @AllowMfaPending()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Completa una sesión pendiente con un código de recuperación' })
  @ApiResponse({ status: 200, type: MfaResultDto })
  async verifyRecovery(
    @Body() dto: RecoveryCodeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MfaResultDto> {
    const result = await this.authService.verifyRecovery(
      this.requiredContext(request),
      dto,
      requestMetadata(request),
    );
    this.sessions.setCookie(reply, result.session.token, result.session.record.expiresAt);

    return {
      authenticated: true,
      mfaVerified: true,
      expiresAt: result.session.record.expiresAt.toISOString(),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: 'Revoca la sesión de este navegador' })
  @ApiResponse({ status: 200 })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ ok: true }> {
    await this.authService.logout(this.sessions.getToken(request), requestMetadata(request));
    this.sessions.clearCookie(reply);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Revoca todas las sesiones del usuario' })
  @ApiResponse({ status: 200 })
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ ok: true; revokedSessions: number }> {
    const revokedSessions = await this.authService.logoutAll(
      this.requiredContext(request),
      requestMetadata(request),
    );
    this.sessions.clearCookie(reply);
    return { ok: true, revokedSessions };
  }

  @Get('me')
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Devuelve el usuario, roles, permisos y estado MFA' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  async me(@Req() request: AuthenticatedRequest): Promise<MeResponseDto> {
    return this.authService.me(this.requiredContext(request)) as unknown as MeResponseDto;
  }

  @Post('mfa/totp/setup')
  @AllowMfaEnrollment()
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Crea un factor TOTP pendiente y devuelve su URI otpauth' })
  @ApiResponse({ status: 201, type: MfaSetupResponseDto })
  async setupTotp(
    @Body() dto: MfaSetupDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<MfaSetupResponseDto> {
    const result = await this.authService.setupTotp(
      this.requiredContext(request),
      dto,
      requestMetadata(request),
    );
    return { ...result, status: 'pending' };
  }

  @Post('mfa/totp/confirm')
  @AllowMfaEnrollment()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Confirma el TOTP y genera diez códigos de recuperación' })
  @ApiResponse({ status: 201, type: RecoveryCodesResponseDto })
  async confirmTotp(
    @Body() dto: MfaCodeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RecoveryCodesResponseDto> {
    const result = await this.authService.confirmTotp(
      this.requiredContext(request),
      dto,
      requestMetadata(request),
    );
    this.sessions.setCookie(reply, result.session.token, result.session.record.expiresAt);
    return { recoveryCodes: result.recoveryCodes };
  }

  @Post('mfa/totp/disable')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Desactiva TOTP tras reautenticación' })
  @ApiResponse({ status: 200 })
  async disableTotp(
    @Body() dto: PasswordAndMfaCodeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ mfaEnabled: false }> {
    const result = await this.authService.disableTotp(
      this.requiredContext(request),
      dto,
      requestMetadata(request),
    );
    this.sessions.setCookie(reply, result.session.token, result.session.record.expiresAt);
    return { mfaEnabled: false };
  }

  @Post('mfa/recovery-codes')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Regenera diez códigos de recuperación tras reautenticación' })
  @ApiResponse({ status: 201, type: RecoveryCodesResponseDto })
  async regenerateRecoveryCodes(
    @Body() dto: PasswordAndMfaCodeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RecoveryCodesResponseDto> {
    const recoveryCodes = await this.authService.regenerateRecoveryCodes(
      this.requiredContext(request),
      dto,
      requestMetadata(request),
    );
    return { recoveryCodes };
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Cambia la contraseña y revoca las demás sesiones' })
  @ApiResponse({ status: 200 })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ ok: true }> {
    const session = await this.authService.changePassword(
      this.requiredContext(request),
      dto,
      requestMetadata(request),
    );
    this.sessions.setCookie(reply, session.token, session.record.expiresAt);
    return { ok: true };
  }

  private requiredContext(request: AuthenticatedRequest) {
    if (!request.auth) {
      throw new UnauthorizedException('Autenticación requerida.');
    }
    return request.auth;
  }
}
