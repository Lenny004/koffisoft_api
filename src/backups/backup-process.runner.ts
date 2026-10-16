import { spawn } from 'node:child_process';
import { Injectable } from '@nestjs/common';

export interface BackupProcessResult {
  readonly exitCode: number;
  readonly stderr: string;
}

export interface BackupProcessOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
}

/** Ejecuta herramientas del sistema sin shell para evitar interpolación de rutas o argumentos. */
@Injectable()
export class BackupProcessRunner {
  run(
    command: string,
    args: readonly string[],
    options: BackupProcessOptions = {},
  ): Promise<BackupProcessResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...args], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        shell: false,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let stderr = '';

      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk: string) => {
        stderr = `${stderr}${chunk}`.slice(-20_000);
      });
      child.once('error', reject);
      child.once('close', (exitCode) => resolve({ exitCode: exitCode ?? 1, stderr }));
    });
  }
}

export class BackupProcessError extends Error {
  constructor(
    public readonly command: string,
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(`${command} terminó con código ${exitCode}.`);
    this.name = 'BackupProcessError';
  }
}
