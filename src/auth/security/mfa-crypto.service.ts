import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';

export interface EncryptedMfaSecret {
  readonly ciphertext: Uint8Array<ArrayBuffer>;
  readonly iv: Uint8Array<ArrayBuffer>;
  readonly authTag: Uint8Array<ArrayBuffer>;
  readonly keyVersion: number;
}

/** Copia bytes a un Uint8Array con ArrayBuffer propio para APIs de cifrado de Node. */
function copyBytes(value: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

/** Cifra las semillas TOTP con AES-256-GCM antes de entregarlas a Prisma. */
@Injectable()
export class MfaCryptoService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  /** Cifra la semilla TOTP en texto con AES-256-GCM y la versión de llave configurada. */
  encrypt(secret: string): EncryptedMfaSecret {
    const iv = copyBytes(randomBytes(12));
    const cipher = createCipheriv('aes-256-gcm', this.config.mfaEncryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);

    return {
      ciphertext: copyBytes(ciphertext),
      iv,
      authTag: copyBytes(cipher.getAuthTag()),
      keyVersion: this.config.mfaKeyVersion,
    };
  }

  /**
   * Descifra un factor MFA persistido; rechaza versiones de llave distintas a la activa.
   */
  decrypt(
    secretCiphertext: Uint8Array<ArrayBufferLike>,
    iv: Uint8Array<ArrayBufferLike>,
    authTag: Uint8Array<ArrayBufferLike>,
    keyVersion: number,
  ): string {
    if (keyVersion !== this.config.mfaKeyVersion) {
      throw new InternalServerErrorException(
        'El factor MFA requiere una versión de llave no disponible.',
      );
    }

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.config.mfaEncryptionKey, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(secretCiphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('No fue posible leer el factor MFA.');
    }
  }
}
