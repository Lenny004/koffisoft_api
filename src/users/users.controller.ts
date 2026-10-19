import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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

  /** Lista roles administrables filtrados por negocio autorizado del actor. */
  @Get('users/admin/roles')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('roles.read')
  @ApiOperation({ summary: 'Lista los roles y sus permisos activos' })
  @ApiResponse({ status: 200, type: [RoleResponseDto] })
  listRoles(
    @Query() query: RoleListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RoleResponseDto[]> {
    return this.service.listRoles(query, this.actorId(request));
  }

  /** Expone el catálogo de permisos del sistema. */
  @Get('users/admin/permissions')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Lista el catálogo de permisos' })
  @ApiResponse({ status: 200, type: [PermissionResponseDto] })
  listPermissions(@Query() query: PermissionListQueryDto): Promise<PermissionResponseDto[]> {
    return this.service.listPermissions(query);
  }

  /** Pagina usuarios con filtros de estado, rol y búsqueda. */
  @Get('users/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Lista usuarios con filtros y paginación server-side' })
  @ApiResponse({ status: 200, type: UserPageDto })
  listUsers(@Query() query: UserListQueryDto): Promise<UserPageDto> {
    return this.service.listUsers(query);
  }

  /** Consulta el detalle administrativo de un usuario por UUID. */
  @Get('users/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta el detalle administrativo de un usuario' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  getUser(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.service.getUser(id);
  }

  /** Crea una cuenta administrativa y registra la acción en auditoría. */
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

  /** Actualiza identidad y vínculo laboral no sensibles de un usuario. */
  @Patch('users/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Edita los datos no sensibles de un usuario' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.updateUser(id, dto, this.actorId(request), requestMetadata(request));
  }

  /** Reactiva una cuenta bloqueada o inactiva. */
  @Post('users/admin/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Activa una cuenta y limpia su bloqueo' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.activateUser(id, this.actorId(request), requestMetadata(request));
  }

  /** Desactiva una cuenta distinta a la del actor autenticado. */
  @Post('users/admin/:id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva una cuenta y revoca sus sesiones' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.deactivateUser(id, this.actorId(request), requestMetadata(request));
  }

  /** Bloquea el acceso de un usuario y revoca sus sesiones. */
  @Post('users/admin/:id/block')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Bloquea una cuenta y revoca sus sesiones' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  blockUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.blockUser(id, this.actorId(request), requestMetadata(request));
  }

  /** Sustituye el conjunto de roles activos asignados al usuario. */
  @Put('users/admin/:id/roles')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('roles.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Reemplaza las asignaciones activas de roles de un usuario' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignUserRolesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.assignRoles(id, dto, this.actorId(request), requestMetadata(request));
  }

  /** Reinicia MFA del usuario objetivo desde consola administrativa. */
  @Post('users/admin/:id/reset-mfa')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva MFA y consume los códigos de recuperación' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  resetMfa(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.resetMfa(id, this.actorId(request), requestMetadata(request));
  }

  /** Obliga al usuario a cambiar contraseña en el próximo acceso. */
  @Post('users/admin/:id/force-password-change')
  @HttpCode(HttpStatus.OK)
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Exige cambio de contraseña en el siguiente acceso' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  forcePasswordChange(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserResponseDto> {
    return this.service.forcePasswordChange(id, this.actorId(request), requestMetadata(request));
  }

  /** Lista empleados con alcance por negocio del actor y paginación. */
  @Get('employees/admin')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Lista empleados con filtros y paginación server-side' })
  @ApiResponse({ status: 200, type: EmployeePageDto })
  listEmployees(
    @Query() query: EmployeeListQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EmployeePageDto> {
    return this.service.listEmployees(query, this.actorId(request));
  }

  /** Devuelve el detalle de un empleado accesible para el actor. */
  @Get('employees/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Consulta el detalle de un empleado' })
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  getEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EmployeeResponseDto> {
    return this.service.getEmployee(id, this.actorId(request));
  }

  /** Registra un empleado y opcionalmente lo vincula a un usuario existente. */
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

  /** Modifica datos laborales y relación con cuenta de usuario. */
  @Patch('employees/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Edita un empleado y su vínculo opcional' })
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  updateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EmployeeResponseDto> {
    return this.service.updateEmployee(id, dto, this.actorId(request), requestMetadata(request));
  }

  /** Desactiva lógicamente un empleado y propaga efectos a la cuenta vinculada. */
  @Delete('employees/admin/:id')
  @ApiSecurity('sessionCookie')
  @RequirePermissions('users.manage')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Desactiva lógicamente un empleado' })
  @ApiResponse({ status: 200, type: EmployeeResponseDto })
  removeEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<EmployeeResponseDto> {
    return this.service.removeEmployee(id, this.actorId(request), requestMetadata(request));
  }

  /** Obtiene el userId del contexto de sesión para operaciones administrativas. */
  private actorId(request: AuthenticatedRequest): string {
    if (!request.auth?.userId) {
      throw new Error('La ruta administrativa requiere una sesión autenticada.');
    }
    return request.auth.userId;
  }
}
