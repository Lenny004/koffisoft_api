import { SetMetadata } from '@nestjs/common';

export const ALLOW_MFA_PENDING_KEY = Symbol('allowMfaPending');
export const ALLOW_MFA_ENROLLMENT_KEY = Symbol('allowMfaEnrollment');
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
