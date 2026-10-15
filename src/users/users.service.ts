import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import {
  EmployeeStatus,
  AuthEventType,
  MfaFactorStatus,
  MfaFactorType,
  UserStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../database/prisma.service.js';
import type { RequestMetadata } from '../auth/auth.types.js';
import { PasswordService } from '../auth/security/password.service.js';
import type {
  AssignUserRolesDto,
  CreateEmployeeDto,
  CreateUserDto,
  EmployeeListQueryDto,
  PermissionListQueryDto,
  RoleListQueryDto,
  UpdateEmployeeDto,
  UpdateUserDto,
  UserListQueryDto,
} from './dto/users.dto.js';
import type {
  EmployeePageDto,
  EmployeeResponseDto,
  PermissionResponseDto,
  RoleResponseDto,
  UserPageDto,
  UserResponseDto,
} from './dto/users-response.dto.js';

const ADMIN_ROLE_CODES = ['owner', 'admin'] as const;
const ROLE_RANK: Record<string, number> = { manager: 1, admin: 2, owner: 3 };

const userSelect = {
  id: true,
  username: true,
  email: true,
  status: true,
  mustChangePassword: true,
  failedLoginAttempts: true,
  lockedAt: true,
  lockedUntil: true,
  lastLoginAt: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      jobCode: true,
      status: true,
    },
  },
  roles: {
    where: { active: true, role: { active: true } },
    select: {
      active: true,
      role: { select: { id: true, code: true, name: true, active: true } },
    },
  },
  mfaFactors: {
    where: { factorType: MfaFactorType.Totp, status: MfaFactorStatus.Active },
    select: { id: true },
  },
} as const satisfies Prisma.UserSelect;

const employeeSelect = {
  id: true,
  locationId: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  jobCode: true,
  status: true,
  phone: true,
  email: true,
  hireDate: true,
  terminationDate: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, username: true, status: true } },
} as const satisfies Prisma.EmployeeSelect;

const roleSelect = {
  id: true,
  businessId: true,
  code: true,
  name: true,
  active: true,
  rolePermissions: {
    where: { active: true, permission: { active: true } },
    select: { permission: { select: { code: true } } },
  },
} as const satisfies Prisma.RoleSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;
type RoleRow = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;
type AuditData = Prisma.InputJsonObject;

