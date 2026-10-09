import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = Symbol('isPublic');

/** Marca una ruta que no necesita una sesión server-side. */
export const Public = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_PUBLIC_KEY, true);
