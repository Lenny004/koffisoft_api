import { IsString } from 'class-validator';

/** Servicio de correo configurable. */
export abstract class MailerService {
  /** Envía un correo de recuperación de contraseña. */
  abstract sendPasswordReset(to: string, token: string): Promise<void>;

  /** Envía un correo de bienvenida. */
  abstract sendWelcome(to: string, name: string): Promise<void>;
}

export class SendPasswordResetDto {
  @IsString()
  readonly to!: string;

  @IsString()
  readonly token!: string;
}

export class SendWelcomeDto {
  @IsString()
  readonly to!: string;

  @IsString()
  readonly name!: string;
}
