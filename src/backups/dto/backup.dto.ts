import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { BackupType } from '../../generated/prisma/enums.js';

export class CreateBackupDto {
  @IsEnum(BackupType)
  type!: BackupType;
}

export class BackupListQueryDto {
  @IsOptional()
  @IsEnum(BackupType)
  type?: BackupType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 100;
}
