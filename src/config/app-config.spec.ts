import { describe, expect, it } from 'vitest';

import { loadAppConfig } from './app-config.js';

const key = Buffer.alloc(32, 7).toString('base64');

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'development',
    CORS_ORIGIN: 'http://localhost:5173',
    COOKIE_SECURE: 'false',
    MFA_ENCRYPTION_KEY: key,
    ...overrides,
  };
}

describe('loadAppConfig', () => {
  it('rechaza cookies no seguras en producción', () => {
    expect(() =>
      loadAppConfig(environment({ NODE_ENV: 'production', CORS_ORIGIN: 'https://admin.example' })),
    ).toThrow('COOKIE_SECURE=true');
  });

  it('rechaza CORS HTTP en producción aunque la cookie sea segura', () => {
    expect(() =>
      loadAppConfig(environment({ NODE_ENV: 'production', COOKIE_SECURE: 'true' })),
    ).toThrow('CORS_ORIGIN');
  });

  it('normaliza la cookie segura a __Host- y acepta solo orígenes HTTPS', () => {
    const config = loadAppConfig(
      environment({
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        CORS_ORIGIN: 'https://admin.example,https://web.example',
      }),
    );

    expect(config.cookieName).toBe('__Host-koffisoft_session');
    expect(config.corsOrigins).toEqual(['https://admin.example', 'https://web.example']);
  });
});
