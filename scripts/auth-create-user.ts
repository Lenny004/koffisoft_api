import 'dotenv/config';

import { PrismaService } from '../src/database/prisma.service.js';
import { UserStatus } from '../src/generated/prisma/enums.js';
import { PasswordService } from '../src/auth/security/password.service.js';

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredValue(name: string, environmentName: string): string {
  const value = argument(name) ?? process.env[environmentName];
  if (!value?.trim()) {
    throw new Error(`Falta --${name} o ${environmentName}.`);
  }
  return value.trim();
}

const email = requiredValue('email', 'AUTH_USER_EMAIL').toLowerCase();
const password = requiredValue('password', 'AUTH_USER_PASSWORD');
const roleCode = requiredValue('role', 'AUTH_USER_ROLE').toLowerCase();
const username = (
  argument('username') ??
  process.env.AUTH_USER_USERNAME ??
  email.split('@')[0] ??
  'local-user'
).trim();

if (password.length < 12 || password.length > 128) {
  throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
}

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) {
  throw new Error('El correo no tiene un formato válido.');
}

const prisma = new PrismaService();
const passwords = new PasswordService();

try {
  await prisma.$connect();

  const role = await prisma.role.findFirst({
    where: { code: roleCode, active: true },
    select: { id: true, code: true },
  });
  if (!role) {
    throw new Error(`No existe un rol activo con código ${roleCode}.`);
  }

  const passwordHash = await passwords.hash(password);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          username,
          email,
          passwordHash,
          status: UserStatus.Active,
          failedLoginAttempts: 0,
          lockedAt: null,
          lockedUntil: null,
          lastFailedLoginAt: null,
        },
        select: { id: true, username: true, email: true },
      })
    : await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          status: UserStatus.Active,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, username: true, email: true },
      });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

  console.log(JSON.stringify({ user, role: role.code }));
} finally {
  await prisma.$disconnect();
}
