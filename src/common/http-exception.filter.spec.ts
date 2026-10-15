import { describe, expect, it, vi } from 'vitest';

import { HttpExceptionFilter } from './http-exception.filter.js';

function host() {
  const send = vi.fn();
  const status = vi.fn().mockReturnValue({ send });
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ sent: false, status }),
        getRequest: () => ({ url: '/resource' }),
      }),
    } as never,
    send,
    status,
  };
}

describe('HttpExceptionFilter', () => {
  it('mapea P2025 a 404 sin exponer el error de Prisma', () => {
    const fixture = host();

    new HttpExceptionFilter().catch({ code: 'P2025', meta: { cause: 'secret' } }, fixture.host);

    expect(fixture.status).toHaveBeenCalledWith(404);
    expect(fixture.send).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'El recurso no existe.' }),
    );
  });

  it('mapea P2002 a 409', () => {
    const fixture = host();

    new HttpExceptionFilter().catch({ code: 'P2002' }, fixture.host);

    expect(fixture.status).toHaveBeenCalledWith(409);
    expect(fixture.send).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, message: 'El recurso ya existe.' }),
    );
  });
});
