import { describe, expect, it } from 'vitest';

import { ContactRateLimitService } from './contact-rate-limit.service.js';

describe('ContactRateLimitService', () => {
  it('permite cinco envíos y bloquea el sexto dentro de la ventana', () => {
    const service = new ContactRateLimitService();

    for (let attempt = 0; attempt < 5; attempt += 1) service.assertAllowed('ip:sede', 1_000);

    expect(() => service.assertAllowed('ip:sede', 1_001)).toThrow('Demasiados mensajes');
    expect(() => service.assertAllowed('ip:sede', 61_001)).not.toThrow();
  });
});
