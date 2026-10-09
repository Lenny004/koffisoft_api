import { describe, expect, it, vi } from 'vitest';

import { EventQuoteLineType, EventSpaceBookingStatus } from '../generated/prisma/enums.js';
import { CreateEventQuoteDto } from './dto/event.dto.js';
import { EventsService, calculateQuoteTotals } from './events.service.js';

describe('EventsService', () => {
  it('calcula totales de cotización con decimales exactos', () => {
    const dto = {
      validUntil: '2026-10-31',
      lines: [
        {
          lineType: EventQuoteLineType.Service,
          labelEs: 'Servicio',
          labelEn: 'Service',
          quantity: '3',
          unit: 'hora',
          unitPrice: '19.95',
          discountAmount: '5.00',
          taxRate: '0.130000',
          sortOrder: 0,
        },
      ],
    } as CreateEventQuoteDto;

    const result = calculateQuoteTotals(dto);

    expect(result.subtotalAmount.toFixed(2)).toBe('59.85');
    expect(result.discountAmount.toFixed(2)).toBe('5.00');
    expect(result.taxableAmount.toFixed(2)).toBe('54.85');
    expect(result.taxAmount.toFixed(2)).toBe('7.13');
    expect(result.totalAmount.toFixed(2)).toBe('61.98');
    expect(result.lines[0]?.lineTotal.toFixed(2)).toBe('61.98');
  });

  it('rechaza descuentos mayores al importe bruto', () => {
    const dto = {
      validUntil: '2026-10-31',
      lines: [
        {
          lineType: EventQuoteLineType.Venue,
          labelEs: 'Espacio',
          labelEn: 'Space',
          quantity: '1',
          unit: 'servicio',
          unitPrice: '100.00',
          discountAmount: '100.01',
          taxRate: '0',
          sortOrder: 0,
        },
      ],
    } as CreateEventQuoteDto;

    expect(() => calculateQuoteTotals(dto)).toThrow('no puede superar');
  });

  it('rechaza el solapamiento de reservas activas del mismo espacio', async () => {
    const prisma = {
      event: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'event-2',
          locationId: 'location-1',
        }),
      },
      venueSpace: {
        findFirst: vi.fn().mockResolvedValue({ id: 'space-1' }),
      },
      eventSpaceBooking: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'booking-1',
            eventId: 'event-1',
            startsAt: new Date('2026-10-24T18:00:00.000Z'),
            endsAt: new Date('2026-10-24T20:00:00.000Z'),
            setupStartsAt: null,
            teardownEndsAt: null,
            holdExpiresAt: null,
            bookingStatus: EventSpaceBookingStatus.Confirmed,
          },
        ]),
        create: vi.fn(),
      },
    };
    const service = new EventsService(prisma as never);

    await expect(
      service.createSpaceBooking('event-2', {
        venueSpaceId: 'space-1',
        startsAt: '2026-10-24T19:00:00.000Z',
        endsAt: '2026-10-24T21:00:00.000Z',
        bookingStatus: EventSpaceBookingStatus.Held,
        capacityReserved: 20,
      }),
    ).rejects.toThrow('ya está reservado');
    expect(prisma.eventSpaceBooking.create).not.toHaveBeenCalled();
  });
});
