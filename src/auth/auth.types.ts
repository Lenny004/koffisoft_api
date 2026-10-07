import type { FastifyRequest } from 'fastify';

export interface RequestMetadata {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface AccessSnapshot {
  readonly user: {
    readonly id: string;
    readonly username: string;
    readonly email: string;
    readonly status: string;
    readonly passwordChangedAt: Date;
    readonly emailVerifiedAt: Date | null;
  };
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly mfa: {
    readonly enabled: boolean;
    readonly required: boolean;
    readonly factors: readonly MfaFactorSummary[];
  };
}

export interface MfaFactorSummary {
  readonly id: string;
  readonly factorType: string;
  readonly label: string;
  readonly status: string;
  readonly verifiedAt: Date | null;
  readonly disabledAt: Date | null;
  readonly keyVersion: number;
}

export interface AuthContext extends AccessSnapshot {
  readonly userId: string;
  readonly sessionId: string;
  readonly mfaVerified: boolean;
}

export type AuthenticatedRequest = FastifyRequest & {
  auth?: AuthContext;
};

export function requestMetadata(request: FastifyRequest): RequestMetadata {
  const userAgent = request.headers['user-agent'];
  const requestId = request.id;

  return {
    ipAddress: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 2000) : undefined,
    requestId: typeof requestId === 'string' ? requestId.slice(0, 100) : undefined,
  };
}
