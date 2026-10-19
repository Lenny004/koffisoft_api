import { SetMetadata } from '@nestjs/common';

/** Clave de metadatos que relaja MFA pendiente en SessionGuard. */
export const ALLOW_MFA_PENDING_KEY = Symbol('allowMfaPending');
/** Clave de metadatos que permite el alta inicial de MFA. */
export const ALLOW_MFA_ENROLLMENT_KEY = Symbol('allowMfaEnrollment');
/** Clave de metadatos que permite cambio de contraseña obligatorio. */
export const ALLOW_PASSWORD_CHANGE_KEY = Symbol('allowPasswordChange');

/** Permite que una sesión pendiente complete la verificación TOTP o de recuperación. */
export const AllowMfaPending = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_MFA_PENDING_KEY, true);

/** Permite únicamente el alta inicial de MFA para roles que la exigen. */
export const AllowMfaEnrollment = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_MFA_ENROLLMENT_KEY, true);

/** Permite cambiar la contrasena cuando un administrador marco la cuenta. */
export const AllowPasswordChange = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
