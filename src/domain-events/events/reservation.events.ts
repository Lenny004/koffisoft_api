/**
 * Eventos del dominio de reservas.
 */

export interface ReservationCreatedEvent {
  readonly reservationId: string;
  readonly locationId: string;
  readonly customerName: string;
  readonly partySize: number;
  readonly reservationDate: string;
  readonly reservationTime: string;
  readonly source: string;
}

export interface ReservationConfirmedEvent {
  readonly reservationId: string;
  readonly locationId: string;
  readonly customerName: string;
  readonly confirmedByUserId?: string;
}

export interface ReservationCancelledEvent {
  readonly reservationId: string;
  readonly locationId: string;
  readonly customerName: string;
  readonly cancelledByUserId?: string;
  readonly reason?: string;
}

export interface ReservationNoShowEvent {
  readonly reservationId: string;
  readonly locationId: string;
  readonly customerName: string;
}
