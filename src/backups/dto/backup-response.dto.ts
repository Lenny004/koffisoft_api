import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BackupStatus, BackupType } from '../../generated/prisma/enums.js';

export class BackupResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: BackupType })
  type!: BackupType;

  @ApiProperty({ enum: BackupStatus })
  status!: BackupStatus;

  @ApiPropertyOptional({
    description: 'Tamaño del artefacto en bytes como cadena segura para JSON.',
  })
  sizeBytes!: string | null;

  @ApiPropertyOptional({ description: 'Checksum SHA-256 en hexadecimal.' })
  checksum!: string | null;

  @ApiPropertyOptional()
  expiresAt!: string | null;

  @ApiPropertyOptional()
  startedAt!: string | null;

  @ApiPropertyOptional()
  completedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ description: 'Mensaje seguro para diagnosticar un fallo del worker.' })
  errorMessage!: string | null;
}
