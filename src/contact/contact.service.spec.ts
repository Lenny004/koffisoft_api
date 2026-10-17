import { describe, expect, it, vi } from 'vitest';

import { ContactMessageStatus, CustomerType } from '../generated/prisma/enums.js';
import { ContactRateLimitService } from './contact-rate-limit.service.js';
import { ContactService } from './contact.service.js';

const locationId = '20000000-0000-0000-0000-000000000001';

function serviceWith(prisma: Record<string, unknown>): ContactService {
  return new ContactService(
    prisma as never,
    new ContactRateLimitService(),
    {} as never, // reservations
    {} as never, // events
    {} as never, // eventEmitter
  );
}

const dto = {
  locationId,
  name: 'Ana Martínez',
  email: 'ANA@example.com',
  phone: '+503 7000-0000',
  languageCode: 'es',
  topic: 'general',
  message: 'Quisiera conocer el horario de atención.',
};

describe('ContactService', () => {
  it('rejects a status transition after the message is closed', async () => {
    const current = { id: 'message-1', locationId, status: ContactMessageStatus.Closed };
    const prisma = {
      contactMessage: { findFirst: vi.fn().mockResolvedValue(current) },
      $transaction: vi.fn(),
    };
    const service = serviceWith(prisma);

    await expect(
      service.update(
        'message-1',
        locationId,
        { status: ContactMessageStatus.InProgress } as never,
        'user-1',
        { requestId: 'req-1' },
      ),
    ).rejects.toThrow('no puede pasar');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes an audit record when the status changes', async () => {
    const current = {
      id: 'message-1',
      locationId,
      customerId: null,
      reservationId: null,
      eventId: null,
      nameSnapshot: 'Ana',
      email: 'ana@example.com',
      phone: null,
      languageCode: 'es',
      topic: 'general',
      message: 'Mensaje suficiente para prueba.',
      status: ContactMessageStatus.New,
      assignedToUserId: null,
      receivedAt: new Date(),
      repliedAt: null,
      archivedAt: null,
      archivedByUserId: null,
      assignedTo: null,
      customer: null,
      reservation: null,
      event: null,
    };
    const tx = {
      contactMessage: { update: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      contactMessage: { findFirst: vi.fn().mockResolvedValue(current) },
      auditLog: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = serviceWith(prisma);

    await service.update(
      'message-1',
      locationId,
      { status: ContactMessageStatus.InProgress } as never,
      'user-1',
      { requestId: 'req-1', ipAddress: '127.0.0.1' },
    );

    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'contact_message.updated' }),
      }),
    );
  });

  it('ignora el honeypot sin escribir ni consumir el rate limit', async () => {
    const prisma = { location: { findFirst: vi.fn() }, contactMessage: { create: vi.fn() } };
    const rateLimit = { assertAllowed: vi.fn() };
    const service = new ContactService(
      prisma as never,
      rateLimit as never,
      {} as never, // reservations
      {} as never, // events
      {} as never, // eventEmitter
    );

    await expect(service.createPublic({ ...dto, website: 'bot' } as never)).resolves.toEqual({
      accepted: true,
    });
    expect(rateLimit.assertAllowed).not.toHaveBeenCalled();
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('normaliza correo y no duplica el mismo mensaje reciente', async () => {
    const prisma = {
      location: { findFirst: vi.fn().mockResolvedValue({ id: locationId }) },
      contactMessage: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-message' }),
        create: vi.fn(),
      },
    };
    const service = serviceWith(prisma);

    await expect(service.createPublic(dto as never, '127.0.0.1')).resolves.toEqual({
      accepted: true,
    });
    expect(prisma.contactMessage.create).not.toHaveBeenCalled();
    expect(prisma.contactMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ email: 'ana@example.com', locationId }),
      }),
    );
  });

  it('convierte una vez a cliente y devuelve el vínculo existente en reintentos', async () => {
    const current = {
      id: 'message-1',
      locationId,
      customerId: null,
      reservationId: null,
      eventId: null,
      nameSnapshot: 'Ana',
      email: 'ana@example.com',
      phone: null,
      languageCode: 'es',
      topic: 'general',
      message: 'Mensaje suficiente para prueba.',
      status: ContactMessageStatus.New,
      assignedToUserId: null,
      receivedAt: new Date(),
      repliedAt: null,
      archivedAt: null,
      archivedByUserId: null,
      assignedTo: null,
      customer: null,
      reservation: null,
      event: null,
    };
    const tx = {
      contactMessage: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValueOnce({
            ...current,
            customerId: 'customer-1',
          }),
        update: vi.fn(),
      },
      customer: { create: vi.fn().mockResolvedValue({ id: 'customer-1' }) },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = serviceWith(prisma);

    await expect(
      service.convertToCustomer('message-1', locationId, 'user-1', { requestId: 'req-1' }),
    ).resolves.toMatchObject({ type: 'customer', id: 'customer-1', created: true });
    await expect(
      service.convertToCustomer('message-1', locationId, 'user-1', { requestId: 'req-1' }),
    ).resolves.toMatchObject({ type: 'customer', id: 'customer-1', created: false });
    expect(tx.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerType: CustomerType.Person }),
      }),
    );
    expect(tx.customer.create).toHaveBeenCalledOnce();
  });
});
