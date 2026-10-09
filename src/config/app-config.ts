import { Buffer } from 'node:buffer';

export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  readonly nodeEnv: string;
  readonly host: string;
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly cookieSecure: boolean;
  readonly cookieName: string;
  readonly mfaEncryptionKey: Buffer;
  readonly mfaKeyVersion: number;
  readonly mfaRequiredRoles: readonly string[];
  readonly sessionIdleMinutes: number;
  readonly sessionAbsoluteHours: number;
  readonly loginMaxAttempts: number;
  readonly loginLockMinutes: number;
}

type Environment = Record<string, string | undefined>;

function parseBoolean(value: string | undefined, name: string, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${name} debe ser true o false.`);
}

function parsePositiveNumber(value: string | undefined, name: string, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un número positivo.`);
  }

  return parsed;
}

function parseOrigins(value: string | undefined): readonly string[] {
  const origins = (value ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0 || origins.includes('*')) {
    throw new Error('CORS_ORIGIN debe contener uno o más orígenes exactos; no se permite *.');
  }

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`CORS_ORIGIN contiene un origen inválido: ${origin}.`);
    }

    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/') {
      throw new Error(`CORS_ORIGIN debe usar un origen HTTP(S) sin ruta: ${origin}.`);
    }
  }

  return origins.map((origin) => new URL(origin).origin);
}

function parseMfaKey(value: string | undefined, nodeEnv: string): Buffer {
  if (!value) {
    throw new Error(
      `Falta MFA_ENCRYPTION_KEY. Define una llave base64 de exactamente 32 bytes antes de arrancar (${nodeEnv}).`,
    );
  }

  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY debe decodificar exactamente 32 bytes (AES-256).');
  }

  return key;
}

function parseRoles(value: string | undefined): readonly string[] {
  const roles = (value ?? 'owner,admin,manager')
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role.length > 0);

  if (roles.some((role) => !/^[a-z][a-z0-9_.-]*$/u.test(role))) {
    throw new Error('MFA_REQUIRED_ROLES contiene un código de rol inválido.');
  }

  return roles;
}

function parseCookieName(value: string | undefined, secure: boolean): string {
  const requested = value?.trim() || 'koffisoft_session';
  if (requested.startsWith('__Host-') && !secure) {
    throw new Error('Una cookie __Host- requiere COOKIE_SECURE=true.');
  }

  const name = secure && !requested.startsWith('__Host-') ? `__Host-${requested}` : requested;

  if (name === '__Host-' || !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u.test(name)) {
    throw new Error('SESSION_COOKIE_NAME contiene caracteres inválidos.');
  }

  return name;
}

/** Valida y convierte la configuración necesaria para la frontera de autenticación. */
export function loadAppConfig(environment: Environment = process.env): AppConfig {
  const nodeEnv = environment.NODE_ENV ?? 'development';
  const cookieSecure = parseBoolean(environment.COOKIE_SECURE, 'COOKIE_SECURE', false);
  const mfaKeyVersion = parsePositiveNumber(environment.MFA_KEY_VERSION, 'MFA_KEY_VERSION', 1);

  if (!Number.isInteger(mfaKeyVersion) || mfaKeyVersion > 32_767) {
    throw new Error('MFA_KEY_VERSION debe ser un entero positivo menor o igual a 32767.');
  }

  return {
    nodeEnv,
    host: environment.HOST ?? '0.0.0.0',
    port: parsePositiveNumber(environment.PORT, 'PORT', 3000),
    corsOrigins: parseOrigins(environment.CORS_ORIGIN),
    cookieSecure,
    cookieName: parseCookieName(environment.SESSION_COOKIE_NAME, cookieSecure),
    mfaEncryptionKey: parseMfaKey(environment.MFA_ENCRYPTION_KEY, nodeEnv),
    mfaKeyVersion,
    mfaRequiredRoles: parseRoles(environment.MFA_REQUIRED_ROLES),
    sessionIdleMinutes: parsePositiveNumber(
      environment.SESSION_IDLE_MINUTES,
      'SESSION_IDLE_MINUTES',
      30,
    ),
    sessionAbsoluteHours: parsePositiveNumber(
      environment.SESSION_ABSOLUTE_HOURS,
      'SESSION_ABSOLUTE_HOURS',
      8,
    ),
    loginMaxAttempts: parsePositiveNumber(
      environment.AUTH_LOGIN_MAX_ATTEMPTS,
      'AUTH_LOGIN_MAX_ATTEMPTS',
      5,
    ),
    loginLockMinutes: parsePositiveNumber(
      environment.AUTH_LOGIN_LOCK_MINUTES,
      'AUTH_LOGIN_LOCK_MINUTES',
      15,
    ),
  };
}
