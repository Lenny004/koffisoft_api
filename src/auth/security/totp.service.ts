import { Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verify } from 'otplib';

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_WINDOW_STEPS = 1;

export interface TotpVerification {
  readonly timeStep: number;
}

/** Mantiene la política TOTP compatible con RFC 6238 y con aplicaciones autenticadoras comunes. */
@Injectable()
export class TotpService {
  /** Genera una semilla aleatoria compatible con aplicaciones autenticadoras estándar. */
  generateSecret(): string {
    return generateSecret();
  }

  /** Construye la URI otpauth para enrolar el factor con el correo del usuario. */
  generateUri(email: string, secret: string): string {
    return generateURI({
      issuer: 'Koffi-Soft',
      label: email,
      secret,
    });
  }

  /**
   * Valida un código TOTP en la ventana actual más un paso de tolerancia; devuelve el time step usado.
   */
  async verifyCode(
    secret: string,
    token: string,
    nowSeconds = Math.floor(Date.now() / 1000),
  ): Promise<TotpVerification | null> {
    const currentStep = Math.floor(nowSeconds / TOTP_PERIOD_SECONDS);

    for (const offset of [0, -TOTP_WINDOW_STEPS, TOTP_WINDOW_STEPS]) {
      const timeStep = currentStep + offset;
      const result = await verify({
        secret,
        token,
        epoch: timeStep * TOTP_PERIOD_SECONDS,
        epochTolerance: 0,
      });

      if (result.valid) {
        return { timeStep };
      }
    }

    return null;
  }
}
