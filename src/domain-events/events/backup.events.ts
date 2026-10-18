/**
 * Eventos del dominio de respaldos.
 */

export interface BackupCompletedEvent {
  readonly backupJobId: string;
  readonly type: string;
  readonly sizeBytes: bigint;
  readonly durationMs: number;
}

export interface BackupFailedEvent {
  readonly backupJobId: string;
  readonly type: string;
  readonly error: string;
}
