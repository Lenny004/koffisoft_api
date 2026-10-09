import { describe, expect, it } from 'vitest';

import { ARGON2ID_OPTIONS, PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashea y verifica Argon2id con los parámetros OWASP aprobados', async () => {
    const hash = await service.hash('Correct Horse Battery Staple 123!');

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/u);
    await expect(service.verify(hash, 'Correct Horse Battery Staple 123!')).resolves.toBe(true);
    await expect(service.verify(hash, 'otra contraseña')).resolves.toBe(false);
  });

  it('detecta hashes que necesitan rehash', async () => {
    const argon2 = await import('argon2');
    const oldHash = await argon2.hash('password', {
      ...ARGON2ID_OPTIONS,
      memoryCost: 4_096,
    });

    expect(service.needsRehash(oldHash)).toBe(true);
  });

  it('trata hashes inválidos como una verificación fallida', async () => {
    await expect(service.verify('not-a-phc-hash', 'password')).resolves.toBe(false);
  });
});
