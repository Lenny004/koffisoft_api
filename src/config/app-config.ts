import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';

/**
 * Token de inyección para acceder a la configuración validada de la aplicación.
 */
export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  readonly nodeEnv: string;
  readonly host: string;
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly publicSiteUrl: string;
  readonly cookieSecure: boolean;
  readonly cookieName: string;
  readonly mfaEncryptionKey: Buffer;
  readonly mfaKeyVersion: number;
  readonly mfaRequiredRoles: readonly string[];
  readonly sessionIdleMinutes: number;
  readonly sessionAbsoluteHours: number;
  readonly loginMaxAttempts: number;
  readonly loginLockMinutes: number;
  readonly databaseUrl: string;
  readonly backupsEnabled: boolean;
  readonly backupStorageRoot: string;
  readonly uploadsDirectory: string;
  readonly pgDumpPath: string;
  readonly tarPath: string;
  readonly backupRetentionDays: number;
  readonly backupMaxSizeBytes: number;
  readonly backupScheduleMinutes: number;
  readonly mailerTransport: 'console' | 'smtp';
  readonly smtpHost?: string;
  readonly smtpPort: number;
  readonly smtpSecure: boolean;
  readonly smtpUser?: string;
  readonly smtpPassword?: string;
}

type Environment = Record<string, string | undefined>;
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

/**
 * Interpreta variables de entorno booleanas; lanza si el valor no es true ni false.
 */
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

/**
 * Parsea un entero positivo desde entorno o usa el valor por defecto indicado.
 */
function parsePositiveNumber(value: string | undefined, name: string, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un número positivo.`);
  }

  return parsed;
}

/**
 * Parsea un número ≥ 0 desde entorno o usa el valor por defecto indicado.
 */
function parseNonNegativeNumber(value: string | undefined, name: string, fallback: number): number {
  const parsed = value === undefined ? fallback : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} debe ser un número mayor o igual que cero.`);
  }

  return parsed;
}

/**
 * Resuelve una ruta de filesystem absoluta y rechaza entradas vacías o con NUL.
 */
function parsePath(value: string | undefined, name: string, fallback: string): string {
  const candidate = (value ?? fallback).trim();
  if (!candidate || candidate.includes('\0')) {
    throw new Error(`${name} debe ser una ruta no vacía.`);
  }

  return resolve(candidate);
}

/**
 * Valida el nombre de un ejecutable externo sin caracteres nulos.
 */
function parseCommand(value: string | undefined, name: string, fallback: string): string {
  const candidate = (value ?? fallback).trim();
  if (!candidate || candidate.includes('\0')) {
    throw new Error(`${name} debe ser un comando no vacío.`);
  }

  return candidate;
}

/**
 * Valida orígenes CORS exactos HTTP(S) sin comodines ni rutas en producción.
 */
function parseOrigins(value: string | undefined, nodeEnv: string): readonly string[] {
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

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      (nodeEnv === 'production' && parsed.protocol !== 'https:') ||
      parsed.pathname !== '/'
    ) {
      throw new Error(`CORS_ORIGIN debe usar un origen HTTP(S) sin ruta: ${origin}.`);
    }
  }

  return origins.map((origin) => new URL(origin).origin);
}

/**
 * Normaliza la URL pública del sitio sin credenciales ni barra final redundante.
 */
function parsePublicSiteUrl(value: string | undefined): string {
  const candidate = (value ?? 'http://localhost:5173').trim().replace(/\/$/u, '');
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('PUBLIC_SITE_URL debe ser una URL HTTP(S) valida.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('PUBLIC_SITE_URL debe usar HTTP(S) sin credenciales.');
  }

  return parsed.origin + parsed.pathname.replace(/\/$/u, '');
}

/**
 * Decodifica la llave AES-256 de MFA desde Base64 y exige exactamente 32 bytes.
 */
function parseMfaKey(value: string | undefined, nodeEnv: string): Buffer {
  if (!value) {
    throw new Error(
      `Falta MFA_ENCRYPTION_KEY. Define una llave base64 de exactamente 32 bytes antes de arrancar (${nodeEnv}).`,
    );
  }

  if (!BASE64_RE.test(value)) {
    throw new Error('MFA_ENCRYPTION_KEY debe ser Base64 valido.');
  }

  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY debe decodificar exactamente 32 bytes (AES-256).');
  }

  return key;
}

/**
 * Parsea la lista de roles que requieren MFA y valida el formato de cada código.
 */
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

/**
 * Deriva el nombre de cookie de sesión respetando el prefijo __Host- cuando aplica.
 */
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
  if (nodeEnv === 'production' && !cookieSecure) {
    throw new Error('COOKIE_SECURE=true es obligatorio en producción.');
  }
  const mfaKeyVersion = parsePositiveNumber(environment.MFA_KEY_VERSION, 'MFA_KEY_VERSION', 1);

  if (!Number.isInteger(mfaKeyVersion) || mfaKeyVersion > 32_767) {
    throw new Error('MFA_KEY_VERSION debe ser un entero positivo menor o igual a 32767.');
  }

  return {
    nodeEnv,
    host: environment.HOST ?? '0.0.0.0',
    port: parsePositiveNumber(environment.PORT, 'PORT', 3000),
    corsOrigins: parseOrigins(environment.CORS_ORIGIN, nodeEnv),
    publicSiteUrl: parsePublicSiteUrl(environment.PUBLIC_SITE_URL),
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
    databaseUrl: environment.DATABASE_URL ?? 'postgresql://localhost:5432/koffisoft_local',
    backupsEnabled: parseBoolean(environment.BACKUP_ENABLED, 'BACKUP_ENABLED', false),
    backupStorageRoot: parsePath(
      environment.BACKUP_STORAGE_ROOT,
      'BACKUP_STORAGE_ROOT',
      './var/backups',
    ),
    uploadsDirectory: parsePath(environment.UPLOADS_DIRECTORY, 'UPLOADS_DIRECTORY', './uploads'),
    pgDumpPath: parseCommand(environment.PG_DUMP_PATH, 'PG_DUMP_PATH', 'pg_dump'),
    tarPath: parseCommand(environment.TAR_PATH, 'TAR_PATH', 'tar'),
    backupRetentionDays: parsePositiveNumber(
      environment.BACKUP_RETENTION_DAYS,
      'BACKUP_RETENTION_DAYS',
      30,
    ),
    backupMaxSizeBytes: parsePositiveNumber(
      environment.BACKUP_MAX_SIZE_BYTES,
      'BACKUP_MAX_SIZE_BYTES',
      50 * 1024 * 1024 * 1024,
    ),
    backupScheduleMinutes: parseNonNegativeNumber(
      environment.BACKUP_SCHEDULE_MINUTES,
      'BACKUP_SCHEDULE_MINUTES',
      0,
    ),
    mailerTransport: (environment.MAILER_TRANSPORT?.toLowerCase() === 'smtp'
      ? 'smtp'
      : 'console') as 'console' | 'smtp',
    smtpHost: environment.SMTP_HOST,
    smtpPort: parsePositiveNumber(environment.SMTP_PORT, 'SMTP_PORT', 587),
    smtpSecure: parseBoolean(environment.SMTP_SECURE, 'SMTP_SECURE', false),
    smtpUser: environment.SMTP_USER,
    smtpPassword: environment.SMTP_PASSWORD,
  };
}
