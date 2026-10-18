import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

import { NotificationSeverity, NotificationType } from '../../generated/prisma/enums.js';

export class NotificationListQueryDto {
  @ApiPropertyOptional({ description: 'Página solicitada (desde 1)', minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 1))
  @IsInt()
  @Min(1)
  readonly page: number = 1;

  @ApiPropertyOptional({ description: 'Tamaño de página', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  readonly pageSize: number = 20;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  readonly notificationType?: NotificationType;

  @ApiPropertyOptional({ enum: NotificationSeverity })
  @IsOptional()
  @IsEnum(NotificationSeverity)
  readonly severity?: NotificationSeverity;

  @ApiPropertyOptional({ description: 'Filtrar solo no leídas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  readonly unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Incluir archivadas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  readonly includeArchived?: boolean;
}

export class MarkNotificationAsReadDto {
  @ApiPropertyOptional({
    description: 'ID de la notificación, omitir para marcar todas como leídas',
  })
  @IsOptional()
  @IsString()
  readonly notificationId?: string;
}

export class ArchiveNotificationDto {
  @IsString()
  readonly notificationId!: string;
}
