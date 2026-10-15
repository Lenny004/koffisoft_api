import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';

import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { BackupStatus, BackupType } from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import type { RequestMetadata } from '../auth/auth.types.js';
import { BackupProcessError, BackupProcessRunner } from './backup-process.runner.js';
import type { BackupResponseDto } from './dto/backup-response.dto.js';

const BACKUP_ENTITY_TYPE = 'backup_job';
const ERROR_DETAILS_MAX_LENGTH = 700;

interface BackupArtifact {
  readonly tempPath: string;
  readonly artifactName: string;
}

interface BackupDownload {
  readonly stream: ReturnType<typeof createReadStream>;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly checksum: string;
}

type BackupJobRow = Prisma.BackupJobGetPayload<object>;

/** Coordina artefactos locales de pg_dump/tar y conserva solo sus referencias en Prisma. */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly processRunner: BackupProcessRunner,
  ) {}

  async list(type?: BackupType, limit = 100): Promise<BackupResponseDto[]> {
    const jobs = await this.prisma.backupJob.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return jobs.map(toResponse);
  }

  async create(
    type: BackupType,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<BackupResponseDto> {
    this.assertEnabled();
    const job = await this.createPending(type, actorUserId);
    await this.recordAudit('backups.created', job, actorUserId, metadata);
    void this.runJob(job.id, metadata).catch((error: unknown) => {
      this.logger.error(`El worker de respaldos terminó inesperadamente para ${job.id}.`, error);
    });
    return toResponse(job);
  }

  async delete(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<BackupResponseDto> {
    const job = await this.requireJob(id);
    if (job.status === BackupStatus.Pending || job.status === BackupStatus.Running) {
      throw new ConflictException('No se puede eliminar un respaldo que todavía está en proceso.');
    }

    await this.removeStoredFile(job.storageKey);
    const expired = await this.prisma.backupJob.update({
      where: { id },
      data: { status: BackupStatus.Expired, expiresAt: new Date() },
    });
    await this.recordAudit('backups.deleted', expired, actorUserId, metadata);
    return toResponse(expired);
  }

  /** Reclama el job con una actualización condicional para que reintentos concurrentes sean inocuos. */
  async runJob(id: string, metadata: RequestMetadata = {}): Promise<void> {
    let claimed = false;
    let storedKey: string | undefined;
    try {
      const claim = await this.prisma.backupJob.updateMany({
        where: { id, status: BackupStatus.Pending },
        data: { status: BackupStatus.Running, startedAt: new Date(), errorMessage: null },
      });
      if (claim.count !== 1) return;
      claimed = true;

      const job = await this.requireJob(id);
      const artifact = await this.createArtifact(job.type, id);
      const fileStats = await stat(artifact.tempPath);
      this.assertFileSize(fileStats.size);
      const checksum = await checksumFile(artifact.tempPath);
      const storageKey = `${id}/${artifact.artifactName}`;
      storedKey = storageKey;
      const finalPath = safeStoragePath(this.config.backupStorageRoot, storageKey);

      await mkdir(dirname(finalPath), { recursive: true });
      await rename(artifact.tempPath, finalPath);

      const completed = await this.prisma.backupJob.update({
        where: { id },
        data: {
          status: BackupStatus.Succeeded,
          sizeBytes: BigInt(fileStats.size),
          checksum,
          storageKey,
          completedAt: new Date(),
          errorMessage: null,
        },
      });
      await this.recordAudit('backups.completed', completed, job.actorUserId, metadata);
    } catch (error) {
      const message = formatBackupError(error);
      this.logger.error(`Falló el respaldo ${id}: ${message}`);
      if (!claimed) return;

      try {
        if (storedKey) {
          try {
            await this.removeStoredFile(storedKey);
          } catch (cleanupError) {
            this.logger.error(`No se pudo limpiar el artefacto fallido ${id}.`, cleanupError);
          }
        }
        const failed = await this.prisma.backupJob.update({
          where: { id },
          data: {
            status: BackupStatus.Failed,
            completedAt: new Date(),
            errorMessage: message,
          },
        });
        await this.recordAudit('backups.failed', failed, failed.actorUserId, metadata);
      } catch (persistenceError) {
        this.logger.error(`No se pudo guardar el fallo del respaldo ${id}.`, persistenceError);
      }
    } finally {
      await rm(resolve(this.config.backupStorageRoot, '.tmp', id), {
        recursive: true,
        force: true,
      });
    }
  }

  async openDownload(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<BackupDownload> {
    const job = await this.requireJob(id);
    if (job.status !== BackupStatus.Succeeded || !job.storageKey || !job.checksum) {
      throw new ConflictException('El respaldo todavía no está disponible para descarga.');
    }
    if (job.expiresAt && job.expiresAt <= new Date()) {
      throw new GoneException('El respaldo ya expiró y no puede descargarse.');
    }

    const filePath = safeStoragePath(this.config.backupStorageRoot, job.storageKey);
    let fileStats: Awaited<ReturnType<typeof stat>>;
    try {
      fileStats = await stat(filePath);
    } catch {
      throw new NotFoundException('El archivo del respaldo no está disponible.');
    }
    if (!fileStats.isFile())
      throw new NotFoundException('El archivo del respaldo no está disponible.');
    if (job.sizeBytes !== null && BigInt(fileStats.size) !== job.sizeBytes) {
      throw new ConflictException('El tamaño del respaldo no coincide con su registro.');
    }
    if ((await checksumFile(filePath)) !== job.checksum) {
      throw new ConflictException('El checksum del respaldo no coincide con su registro.');
    }

    await this.recordAudit('backups.downloaded', job, actorUserId, metadata);
    return {
      stream: createReadStream(filePath),
      fileName: basename(job.storageKey),
      sizeBytes: fileStats.size,
      checksum: job.checksum,
    };
  }

  async cleanupExpired(metadata: RequestMetadata = {}): Promise<number> {
    const jobs = await this.prisma.backupJob.findMany({
      where: {
        expiresAt: { lte: new Date() },
        status: { in: [BackupStatus.Succeeded, BackupStatus.Failed] },
      },
    });
    let cleaned = 0;
    for (const job of jobs) {
      try {
        await this.removeStoredFile(job.storageKey);
        const expired = await this.prisma.backupJob.update({
          where: { id: job.id },
          data: { status: BackupStatus.Expired },
        });
        await this.recordAudit('backups.expired', expired, null, metadata);
        cleaned += 1;
      } catch (error) {
        this.logger.error(`No se pudo aplicar retención al respaldo ${job.id}.`, error);
      }
    }
    return cleaned;
  }

  async runScheduled(): Promise<void> {
    if (!this.config.backupsEnabled) return;
    const activeJob = await this.prisma.backupJob.findFirst({
      where: { status: { in: [BackupStatus.Pending, BackupStatus.Running] } },
      select: { id: true },
    });
    if (activeJob) return;

    const job = await this.createPending(BackupType.Full, null);
    await this.recordAudit('backups.created', job, null, {});
    void this.runJob(job.id).catch((error: unknown) => {
      this.logger.error(`El worker programado terminó inesperadamente para ${job.id}.`, error);
    });
  }

  private async createPending(type: BackupType, actorUserId: string | null): Promise<BackupJobRow> {
    return this.prisma.backupJob.create({
      data: {
        type,
        status: BackupStatus.Pending,
        actorUserId,
        expiresAt: new Date(Date.now() + this.config.backupRetentionDays * 86_400_000),
      },
    });
  }

  private async createArtifact(type: BackupType, id: string): Promise<BackupArtifact> {
    const tempDirectory = resolve(this.config.backupStorageRoot, '.tmp', id);
    await mkdir(tempDirectory, { recursive: true });
    const artifactName = type === BackupType.Database ? `${id}.dump` : `${id}.tar.gz`;
    const artifactPath = resolve(tempDirectory, artifactName);

    if (type === BackupType.Database || type === BackupType.Full) {
      const dumpPath =
        type === BackupType.Database ? artifactPath : resolve(tempDirectory, `${id}.dump`);
      await this.runPgDump(dumpPath);
      if (type === BackupType.Full)
        await this.runFullArchive(artifactPath, tempDirectory, dumpPath);
    } else {
      await this.runUploadsArchive(artifactPath);
    }

    return { tempPath: artifactPath, artifactName };
  }

  private async runPgDump(outputPath: string): Promise<void> {
    const result = await this.processRunner.run(
      this.config.pgDumpPath,
      [
        '--format=custom',
        '--no-owner',
        '--no-acl',
        `--file=${outputPath}`,
        `--dbname=${this.databaseTarget()}`,
      ],
      { env: this.pgProcessEnvironment() },
    );
    if (result.exitCode !== 0)
      throw new BackupProcessError(this.config.pgDumpPath, result.exitCode, result.stderr);
  }

  private async runUploadsArchive(outputPath: string): Promise<void> {
    await this.assertUploadsDirectory();
    await this.runTar(outputPath, ['--directory', this.config.uploadsDirectory, '.']);
  }

  private async runFullArchive(
    outputPath: string,
    tempDirectory: string,
    dumpPath: string,
  ): Promise<void> {
    await this.assertUploadsDirectory();
    await this.runTar(outputPath, [
      '--directory',
      tempDirectory,
      basename(dumpPath),
      '--directory',
      this.config.uploadsDirectory,
      '.',
    ]);
  }

  private async runTar(outputPath: string, inputs: readonly string[]): Promise<void> {
    const result = await this.processRunner.run(this.config.tarPath, [
      '--create',
      '--gzip',
      `--file=${outputPath}`,
      ...inputs,
    ]);
    if (result.exitCode !== 0)
      throw new BackupProcessError(this.config.tarPath, result.exitCode, result.stderr);
  }

  private async assertUploadsDirectory(): Promise<void> {
    try {
      const directory = await stat(this.config.uploadsDirectory);
      if (!directory.isDirectory()) throw new Error('no es una carpeta');
    } catch {
      throw new Error('La carpeta de uploads configurada no existe o no es accesible.');
    }
  }

  private pgProcessEnvironment(): NodeJS.ProcessEnv {
    const parsed = new URL(this.config.databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      throw new Error('DATABASE_URL debe usar el protocolo PostgreSQL para generar respaldos.');
    }

    return {
      PGHOST: parsed.hostname,
      PGPORT: parsed.port || '5432',
      PGUSER: decodeURIComponent(parsed.username),
      PGPASSWORD: decodeURIComponent(parsed.password),
      PGDATABASE: decodeURIComponent(parsed.pathname.replace(/^\//u, '')),
      PGSSLMODE: parsed.searchParams.get('sslmode') ?? undefined,
    };
  }

  private databaseTarget(): string {
    const parsed = new URL(this.config.databaseUrl);
    parsed.password = '';
    return parsed.toString();
  }

  private assertFileSize(sizeBytes: number): void {
    if (sizeBytes > this.config.backupMaxSizeBytes) {
      throw new Error('El archivo de respaldo supera el límite configurado.');
    }
  }

  private async removeStoredFile(storageKey: string | null): Promise<void> {
    if (!storageKey) return;
    await rm(safeStoragePath(this.config.backupStorageRoot, storageKey), { force: true });
  }

  private async requireJob(id: string): Promise<BackupJobRow> {
    const job = await this.prisma.backupJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Respaldo no encontrado.');
    return job;
  }

  private assertEnabled(): void {
    if (!this.config.backupsEnabled) {
      throw new ServiceUnavailableException('Los respaldos están deshabilitados en este entorno.');
    }
  }

  private async recordAudit(
    action: string,
    job: BackupJobRow,
    actorUserId: string | null,
    metadata: RequestMetadata,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        entityType: BACKUP_ENTITY_TYPE,
        entityId: job.id,
        afterData: {
          type: job.type,
          status: job.status,
          sizeBytes: job.sizeBytes?.toString() ?? null,
          checksum: job.checksum,
        } as Prisma.InputJsonValue,
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
      },
    });
  }
}

export function safeStoragePath(storageRoot: string, storageKey: string): string {
  if (!storageKey || storageKey.includes('\0'))
    throw new Error('La referencia de almacenamiento no es válida.');
  const root = resolve(storageRoot);
  const candidate = resolve(root, storageKey);
  const pathFromRoot = relative(root, candidate);
  if (!pathFromRoot || pathFromRoot.startsWith('..') || resolve(pathFromRoot) === resolve('..')) {
    throw new Error('La referencia de almacenamiento sale del directorio configurado.');
  }
  return candidate;
}

export async function checksumFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Uint8Array);
  return hash.digest('hex');
}

function formatBackupError(error: unknown): string {
  const details =
    error instanceof BackupProcessError
      ? `${error.message} ${error.stderr}`
      : error instanceof Error
        ? error.message
        : 'Error desconocido al generar el respaldo.';
  return details
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/giu, '$1[redacted]@')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, ERROR_DETAILS_MAX_LENGTH);
}

function toResponse(job: BackupJobRow): BackupResponseDto {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    sizeBytes: job.sizeBytes?.toString() ?? null,
    checksum: job.checksum,
    expiresAt: job.expiresAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    errorMessage: job.errorMessage,
  };
}
