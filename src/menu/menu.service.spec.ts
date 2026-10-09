import { describe, expect, it, vi } from 'vitest';

import { MenuChannel } from '../generated/prisma/enums.js';
import { MenuService } from './menu.service.js';

const locationId = '20000000-0000-0000-0000-000000000001';
const categoryId = '60000000-0000-0000-0000-000000000003';
const itemId = '61000000-0000-0000-0000-000000000005';
const variantId = '62000000-0000-0000-0000-000000000005';

describe('MenuService', () => {
  it('publica la carta sin SKU, auditoría ni campos internos', async () => {
    const prisma = {
      location: {
        findFirst: vi.fn().mockResolvedValue({ id: locationId, timezone: 'America/El_Salvador' }),
      },
      menuCategory: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: categoryId,
            slug: 'coffee',
            nameEs: 'Café',
            nameEn: 'Coffee',
            descriptionEs: null,
            descriptionEn: null,
            menuItems: [
              {
                id: itemId,
                slug: 'latte',
                itemType: 'Beverage',
                nameEs: 'Latte',
                nameEn: 'Latte',
                descriptionEs: 'Espresso y leche.',
                descriptionEn: 'Espresso and milk.',
                category: {
                  id: categoryId,
                  slug: 'coffee',
                  nameEs: 'Café',
                  nameEn: 'Coffee',
                  descriptionEs: null,
                  descriptionEn: null,
                },
                variants: [
                  {
                    id: variantId,
                    nameEs: 'Caliente',
                    nameEn: 'Hot',
                    isDefault: true,
                    prices: [
                      {
                        id: '63000000-0000-0000-0000-000000000009',
                        price: { toString: () => '4.50' },
                        currency: 'USD',
                        includesTax: true,
                      },
                    ],
                    availabilities: [],
                    outages: [],
                    menuItemAllergens: [
                      {
                        presenceType: 'contains',
                        allergen: {
                          id: '6f000000-0000-0000-0000-000000000001',
                          code: 'MILK',
                          nameEs: 'Leche',
                          nameEn: 'Milk',
                        },
                      },
                    ],
                    modifierGroups: [],
                  },
                ],
              },
            ],
          },
        ]),
      },
    };
    const service = new MenuService(prisma as never);

    const result = await service.getPublicMenu({ locationId });

    expect(result.categories[0]?.items[0]).toMatchObject({
      id: itemId,
      slug: 'latte',
      itemType: 'beverage',
      variants: [{ available: true, price: { amount: '4.50' } }],
    });
    expect(result.categories[0]?.items[0]).not.toHaveProperty('sku');
    expect(result.categories[0]?.items[0]).not.toHaveProperty('createdAt');
    expect(prisma.menuCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ locationId, active: true }),
      }),
    );
  });

  it('desactiva la variante default anterior dentro de una transacción', async () => {
    const created = {
      id: variantId,
      prepStationId: '30000000-0000-0000-0000-000000000002',
      sku: 'DRINK-COFFEE-001-COLD',
      nameEs: 'Frío',
      nameEn: 'Iced',
      isDefault: true,
      active: true,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    };
    const tx = {
      menuItemVariant: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    const prisma = {
      menuItem: {
        findUnique: vi.fn().mockResolvedValue({ id: itemId, category: { locationId } }),
      },
      prepStation: {
        findFirst: vi.fn().mockResolvedValue({ id: created.prepStationId }),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<typeof created>) =>
        callback(tx),
      ),
    };
    const service = new MenuService(prisma as never);

    const result = await service.createVariant(itemId, {
      prepStationId: created.prepStationId,
      sku: created.sku,
      nameEs: created.nameEs,
      nameEn: created.nameEn,
      isDefault: true,
      active: true,
    });

    expect(result.id).toBe(variantId);
    expect(tx.menuItemVariant.updateMany).toHaveBeenCalledWith({
      where: { menuItemId: itemId, isDefault: true, active: true },
      data: { isDefault: false },
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('rechaza ventanas horarias que no cumplen las restricciones del schema', async () => {
    const prisma = {
      menuItemVariant: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: variantId, menuItem: { category: { locationId } } }),
      },
    };
    const service = new MenuService(prisma as never);

    await expect(
      service.createAvailability(variantId, {
        locationId,
        channel: MenuChannel.Web,
        dayOfWeek: 1,
        startsAt: '11:00',
        endsAt: '10:00',
        crossesMidnight: false,
        active: true,
      }),
    ).rejects.toThrow('La ventana horaria no es coherente.');
  });
});
