import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ example: true })
  authenticated!: boolean;

  @ApiProperty({ example: true })
  requiresMfa!: boolean;

  @ApiProperty({ example: false })
  requiresMfaSetup!: boolean;

  @ApiProperty({ example: '2026-10-04T18:00:00.000Z' })
  expiresAt!: string;
}

export class MeResponseDto {
  @ApiProperty({
    example: {
      id: 'uuid',
      username: 'admin',
      email: 'admin@example.com',
      status: 'Active',
      passwordChangedAt: '2026-10-01T00:00:00.000Z',
      emailVerifiedAt: '2026-10-01T00:00:00.000Z',
    },
  })
  user!: Record<string, unknown>;

  @ApiProperty({ example: ['admin'] })
  roles!: string[];

  @ApiProperty({ example: ['auth.password.change'] })
  permissions!: string[];

  @ApiProperty({
    example: {
      enabled: true,
      required: true,
      verified: true,
      factors: [],
    },
  })
  mfa!: Record<string, unknown>;
}
