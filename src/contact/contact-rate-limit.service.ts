import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

/** Rate limit local por IP y sede; en despliegues múltiples debe sustituirse por un almacén compartido. */
@Injectable()
export class ContactRateLimitService {
  private readonly attempts = new Map<string, number[]>();

  assertAllowed(key: string, now = Date.now()): void {
    const active = (this.attempts.get(key) ?? []).filter(
      (timestamp) => now - timestamp < WINDOW_MS,
    );
    if (active.length >= MAX_ATTEMPTS) {
      throw new HttpException(
        'Demasiados mensajes. Espera un momento e inténtalo de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    active.push(now);
    this.attempts.set(key, active);
  }
}
