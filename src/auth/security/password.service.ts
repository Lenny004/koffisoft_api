import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

export const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Encapsula el único algoritmo permitido para contraseñas y códigos de recuperación. */
@Injectable()
export class PasswordService {
  async hash(value: string): Promise<string> {
    return argon2.hash(value, ARGON2ID_OPTIONS);
  }

  async verify(hash: string, value: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, value);
    } catch {
      // Un hash corrupto se comporta como una contraseña inválida y no revela el motivo.
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, ARGON2ID_OPTIONS);
    } catch {
      return true;
    }
  }

  /** Consume un coste Argon2 equivalente cuando el correo no corresponde a una cuenta. */
  async burn(value: string): Promise<void> {
    await this.hash(value);
  }
}