/** Coordina el directorio administrativo, RBAC y sus invariantes de seguridad. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async listUsers(query: UserListQueryDto): Promise<UserPageDto> {
    const search = query.search || undefined;
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role
        ? {
            roles: {
              some: { active: true, role: { code: query.role, active: true } },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { employee: { firstName: { contains: search, mode: 'insensitive' } } },
              { employee: { lastName: { contains: search, mode: 'insensitive' } } },
              { employee: { employeeCode: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ username: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
        select: userSelect,
      }),
    ]);

    return {
      data: rows.map((row) => this.toUserResponse(row)),
      meta: this.pageMeta(query.page, query.pageSize, total),
    };
  }

  async getUser(id: string): Promise<UserResponseDto> {
    return this.toUserResponse(await this.requireUser(id));
  }

  async createUser(
    dto: CreateUserDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    const passwordHash = await this.passwords.hash(dto.password);
    const roleIds = this.uniqueIds(dto.roleIds);
    const row = await this.prisma.$transaction(async (tx) => {
      await this.assertUserIdentityAvailable(tx, dto.username, dto.email);
      await this.requireEmployeeForLink(tx, dto.employeeId, undefined, actorUserId);
      if (roleIds.length > 0) {
        await this.assertRoleAssignmentAuthority(tx, actorUserId, roleIds);
      }
      await this.requireActiveRoles(tx, roleIds, actorUserId);
      const created = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          status: UserStatus.Active,
          mustChangePassword: dto.mustChangePassword,
          ...(dto.employeeId ? { employeeId: dto.employeeId } : {}),
        },
        select: { id: true },
      });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: created.id, roleId, active: true })),
        });
      }
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'user.created',
        entityType: 'user',
        entityId: created.id,
        afterData: { username: dto.username, email: dto.email, employeeId: dto.employeeId ?? null },
      });
      return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: userSelect });
    });
    return this.toUserResponse(row);
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: userSelect });
      if (!current) throw new NotFoundException('Usuario no encontrado.');
      if (dto.username !== undefined || dto.email !== undefined) {
        await this.assertUserIdentityAvailable(
          tx,
          dto.username ?? current.username,
          dto.email ?? current.email,
          id,
        );
      }
      if (dto.employeeId !== undefined) {
        await this.requireEmployeeForLink(tx, dto.employeeId, id, actorUserId);
      }
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(dto.username === undefined ? {} : { username: dto.username }),
          ...(dto.email === undefined ? {} : { email: dto.email }),
          ...(dto.employeeId === undefined ? {} : { employeeId: dto.employeeId }),
        },
        select: userSelect,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'user.updated',
        entityType: 'user',
        entityId: id,
        beforeData: this.userAuditData(current),
        afterData: this.userAuditData(updated),
      });
      return updated;
    });
    return this.toUserResponse(row);
  }

  async activateUser(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    return this.changeUserStatus(id, UserStatus.Active, actorUserId, metadata);
  }

  async deactivateUser(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    if (id === actorUserId) throw new ForbiddenException('No puede desactivar su propia cuenta.');
    return this.changeUserStatus(id, UserStatus.Inactive, actorUserId, metadata);
  }

  async blockUser(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    if (id === actorUserId) throw new ForbiddenException('No puede bloquear su propia cuenta.');
    return this.changeUserStatus(id, UserStatus.Locked, actorUserId, metadata);
  }

  async assignRoles(
    id: string,
    dto: AssignUserRolesDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    const roleIds = this.uniqueIds(dto.roleIds);
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockAdminInvariant(tx);
      const current = await tx.user.findUnique({ where: { id }, select: userSelect });
      if (!current) throw new NotFoundException('Usuario no encontrado.');
      await this.assertRoleAssignmentAuthority(tx, actorUserId, roleIds);
      const roles = await this.requireActiveRoles(tx, roleIds, actorUserId);
      const currentAdminRoles = current.roles.filter(
        ({ role }) => role.active && this.isAdminRole(role.code),
      );
      const nextAdminRoles = roles.filter((role) => this.isAdminRole(role.code));
      if (id === actorUserId && currentAdminRoles.length > 0 && nextAdminRoles.length === 0) {
        throw new ForbiddenException('No puede quitarse su propio rol administrador.');
      }
      if (currentAdminRoles.length > 0 && nextAdminRoles.length === 0) {
        await this.assertAnotherActiveAdmin(tx, id);
      }
      await tx.userRole.updateMany({
        where: { userId: id, active: true },
        data: { active: false },
      });
      for (const roleId of roleIds) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: id, roleId } },
          update: { active: true, assignedAt: new Date() },
          create: { userId: id, roleId, active: true },
        });
      }
      const updated = await tx.user.findUniqueOrThrow({ where: { id }, select: userSelect });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'user.roles.updated',
        entityType: 'user',
        entityId: id,
        beforeData: { roleCodes: current.roles.map(({ role }) => role.code) },
        afterData: { roleCodes: updated.roles.map(({ role }) => role.code) },
      });
      return updated;
    });
    return this.toUserResponse(row);
  }

  async resetMfa(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockAdminInvariant(tx);
      const current = await tx.user.findUnique({ where: { id }, select: userSelect });
      if (!current) throw new NotFoundException('Usuario no encontrado.');
      const now = new Date();
      await tx.userMfaFactor.updateMany({
        where: { userId: id, status: { not: MfaFactorStatus.Disabled } },
        data: { status: MfaFactorStatus.Disabled, disabledAt: now },
      });
      await tx.userMfaRecoveryCode.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: now },
      });
      const revoked = await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'admin_mfa_reset' },
      });
      if (revoked.count > 0) {
        await tx.authEvent.create({
          data: {
            userId: id,
            eventType: AuthEventType.SessionRevoked,
            details: { reason: 'admin_mfa_reset', count: revoked.count },
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
            requestId: metadata.requestId,
          },
        });
      }
      const updated = await tx.user.findUniqueOrThrow({ where: { id }, select: userSelect });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'user.mfa.reset',
        entityType: 'user',
        entityId: id,
        beforeData: { mfaEnabled: current.mfaFactors.length > 0 },
        afterData: { mfaEnabled: false },
      });
      return updated;
    });
    return this.toUserResponse(row);
  }

  async forcePasswordChange(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: userSelect });
      if (!current) throw new NotFoundException('Usuario no encontrado.');
      const updated = await tx.user.update({
        where: { id },
        data: { mustChangePassword: true },
        select: userSelect,
      });
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'user.password_change_required',
        entityType: 'user',
        entityId: id,
        beforeData: { mustChangePassword: current.mustChangePassword },
        afterData: { mustChangePassword: true },
      });
      return updated;
    });
    return this.toUserResponse(row);
  }

  async listRoles(query: RoleListQueryDto, actorUserId: string): Promise<RoleResponseDto[]> {
    const authorizedBusinesses = await this.actorBusinessIds(this.prisma, actorUserId);
    const rows = await this.prisma.role.findMany({
      where: {
        businessId: query.businessId
          ? authorizedBusinesses.includes(query.businessId)
            ? query.businessId
            : { in: [] }
          : { in: authorizedBusinesses },
        ...(query.includeInactive ? {} : { active: true }),
      },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select: roleSelect,
    });
    return rows.map((row) => this.toRoleResponse(row));
  }

  async listPermissions(query: PermissionListQueryDto): Promise<PermissionResponseDto[]> {
    return this.prisma.permission
      .findMany({
        where: query.includeInactive ? {} : { active: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, description: true, active: true },
      })
      .then((rows) => rows);
  }

  async listEmployees(query: EmployeeListQueryDto): Promise<EmployeePageDto> {
    const search = query.search || undefined;
    const where: Prisma.EmployeeWhereInput = {
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.jobCode ? { jobCode: query.jobCode } : {}),
      ...(search
        ? {
            OR: [
              { employeeCode: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
        select: employeeSelect,
      }),
    ]);
    return {
      data: rows.map((row) => this.toEmployeeResponse(row)),
      meta: this.pageMeta(query.page, query.pageSize, total),
    };
  }

  async getEmployee(id: string): Promise<EmployeeResponseDto> {
    return this.toEmployeeResponse(await this.requireEmployee(id));
  }

  async createEmployee(
    dto: CreateEmployeeDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<EmployeeResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.requireLocation(tx, dto.locationId);
      await this.requireUserForEmployeeLink(tx, dto.userId);
      this.validateEmployeeDates(dto.hireDate, null);
      const created = await tx.employee.create({
        data: {
          locationId: dto.locationId,
          employeeCode: dto.employeeCode,
          firstName: dto.firstName,
          lastName: dto.lastName,
          jobCode: dto.jobCode,
          status: dto.status,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          hireDate: new Date(dto.hireDate),
        },
        select: { id: true },
      });
      if (dto.userId) {
        await tx.user.update({ where: { id: dto.userId }, data: { employeeId: created.id } });
      }
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'employee.created',
        entityType: 'employee',
        entityId: created.id,
        afterData: {
          locationId: dto.locationId,
          employeeCode: dto.employeeCode,
          userId: dto.userId ?? null,
        },
      });
      return tx.employee.findUniqueOrThrow({ where: { id: created.id }, select: employeeSelect });
    });
    return this.toEmployeeResponse(row);
  }

  async updateEmployee(
    id: string,
    dto: UpdateEmployeeDto,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<EmployeeResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.employee.findUnique({ where: { id }, select: employeeSelect });
      if (!current) throw new NotFoundException('Empleado no encontrado.');
      const hireDate = dto.hireDate === undefined ? current.hireDate : new Date(dto.hireDate);
      const terminationDate =
        dto.terminationDate === undefined
          ? current.terminationDate
          : dto.terminationDate === null
            ? null
            : new Date(dto.terminationDate);
      this.validateEmployeeDates(
        hireDate.toISOString().slice(0, 10),
        terminationDate?.toISOString().slice(0, 10) ?? null,
      );
      if (dto.userId !== undefined) {
        await this.requireUserForEmployeeLink(tx, dto.userId, id);
        if (current.user && current.user.id !== dto.userId) {
          await tx.user.update({ where: { id: current.user.id }, data: { employeeId: null } });
        }
        if (dto.userId && (!current.user || current.user.id !== dto.userId)) {
          await tx.user.update({ where: { id: dto.userId }, data: { employeeId: id } });
        }
      }
      const updated = await tx.employee.update({
        where: { id },
        data: {
          ...(dto.employeeCode === undefined ? {} : { employeeCode: dto.employeeCode }),
          ...(dto.firstName === undefined ? {} : { firstName: dto.firstName }),
          ...(dto.lastName === undefined ? {} : { lastName: dto.lastName }),
          ...(dto.jobCode === undefined ? {} : { jobCode: dto.jobCode }),
          ...(dto.hireDate === undefined ? {} : { hireDate }),
          ...(dto.terminationDate === undefined ? {} : { terminationDate }),
          ...(dto.status === undefined ? {} : { status: dto.status }),
          ...(dto.phone === undefined ? {} : { phone: dto.phone }),
          ...(dto.email === undefined ? {} : { email: dto.email }),
        },
        select: employeeSelect,
      });
      if (updated.status === EmployeeStatus.Inactive && updated.user) {
        await this.deactivateLinkedUser(tx, updated.user.id, metadata, 'employee_inactive');
      }
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'employee.updated',
        entityType: 'employee',
        entityId: id,
        beforeData: this.employeeAuditData(current),
        afterData: this.employeeAuditData(updated),
      });
      return updated;
    });
    return this.toEmployeeResponse(row);
  }

  async removeEmployee(
    id: string,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<EmployeeResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const current = await tx.employee.findUnique({ where: { id }, select: employeeSelect });
      if (!current) throw new NotFoundException('Empleado no encontrado.');
      const updated = await tx.employee.update({
        where: { id },
        data: {
          status: EmployeeStatus.Inactive,
          terminationDate: current.terminationDate ?? new Date(),
        },
        select: employeeSelect,
      });
      if (updated.status === EmployeeStatus.Inactive && updated.user) {
        await this.deactivateLinkedUser(tx, updated.user.id, metadata, 'employee_inactive');
      }
      await this.writeAudit(tx, actorUserId, metadata, {
        action: 'employee.deactivated',
        entityType: 'employee',
        entityId: id,
        beforeData: this.employeeAuditData(current),
        afterData: this.employeeAuditData(updated),
      });
      return updated;
    });
    return this.toEmployeeResponse(row);
  }

  private async changeUserStatus(
    id: string,
    status: UserStatus,
    actorUserId: string,
    metadata: RequestMetadata,
  ): Promise<UserResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockAdminInvariant(tx);
      const current = await tx.user.findUnique({ where: { id }, select: userSelect });
      if (!current) throw new NotFoundException('Usuario no encontrado.');
      if (
        current.status !== status &&
        current.status === UserStatus.Active &&
        status !== UserStatus.Active
      ) {
        await this.assertAnotherActiveAdmin(tx, id);
      }
      const now = new Date();
      const updated = await tx.user.update({
        where: { id },
        data:
          status === UserStatus.Active
            ? {
                status,
                failedLoginAttempts: 0,
                lockedAt: null,
                lockedUntil: null,
                lastFailedLoginAt: null,
              }
            : {
                status,
                ...(status === UserStatus.Locked
                  ? { lockedAt: now, lockedUntil: null }
                  : { lockedAt: null, lockedUntil: null }),
              },
        select: userSelect,
      });
      if (status !== UserStatus.Active) {
        const revoked = await tx.userSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now, revokedReason: `admin_${status.toLowerCase()}` },
        });
        if (revoked.count > 0) {
          await tx.authEvent.create({
            data: {
              userId: id,
              eventType: AuthEventType.SessionRevoked,
              details: { reason: `admin_${status.toLowerCase()}`, count: revoked.count },
              ipAddress: metadata.ipAddress,
              userAgent: metadata.userAgent,
              requestId: metadata.requestId,
            },
          });
        }
      }
      await this.writeAudit(tx, actorUserId, metadata, {
        action: `user.status.${status.toLowerCase()}`,
        entityType: 'user',
        entityId: id,
        beforeData: { status: current.status },
        afterData: { status: updated.status },
      });
      return updated;
    });
    return this.toUserResponse(row);
  }

  /** Mantiene la cuenta laboralmente desactivada y corta sus sesiones en la misma transacción. */
  private async deactivateLinkedUser(
    tx: Prisma.TransactionClient,
    userId: string,
    metadata: RequestMetadata,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    await tx.user.update({
      where: { id: userId },
      data: { status: UserStatus.Inactive, lockedAt: null, lockedUntil: null },
    });
    const revoked = await tx.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
    if (revoked.count > 0) {
      await tx.authEvent.create({
        data: {
          userId,
          eventType: AuthEventType.SessionRevoked,
          details: { reason, count: revoked.count },
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          requestId: metadata.requestId,
        },
      });
    }
  }

  private async requireUser(id: string): Promise<UserRow> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    return user;
  }

  private async requireEmployee(id: string): Promise<EmployeeRow> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: employeeSelect,
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado.');
    return employee;
  }

  private async assertUserIdentityAvailable(
    tx: Prisma.TransactionClient,
    username: string,
    email: string,
    excludedId?: string,
  ): Promise<void> {
    const existing = await tx.user.findFirst({
      where: {
        ...(excludedId ? { id: { not: excludedId } } : {}),
        OR: [
          { username: { equals: username, mode: 'insensitive' } },
          { email: { equals: email, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, email: true },
    });
    if (existing) throw new ConflictException('El nombre de usuario o correo ya está registrado.');
  }

  private async requireEmployeeForLink(
    tx: Prisma.TransactionClient,
    employeeId: string | null | undefined,
    userId?: string,
    actorUserId?: string,
  ): Promise<void> {
    if (employeeId === undefined || employeeId === null) return;
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        user: { select: { id: true } },
        location: { select: { businessId: true } },
      },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado.');
    if (employee.user && employee.user.id !== userId) {
      throw new ConflictException('El empleado ya está vinculado a otro usuario.');
    }
    if (actorUserId) {
      await this.assertBusinessAccess(tx, actorUserId, employee.location.businessId);
    }
  }

  private async requireActiveRoles(
    tx: Prisma.TransactionClient,
    roleIds: string[],
    actorUserId: string,
  ) {
    if (roleIds.length === 0) return [] as Array<{ id: string; code: string }>;
    const businesses = await this.actorBusinessIds(tx, actorUserId);
    const roles = await tx.role.findMany({
      where: { id: { in: roleIds }, active: true, businessId: { in: businesses } },
      select: { id: true, code: true, businessId: true },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException(
        'Una o más asignaciones de rol no son válidas o están inactivas.',
      );
    }
    return roles;
  }

  private async assertRoleAssignmentAuthority(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    roleIds: string[],
  ): Promise<void> {
    const requested = await tx.role.findMany({
      where: { id: { in: roleIds }, active: true },
      select: { id: true, code: true, businessId: true },
    });
    const actorRoles = await tx.userRole.findMany({
      where: { userId: actorUserId, active: true, role: { active: true } },
      select: {
        role: {
          select: {
            businessId: true,
            code: true,
            rolePermissions: {
              where: { active: true, permission: { active: true } },
              select: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });
    const hasRoleManagement = actorRoles.some(({ role }) =>
      role.rolePermissions.some(({ permission }) => permission.code === 'roles.manage'),
    );
    if (roleIds.length === 0 && !hasRoleManagement) {
      throw new ForbiddenException('Necesita roles.manage para asignar roles.');
    }
    for (const role of requested) {
      const sameBusinessRoles = actorRoles
        .map(({ role: actorRole }) => actorRole)
        .filter(({ businessId }) => businessId === role.businessId);
      const canManageRoles = sameBusinessRoles.some(({ rolePermissions }) =>
        rolePermissions.some(({ permission }) => permission.code === 'roles.manage'),
      );
      if (!canManageRoles) {
        throw new ForbiddenException('Necesita roles.manage para asignar roles.');
      }
      const actorRank = Math.max(0, ...sameBusinessRoles.map(({ code }) => ROLE_RANK[code] ?? 0));
      if ((ROLE_RANK[role.code] ?? 0) > actorRank) {
        throw new ForbiddenException('No puede conceder un rol superior al suyo.');
      }
    }
  }

  private async assertBusinessAccess(
    tx: PrismaService | Prisma.TransactionClient,
    actorUserId: string,
    businessId: string,
  ): Promise<void> {
    const businesses = await this.actorBusinessIds(tx, actorUserId);
    if (!businesses.includes(businessId)) {
      throw new NotFoundException('El registro no pertenece a un negocio autorizado.');
    }
  }

  private async actorBusinessIds(
    tx: PrismaService | Prisma.TransactionClient,
    actorUserId: string,
  ): Promise<string[]> {
    const actor = await tx.userRole.findMany({
      where: { userId: actorUserId, active: true, role: { active: true } },
      select: { role: { select: { businessId: true } } },
    });
    return [...new Set(actor.map(({ role }) => role.businessId))];
  }

  private async requireUserForEmployeeLink(
    tx: Prisma.TransactionClient,
    userId: string | null | undefined,
    employeeId?: string,
  ): Promise<void> {
    if (userId === undefined || userId === null) return;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, employeeId: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    if (user.employeeId && user.employeeId !== employeeId) {
      throw new ConflictException('El usuario ya está vinculado a otro empleado.');
    }
  }

  private async requireLocation(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const location = await tx.location.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!location || !location.active)
      throw new NotFoundException('Sede no encontrada o inactiva.');
  }

  private async assertAnotherActiveAdmin(
    tx: Prisma.TransactionClient,
    excludedUserId: string,
  ): Promise<void> {
    const count = await tx.user.count({
      where: {
        status: UserStatus.Active,
        id: { not: excludedUserId },
        roles: {
          some: {
            active: true,
            role: { active: true, code: { in: [...ADMIN_ROLE_CODES] } },
          },
        },
      },
    });
    if (count < 1)
      throw new ConflictException('No puede dejar el sistema sin un administrador activo.');
  }

  /** Serializa cambios de estado y roles para que el conteo de admins sea atómico. */
  private async lockAdminInvariant(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71001002)`;
  }

  private validateEmployeeDates(hireDate: string, terminationDate: string | null): void {
    if (!terminationDate) return;
    if (new Date(terminationDate) < new Date(hireDate)) {
      throw new BadRequestException('La terminación no puede ser anterior a la contratación.');
    }
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    metadata: RequestMetadata,
    event: {
      action: string;
      entityType: string;
      entityId?: string;
      beforeData?: AuditData;
      afterData?: AuditData;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        beforeData: event.beforeData,
        afterData: event.afterData,
        requestId: metadata.requestId,
        ipAddress: metadata.ipAddress,
      },
    });
  }

  private userAuditData(row: UserRow): AuditData {
    return {
      username: row.username,
      email: row.email,
      status: row.status,
      employeeId: row.employee?.id ?? null,
      roleCodes: row.roles.map(({ role }) => role.code),
    };
  }

  private employeeAuditData(row: EmployeeRow): AuditData {
    return {
      locationId: row.locationId,
      employeeCode: row.employeeCode,
      jobCode: row.jobCode,
      status: row.status,
      userId: row.user?.id ?? null,
    };
  }

  private toUserResponse(row: UserRow): UserResponseDto {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      status: row.status,
      mustChangePassword: row.mustChangePassword,
      failedLoginAttempts: row.failedLoginAttempts,
      lockedAt: row.lockedAt?.toISOString() ?? null,
      lockedUntil: row.lockedUntil?.toISOString() ?? null,
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
      roles: row.roles.map(({ role }) => ({ ...role })),
      employee: row.employee
        ? {
            id: row.employee.id,
            employeeCode: row.employee.employeeCode,
            firstName: row.employee.firstName,
            lastName: row.employee.lastName,
            jobCode: row.employee.jobCode,
            status: row.employee.status,
          }
        : null,
      mfaEnabled: row.mfaFactors.length > 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toEmployeeResponse(row: EmployeeRow): EmployeeResponseDto {
    return {
      id: row.id,
      locationId: row.locationId,
      employeeCode: row.employeeCode,
      firstName: row.firstName,
      lastName: row.lastName,
      jobCode: row.jobCode,
      status: row.status,
      phone: row.phone,
      email: row.email,
      hireDate: row.hireDate.toISOString().slice(0, 10),
      terminationDate: row.terminationDate?.toISOString().slice(0, 10) ?? null,
      user: row.user,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toRoleResponse(row: RoleRow): RoleResponseDto {
    return {
      id: row.id,
      businessId: row.businessId,
      code: row.code,
      name: row.name,
      active: row.active,
      permissions: row.rolePermissions.map(({ permission }) => permission.code),
    };
  }

  private isAdminRole(code: string): boolean {
    return (ADMIN_ROLE_CODES as readonly string[]).includes(code);
  }

  private uniqueIds(ids: string[]): string[] {
    return [...new Set(ids)];
  }

  private pageMeta(page: number, pageSize: number, total: number) {
    return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}
