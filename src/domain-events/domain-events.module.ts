import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * Bus de eventos del dominio, disponible globalmente.
 *
 * Los eventos de dominio permiten reacciones asíncronas sin acoplar módulos:
 * reservas, inventario, contacto y backups emiten sus hechos y notificaciones,
 * auditoría o trabajos los consumen sin dependencias explícitas.
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  exports: [EventEmitterModule],
})
export class DomainEventsModule {}
