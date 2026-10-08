import { describe, expect, it, vi } from 'vitest';

import { ReservationStatus, ReservationTableStatus } from '../generated/prisma/enums.js';
import { ReservationsService } from './reservations.service.js';

const locationId = '20000000-0000-0000-0000-000000000001';
const spaceId = '70000000-0000-0000-0000-000000000003';
const tableId = '71000000-0000-0000-0000-000000000006';
const reservationId = '72000000-0000-0000-0000-000000000001';

describe('ReservationsService', () => {
  it('calcula disponibilidad por capacidad y excluye mesas ocupadas', async () => {
    const prisma = {
      location: {
        findFirst: vi.fn().mockResolvedValue({ id: locationId, timezone: 'America/El_Salvador' }),
      },
      venueSpace: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: spaceId,
            code: 'TERRACE',
            nameEs: 'Terraza',
            nameEn: 'Terrace',
            seatedCapacity: 10,
            standingCapacity: 12,
            allowsTableReservation: true,
            allowsPrivateEvent: true,
            active: true,
            locationId,
            diningTables: [
              { id: tableId, seatCount: 4, reservationTables: [] },
              {
                id: '71000000-0000-0000-0000-000000000007',
                seatCount: 2,
                reservationTables: [{ id: 'busy' }],
              },
            ],
            eventBookings: [],
          },
        ]),
      },
    };
    const service = new ReservationsService(prisma as never);

    const result = await service.getPublicAvailability({
      locationId,
      date: '2026-10-24',
      time: '18:30',
      partySize: 5,
      durationMinutes: 120,
    });

    expect(result.timezone).toBe('America/El_Salvador');
    expect(result.spaces[0]?.available).toBe(false);
    expect(prisma.venueSpace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ locationId, active: true }) }),
    );
  });

  it('rechaza una transición de estado no permitida', async () => {
    const prisma = {
      reservation: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: reservationId, status: ReservationStatus.Confirmed }),
      },
      $transaction: vi.fn(),
    };
    const service = new ReservationsService(prisma as never);

    await expect(
      service.transitionReservation(reservationId, ReservationStatus.Completed),
    ).rejects.toThrow('no puede pasar');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cancela y libera las asignaciones en una sola transacción', async () => {
    const detail = {
      id: reservationId,
      locationId,
      reservationCode: 'RES-TEST',
      contactNameSnapshot: 'Ana',
      contactPhoneSnapshot: '+503 0000-0000',
      contactEmailSnapshot: null,
      preferredLanguage: 'es',
      startsAt: new Date('2026-10-24T00:30:00.000Z'),
      endsAt: new Date('2026-10-24T02:30:00.000Z'),
      partySize: 2,
      status: ReservationStatus.Cancelled,
      source: 'Web',
      preferredSpaceId: null,
      specialRequests: null,
      internalNotes: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
      tables: [],
      preferredSpace: null,
    };
    const tx = {
      reservation: { update: vi.fn().mockResolvedValue(detail) },
      reservationTable: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      reservation: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: reservationId, status: ReservationStatus.Confirmed })
          .mockResolvedValueOnce(detail),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new ReservationsService(prisma as never);

    const result = await service.transitionReservation(reservationId, ReservationStatus.Cancelled);

    expect(result.status).toBe(ReservationStatus.Cancelled);
    expect(tx.reservationTable.updateMany).toHaveBeenCalledWith({
      where: {
        reservationId,
        allocationStatus: { in: [ReservationTableStatus.Held, ReservationTableStatus.Assigned] },
      },
      data: { allocationStatus: ReservationTableStatus.Released },
    });
  });
});
