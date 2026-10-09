import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = Symbol('requiredPermissions');

/** Declara los permisos efectivos que la ruta exige; todos deben estar presentes. */
export const RequirePermissions = (...permissions: string[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
