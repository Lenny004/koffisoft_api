import { ApiProperty } from '@nestjs/swagger';

import { NotificationSeverity, NotificationType } from '../../generated/prisma/enums.js';

export class NotificationResponseDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty({ enum: NotificationType })
  readonly notificationType!: NotificationType;

  @ApiProperty({ enum: NotificationSeverity })
  readonly severity!: NotificationSeverity;

  @ApiProperty()
  readonly title!: string;

  @ApiProperty()
  readonly body!: string;

  @ApiProperty({ nullable: true })
  readonly internalLink!: string | null;

  @ApiProperty({ nullable: true })
  readonly readAt!: string | null;

  @ApiProperty()
  readonly archived!: boolean;

  @ApiProperty()
  readonly createdAt!: string;
}

export class NotificationPageDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  readonly data!: NotificationResponseDto[];

  @ApiProperty()
  readonly meta!: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export class UnreadCountResponseDto {
  @ApiProperty()
  readonly unreadCount!: number;
}
