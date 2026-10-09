import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { AuthEventType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import type { RequestMetadata } from '../auth.types.js';
import { AuditService } from './audit.service.js';

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly mfaVerified: boolean;
}

export interface CreatedSession {
  readonly token: string;
  readonly record: SessionRecord;
}

function isSessionToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,}$/u.test(value);
}

/** Administra tokens opacos: el valor viaja en cookie y solo su SHA-256 llega a PostgreSQL. */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  async createSession(
    userId: string,
    mfaVerified: boolean,
    metadata: RequestMetadata,
    now = new Date(),
    absoluteExpiresAt?: Date,
  ): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt =
      absoluteExpiresAt ??
      new Date(now.getTime() + this.config.sessionAbsoluteHours * 60 * 60 * 1000);
    const record = await this.prisma.userSession.create({
      data: {
        userId,
        sessionTokenHash: this.hashToken(token),
        createdAt: now,
        expiresAt,
        lastUsedAt: now,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        mfaVerified,
      },
    });

    await this.audit.record(AuthEventType.SessionCreated, metadata, {
      userId,
      sessionId: record.id,
      details: { mfaVerified },
    });

    return { token, record };
  }

  async rotateSession(
    current: SessionRecord,
    mfaVerified: boolean,
    metadata: RequestMetadata,
    reason: string,
  ): Promise<CreatedSession> {
    await this.revokeSession(current.id, reason, metadata, current.userId);
    return this.createSession(current.userId, mfaVerified, metadata, new Date(), current.expiresAt);
  }

  async findValidSession(
    token: string,
    metadata: RequestMetadata = {},
    now = new Date(),
  ): Promise<SessionRecord | null> {
    if (!isSessionToken(token)) {
      return null;
    }

    const session = await this.prisma.userSession.findUnique({
      where: { sessionTokenHash: this.hashToken(token) },
    });

    if (!session || session.revokedAt || session.expiresAt <= now) {
      return null;
    }

    const lastActivity = session.lastUsedAt ?? session.createdAt;
    const idleDeadline = new Date(
      lastActivity.getTime() + this.config.sessionIdleMinutes * 60 * 1000,
    );

    if (idleDeadline <= now) {
      await this.revokeSession(session.id, 'idle_timeout', metadata, session.userId);
      return null;
    }

    const touched = await this.prisma.userSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { lastUsedAt: now },
    });

    if (touched.count !== 1) {
      return null;
    }

    return {
      ...session,
      lastUsedAt: now,
    };
  }

  async revokeToken(
    token: string | undefined,
    reason: string,
    metadata: RequestMetadata,
  ): Promise<boolean> {
    if (!token || !isSessionToken(token)) {
      return false;
    }

    const session = await this.prisma.userSession.findUnique({
      where: { sessionTokenHash: this.hashToken(token) },
    });

    if (!session) {
      return false;
    }

    return this.revokeSession(session.id, reason, metadata, session.userId);
  }

  async revokeSession(
    sessionId: string,
    reason: string,
    metadata: RequestMetadata,
    userId?: string,
  ): Promise<boolean> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: reason.slice(0, 120),
      },
    });

    if (result.count === 1) {
      await this.audit.record(AuthEventType.SessionRevoked, metadata, {
        userId,
        sessionId,
        details: { reason },
      });
      return true;
    }

    return false;
  }

  async revokeAll(
    userId: string,
    metadata: RequestMetadata,
    reason: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: {
        revokedAt: new Date(),
        revokedReason: reason.slice(0, 120),
      },
    });

    if (result.count > 0) {
      await this.audit.record(AuthEventType.SessionRevoked, metadata, {
        userId,
        details: { reason, count: result.count },
      });
    }

    return result.count;
  }

  setCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    reply.setCookie(this.config.cookieName, token, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
      maxAge,
    });
  }

  clearCookie(reply: FastifyReply): void {
    reply.clearCookie(this.config.cookieName, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
    });
  }

  getToken(request: { cookies?: Record<string, string | undefined> }): string | undefined {
    return request.cookies?.[this.config.cookieName];
  }
}
