import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PublicationService } from './publication.service.js';

const PUBLICATION_POLL_INTERVAL_MS = 60_000;

/** Ejecuta las transiciones editoriales sin depender de Docker ni de un servicio externo. */
@Injectable()
export class PublicationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicationScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly publicationService: PublicationService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.process(), PUBLICATION_POLL_INTERVAL_MS);
    void this.process();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async process(): Promise<void> {
    try {
      const transitions = await this.publicationService.processDueTransitions();
      if (transitions > 0) this.logger.log(`Transiciones editoriales aplicadas: ${transitions}.`);
    } catch (error) {
      this.logger.error('No se pudieron procesar las transiciones editoriales.', error);
    }
  }
}
