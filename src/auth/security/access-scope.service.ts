import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service.js';

/** Comprueba que el actor opera dentro de un negocio y sus sedes autorizadas. */
@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async assertLocationAccess(actorUserId: string, locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, active: true },
      select: { businessId: true },
    });
    if (!location) throw new NotFoundException('Sede no encontrada.');

    const businesses = await this.authorizedBusinessIds(actorUserId);
    if (!businesses.includes(location.businessId)) {
      throw new NotFoundException('Sede no encontrada.');
    }
  }

  async authorizedBusinessIds(actorUserId: string): Promise<string[]> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        roles: {
          where: { active: true, role: { active: true } },
          select: { role: { select: { businessId: true } } },
        },
      },
    });

    return [...new Set(actor?.roles.map(({ role }) => role.businessId) ?? [])];
  }
}
