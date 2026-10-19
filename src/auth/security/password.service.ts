import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';

export const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Encapsula el único algoritmo permitido para contraseñas y códigos de recuperación. */
@Injectable()
export class PasswordService {
  /** Genera un hash Argon2id con los parámetros centralizados del servicio. */
  async hash(value: string): Promise<string> {
    return argon2.hash(value, ARGON2ID_OPTIONS);
  }

  /** Compara un valor en claro con un hash almacenado; un hash inválido se trata como fallo silencioso. */
  async verify(hash: string, value: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, value);
    } catch {
      // Un hash corrupto se comporta como una contraseña inválida y no revela el motivo.
      return false;
    }
  }

  /** Indica si el hash debe regenerarse porque los parámetros Argon2id cambiaron o el formato es ilegible. */
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

  /** Hashea un token de recuperación con SHA-256 para almacenamiento seguro. */
  async hashResetToken(token: string): Promise<string> {
    return createHash('sha256').update(token).digest('hex');
  }
}
