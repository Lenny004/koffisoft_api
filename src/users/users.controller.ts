import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { requestMetadata, type AuthenticatedRequest } from '../auth/auth.types.js';
import {
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
import {
  EmployeePageDto,
  EmployeeResponseDto,
  PermissionResponseDto,
  RoleResponseDto,
  UserPageDto,
  UserResponseDto,
} from './dto/users-response.dto.js';
import { UsersService } from './users.service.js';

/** Endpoints administrativos de cuentas, empleados y control de acceso. */
@ApiTags('Usuarios y empleados')
@Controller()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('users/admin/roles')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Lista los roles y sus permisos activos' })
  @ApiResponse({ status: 200, type: [RoleResponseDto] })
  listRoles(@Query() query: RoleListQueryDto): Promise<RoleResponseDto[]> {
    return this.service.listRoles(query);
  }

  @Get('users/admin/permissions')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Lista el catálogo de permisos' })
  @ApiResponse({ status: 200, type: [PermissionResponseDto] })
  listPermissions(@Query() query: PermissionListQueryDto): Promise<PermissionResponseDto[]> {
    return this.service.listPermissions(query);
  }

  @Get('users/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Lista usuarios con filtros y paginación server-side' })
  @ApiResponse({ status: 200, type: UserPageDto })
  listUsers(@Query() query: UserListQueryDto): Promise<UserPageDto> {
    return this.service.listUsers(query);
  }

  @Get('users/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta el detalle administrativo de un usuario' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  getUser(@Param('id') id: string): Promise<UserResponseDto> {
    return this.service.getUser(id);
  }

  @Post('users/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Crea un usuario administrativo' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  createUser(
    @Body() dto: CreateUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.createUser(dto, this.actorId(request), requestMetadata(request));
  }

  @Patch('users/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Edita los datos no sensibles de un usuario' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.updateUser(id, dto, this.actorId(request), requestMetadata(request));
  }

  @Post('users/admin/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Activa una cuenta y limpia su bloqueo' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  activateUser(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.activateUser(id, this.actorId(request), requestMetadata(request));
  }

  @Post('users/admin/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva una cuenta y revoca sus sesiones' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  deactivateUser(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.deactivateUser(id, this.actorId(request), requestMetadata(request));
  }

  @Post('users/admin/:id/block')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Bloquea una cuenta y revoca sus sesiones' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  blockUser(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.blockUser(id, this.actorId(request), requestMetadata(request));
  }

  @Put('users/admin/:id/roles')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('roles.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Reemplaza las asignaciones activas de roles de un usuario' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignUserRolesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.assignRoles(id, dto, this.actorId(request), requestMetadata(request));
  }

  @Post('users/admin/:id/reset-mfa')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva MFA y consume los códigos de recuperación' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  resetMfa(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.resetMfa(id, this.actorId(request), requestMetadata(request));
  }

  @Post('users/admin/:id/force-password-change')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Exige cambio de contraseña en el siguiente acceso' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  forcePasswordChange(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.forcePasswordChange(id, this.actorId(request), requestMetadata(request));
  }

  @Get('employees/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Lista empleados con filtros y paginación server-side' })
  @ApiResponse({ status: 200, type: EmployeePageDto })
  listEmployees(@Query() query: EmployeeListQueryDto): Promise<EmployeePageDto> {
    return this.service.listEmployees(query);
  }

  @Get('employees/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta el detalle de un empleado' })
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  getEmployee(@Param('id') id: string): Promise<EmployeeResponseDto> {
    return this.service.getEmployee(id);
  }

  @Post('employees/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Crea un empleado y vincula opcionalmente un usuario' })
  @ApiResponse({ status: 201, type: EmployeeResponseDto })
  createEmployee(
    @Body() dto: CreateEmployeeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EmployeeResponseDto> {
    return this.service.createEmployee(dto, this.actorId(request), requestMetadata(request));
  }

  @Patch('employees/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Edita un empleado y su vínculo opcional' })
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EmployeeResponseDto> {
    return this.service.updateEmployee(id, dto, this.actorId(request), requestMetadata(request));
  }

  @Delete('employees/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un empleado' })
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  removeEmployee(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EmployeeResponseDto> {
    return this.service.removeEmployee(id, this.actorId(request), requestMetadata(request));
  }

  private actorId(request: AuthenticatedRequest): string {
    if (!request.auth?.userId) {
      throw new Error('La ruta administrativa requiere una sesión autenticada.');
    }
    return request.auth.userId;
  }
}
