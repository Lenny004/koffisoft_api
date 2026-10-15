import { describe, expect, it } from 'vitest';

import type { AppConfig } from '../../config/app-config.js';
import { CsrfGuard } from './csrf.guard.js';

function context(
  headers: Record<string, string>,
  method = 'POST',
  cookies?: Record<string, string>,
) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers, cookies }) }),
  } as never;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard({
    corsOrigins: ['http://localhost:5173'],
    cookieName: 'session',
  } as unknown as AppConfig);

  it('rechaza una escritura desde un origen no permitido', () => {
    expect(() => guard.canActivate(context({ origin: 'https://evil.example' }))).toThrow(
      'Origen no permitido.',
    );
  });

  it('rechaza una mutación sin encabezados de origen', () => {
    expect(() => guard.canActivate(context({}))).toThrow('Falta el origen de la solicitud.');
    expect(
      guard.canActivate(
        context({ origin: 'http://localhost:5173', referer: 'http://localhost:5173/login' }),
      ),
    ).toBe(true);
  });

  it('rechaza una mutación con cookie si faltan Origin y Referer', () => {
    expect(() => guard.canActivate(context({}, 'POST', { session: 'opaque-token' }))).toThrow(
      'Falta el origen de la solicitud.',
    );
  });
});
