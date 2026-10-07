import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../config/app-config.js';
import { MfaCryptoService } from './mfa-crypto.service.js';

describe('MfaCryptoService', () => {
  const service = new MfaCryptoService({
    mfaEncryptionKey: Buffer.alloc(32, 9),
    mfaKeyVersion: 7,
  } as AppConfig);

  it('cifra y descifra una semilla TOTP con AES-256-GCM', () => {
    const encrypted = service.encrypt('JBSWY3DPEHPK3PXP');

    expect(encrypted.iv).toHaveLength(12);
    expect(encrypted.authTag).toHaveLength(16);
    expect(service.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, 7)).toBe(
      'JBSWY3DPEHPK3PXP',
    );
  });

  it('rechaza una etiqueta de autenticación alterada', () => {
    const encrypted = service.encrypt('JBSWY3DPEHPK3PXP');
    const tamperedTag = Buffer.from(encrypted.authTag);
    tamperedTag[0] = (tamperedTag[0] ?? 0) ^ 1;

    expect(() =>
      service.decrypt(encrypted.ciphertext, encrypted.iv, tamperedTag, encrypted.keyVersion),
    ).toThrow();
  });
});
