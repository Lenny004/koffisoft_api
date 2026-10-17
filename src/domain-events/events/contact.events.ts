/**
 * Eventos del dominio de contacto.
 */

export interface ContactMessageReceivedEvent {
  readonly messageId: string;
  readonly locationId: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
}
