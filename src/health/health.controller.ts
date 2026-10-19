import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator.js';

@Controller('health')
@Public()
export class HealthController {
  @Get('live')
  /** Responde ok sin tocar dependencias para probes de liveness. */
  live(): { status: 'ok'; service: string } {
    return {
      status: 'ok',
      service: 'koffisoft-api',
    };
  }
}
