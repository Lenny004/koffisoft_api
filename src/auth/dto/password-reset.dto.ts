import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'usuario@ejemplo.com' })
  @IsEmail()
  readonly email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  readonly token!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  readonly newPassword!: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty()
  readonly message!: string;
}
