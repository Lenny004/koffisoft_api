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

import type { AuthContext, AuthenticatedRequest } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { requestMetadata } from './auth.types.js';
import {
  AllowMfaEnrollment,
  AllowMfaPending,
  AllowPasswordChange,
} from './decorators/auth-flow.decorator.js';
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
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordDto,
} from './dto/password-reset.dto.js';
import { InitialSetupDto, SetupStatusDto } from './dto/setup.dto.js';
import { SessionService } from './security/session.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Get('setup')
  @Public()
  @ApiOperation({ summary: 'Indica si el alta inicial del propietario sigue disponible' })
  @ApiResponse({ status: 200, type: SetupStatusDto })
  /** Expone si el flujo de alta inicial del propietario sigue habilitado. */
  async setupStatus(): Promise<SetupStatusDto> {
    return { required: await this.authService.isSetupRequired() };
  }

  /** Completa el primer uso, delega en el servicio y fija la cookie de sesión resultante. */
  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Crea al primer propietario una sola vez' })
  @ApiResponse({ status: 201, type: LoginResponseDto })
  async completeSetup(
    @Body() dto: InitialSetupDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.completeInitialSetup(
      dto,
      requestMetadata(request),
      this.sessions.getToken(request),
    );
    this.sessions.setCookie(reply, result.session.token, result.session.record.expiresAt);

    return {
      authenticated: true,
      requiresMfa: result.requiresMfa,
      requiresMfaSetup: result.requiresMfaSetup,
      mustChangePassword: result.mustChangePassword,
      expiresAt: result.session.record.expiresAt.toISOString(),
    };
  }

  /** Autentica con correo y contraseña y devuelve el estado de MFA y cookie de sesión. */
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
      mustChangePassword: result.mustChangePassword,
      expiresAt: result.session.record.expiresAt.toISOString(),
    };
  }

  /** Valida TOTP sobre una sesión con MFA pendiente y renueva la cookie. */
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

  /** Acepta un código de recuperación MFA en sesión pendiente y renueva la cookie. */
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

  /** Revoca la sesión del navegador actual y elimina la cookie. */
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

  /** Cierra todas las sesiones del usuario autenticado y limpia la cookie local. */
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

  /** Devuelve el perfil, RBAC y estado MFA de la sesión vigente. */
  @Get('me')
  @AllowPasswordChange()
  @ApiSecurity('sessionCookie')
  @ApiOperation({ summary: 'Devuelve el usuario, roles, permisos y estado MFA' })
  @ApiResponse({ status: 200, type: MeResponseDto })
  async me(@Req() request: AuthenticatedRequest): Promise<MeResponseDto> {
    return this.authService.me(this.requiredContext(request));
  }

  /** Inicia el enrolamiento TOTP y responde con la URI para el autenticador. */
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

  /** Confirma el factor TOTP, entrega códigos de recuperación y actualiza la cookie de sesión. */
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

  /** Desactiva TOTP tras verificación reforzada y renueva la cookie según política MFA. */
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

  /** Regenera códigos de recuperación tras validar contraseña y TOTP del titular. */
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

  /** Cambia la contraseña autenticado y sincroniza la cookie con la sesión rotada. */
  @Post('password')
  @AllowPasswordChange()
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

  /** Solicita restablecimiento de contraseña con respuesta genérica ante cualquier correo. */
  @Post('forgot-password')
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicita un token de recuperación de contraseña' })
  @ApiResponse({ status: 200, type: ForgotPasswordResponseDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ForgotPasswordResponseDto> {
    await this.authService.requestPasswordReset(dto.email, requestMetadata(request));
    return { message: 'Si el correo existe, recibirás instrucciones de recuperación.' };
  }

  /** Aplica una contraseña nueva usando el token de recuperación entregado por correo. */
  @Post('reset-password')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablece la contraseña con un token válido' })
  @ApiResponse({ status: 200 })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    await this.authService.resetPassword(dto.token, dto.newPassword, requestMetadata(request));
    return { ok: true };
  }

  /** Exige contexto de autenticación resuelto por el guard de sesión. */
  private requiredContext(request: AuthenticatedRequest): AuthContext {
    if (!request.auth) {
      throw new UnauthorizedException('Autenticación requerida.');
    }
    return request.auth;
  }
}
