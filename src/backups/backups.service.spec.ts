import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { BackupStatus, BackupType } from '../generated/prisma/enums.js';
import type { AppConfig } from '../config/app-config.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../database/prisma.service.js';
import { BackupService, safeStoragePath } from './backups.service.js';
import type { BackupProcessRunner } from './backup-process.runner.js';

type BackupJobRow = Prisma.BackupJobGetPayload<object>;

const actorUserId = '41000000-0000-0000-0000-000000000001';
const jobId = '550e8400-e29b-41d4-a716-446655440000';

function makeJob(overrides: Partial<BackupJobRow> = {}): BackupJobRow {
  return {
    id: jobId,
    type: BackupType.Database,
    status: BackupStatus.Running,
    sizeBytes: null,
    checksum: null,
    storageKey: null,
    expiresAt: new Date('2026-11-14T00:00:00.000Z'),
    actorUserId,
    startedAt: new Date('2026-10-15T00:00:00.000Z'),
    completedAt: null,
    errorMessage: null,
    createdAt: new Date('2026-10-15T00:00:00.000Z'),
    updatedAt: new Date('2026-10-15T00:00:00.000Z'),
    ...overrides,
  };
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), 'koffisoft-backup-'));
  const uploads = join(root, 'uploads');
  await mkdir(uploads);
  const config = {
    databaseUrl: 'postgresql://backup_user@localhost:5432/koffisoft_local',
    backupsEnabled: true,
    backupStorageRoot: root,
    uploadsDirectory: uploads,
    pgDumpPath: 'pg_dump',
    tarPath: 'tar',
    backupRetentionDays: 30,
    backupMaxSizeBytes: 1024 * 1024,
    backupScheduleMinutes: 0,
  } as AppConfig;
  const processRunner = {
    run: vi.fn(async (_command: string, args: readonly string[]) => {
      const fileArgument = args.find((argument) => argument.startsWith('--file='));
      if (!fileArgument) throw new Error('El proceso de prueba no recibió una salida.');
      const outputPath = fileArgument.slice('--file='.length);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, 'backup fixture');
      return { exitCode: 0, stderr: '' };
    }),
  } as unknown as BackupProcessRunner;
  const row = makeJob();
  const prisma = {
    backupJob: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue(row),
      update: vi
        .fn()
        .mockImplementation(async ({ data }: { data: Partial<BackupJobRow> }) => makeJob(data)),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  } as unknown as PrismaService;
  const service = new BackupService(prisma, config, processRunner, {} as never);
  return { root, uploads, config, processRunner, prisma, service, row };
}

describe('BackupService', () => {
  it('genera un dump con proceso mockeado, checksum y referencia relativa', async () => {
    const context = await setup();

    await context.service.runJob(jobId, { requestId: 'request-1' });

    expect(context.processRunner.run).toHaveBeenCalledWith(
      'pg_dump',
      expect.arrayContaining(['--format=custom', expect.stringContaining('--file=')]),
      expect.objectContaining({ env: expect.objectContaining({ PGDATABASE: 'koffisoft_local' }) }),
    );
    expect(context.prisma.backupJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: jobId },
        data: expect.objectContaining({
          status: BackupStatus.Succeeded,
          checksum: expect.any(String),
        }),
      }),
    );
    const storedFile = join(context.root, jobId, `${jobId}.dump`);
    expect(await readFile(storedFile, 'utf8')).toBe('backup fixture');

    await rm(context.root, { recursive: true, force: true });
  });

  it('marca el job como fallido y no traga el error del proceso', async () => {
    const context = await setup();
    vi.mocked(context.processRunner.run).mockRejectedValueOnce(
      new Error('pg_dump no está instalado'),
    );

    await context.service.runJob(jobId);

    expect(context.prisma.backupJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BackupStatus.Failed,
          errorMessage: 'pg_dump no está instalado',
        }),
      }),
    );
    expect(context.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'backups.failed' }) }),
    );

    await rm(context.root, { recursive: true, force: true });
  });

  it('rechaza traversal al resolver referencias de almacenamiento', () => {
    expect(() => safeStoragePath('var/backups', '../secrets.dump')).toThrow(
      'sale del directorio configurado',
    );
  });

  it('verifica checksum y entrega el stream autenticado solo a un job vigente', async () => {
    const context = await setup();
    const content = 'download fixture';
    const checksum = createHash('sha256').update(content).digest('hex');
    const storageKey = `${jobId}/${jobId}.dump`;
    const filePath = safeStoragePath(context.root, storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
    vi.mocked(context.prisma.backupJob.findUnique).mockResolvedValueOnce(
      makeJob({
        status: BackupStatus.Succeeded,
        sizeBytes: BigInt(Buffer.byteLength(content)),
        checksum,
        storageKey,
      }),
    );

    const download = await context.service.openDownload(jobId, actorUserId, {});
    let received = '';
    for await (const chunk of download.stream) received += chunk.toString();
    expect(received).toBe(content);
    expect(download.checksum).toBe(checksum);
    expect(context.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'backups.downloaded' }) }),
    );

    await rm(context.root, { recursive: true, force: true });
  });

  it('aplica retención y conserva el registro con estado expirado', async () => {
    const context = await setup();
    const expired = makeJob({
      status: BackupStatus.Succeeded,
      expiresAt: new Date('2026-10-01T00:00:00.000Z'),
      storageKey: `${jobId}/${jobId}.dump`,
    });
    vi.mocked(context.prisma.backupJob.findMany).mockResolvedValueOnce([expired]);

    const cleaned = await context.service.cleanupExpired();

    expect(cleaned).toBe(1);
    expect(context.prisma.backupJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: BackupStatus.Expired } }),
    );
    expect(context.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'backups.expired' }) }),
    );

    await rm(context.root, { recursive: true, force: true });
  });
});
