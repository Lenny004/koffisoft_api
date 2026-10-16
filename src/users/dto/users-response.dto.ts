import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { EmployeeStatus, JobCode, UserStatus } from '../../generated/prisma/enums.js';

export class UserRoleSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  active!: boolean;
}

export class UserEmployeeSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  employeeCode!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ enum: JobCode })
  jobCode!: JobCode;

  @ApiProperty({ enum: EmployeeStatus })
  status!: EmployeeStatus;
}

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty()
  failedLoginAttempts!: number;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lockedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lockedUntil!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastLoginAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  emailVerifiedAt!: string | null;

  @ApiProperty({ type: () => [UserRoleSummaryDto] })
  roles!: UserRoleSummaryDto[];

  @ApiPropertyOptional({ type: () => UserEmployeeSummaryDto, nullable: true })
  employee!: UserEmployeeSummaryDto | null;

  @ApiProperty()
  mfaEnabled!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PageMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class UserPageDto {
  @ApiProperty({ type: () => [UserResponseDto] })
  data!: UserResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class EmployeeUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;
}

export class EmployeeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  locationId!: string;

  @ApiProperty()
  employeeCode!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ enum: JobCode })
  jobCode!: JobCode;

  @ApiProperty({ enum: EmployeeStatus })
  status!: EmployeeStatus;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiProperty({ format: 'date' })
  hireDate!: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  terminationDate!: string | null;

  @ApiPropertyOptional({ type: () => EmployeeUserSummaryDto, nullable: true })
  user!: EmployeeUserSummaryDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class EmployeePageDto {
  @ApiProperty({ type: () => [EmployeeResponseDto] })
  data!: EmployeeResponseDto[];

  @ApiProperty({ type: () => PageMetaDto })
  meta!: PageMetaDto;
}

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  businessId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ type: () => [String] })
  permissions!: string[];
}

export class PermissionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  active!: boolean;
}
