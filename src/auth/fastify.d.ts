import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: import('./auth.types.js').AuthContext;
  }
}

export type RequestWithAuth = FastifyRequest & {
  auth?: import('./auth.types.js').AuthContext;
};
