import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class MfaCodeDto {
  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Matches(/^\d{6}$/u, { message: 'El código MFA debe contener seis dígitos.' })
  code!: string;
}

export class RecoveryCodeDto {
  @ApiProperty({ example: 'AB12CD34EF56AB78CD90', minLength: 20, maxLength: 32 })
  @IsString()
  @MinLength(20)
  @MaxLength(32)
  code!: string;
}

export class MfaSetupDto {
  @ApiProperty({ example: 'Teléfono principal', required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;
}

export class PasswordAndMfaCodeDto extends MfaCodeDto {
  @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}

export class MfaSetupResponseDto {
  @ApiProperty({ example: 'Koffi-Soft:admin@example.com' })
  label!: string;

  @ApiProperty({ example: 'otpauth://totp/Koffi-Soft%3Aadmin%40example.com?secret=...' })
  uri!: string;

  @ApiProperty({ example: 'pending' })
  status!: string;
}

export class RecoveryCodesResponseDto {
  @ApiProperty({ type: [String], example: ['AB12CD34EF56AB78CD90'] })
  recoveryCodes!: string[];
}

export class MfaResultDto {
  @ApiProperty({ example: true })
  authenticated!: boolean;

  @ApiProperty({ example: true })
  mfaVerified!: boolean;

  @ApiProperty({ example: '2026-10-04T18:00:00.000Z' })
  expiresAt!: string;
}
