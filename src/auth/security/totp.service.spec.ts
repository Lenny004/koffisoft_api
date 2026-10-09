import { describe, expect, it } from 'vitest';

import { TotpService } from './totp.service.js';

describe('TotpService', () => {
  const service = new TotpService();
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it.each<[number, string]>([
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
    [20_000_000_000, '353130'],
  ])('acepta el vector RFC 6238 de seis dígitos para %s', async (epoch, token) => {
    await expect(service.verifyCode(secret, token, epoch)).resolves.toEqual({
      timeStep: Math.floor(epoch / 30),
    });
  });

  it('acepta una ventana de un paso y devuelve el paso usado', async () => {
    await expect(service.verifyCode(secret, '287082', 60)).resolves.toEqual({ timeStep: 1 });
  });

  it('genera una URI otpauth sin guardar el secreto en la prueba', () => {
    const generated = service.generateSecret();
    const uri = service.generateUri('admin@example.com', generated);

    expect(generated.length).toBeGreaterThanOrEqual(16);
    expect(uri).toMatch(/^otpauth:\/\/totp\//u);
    expect(uri).toContain(encodeURIComponent(generated));
  });
});
