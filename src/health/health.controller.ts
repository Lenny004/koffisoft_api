import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator.js';

@Controller('health')
@Public()
export class HealthController {
  /** Responde sin consultar dependencias para comprobar que el proceso HTTP está vivo. */
  @Get('live')
  live(): { status: 'ok'; service: string } {
    return {
      status: 'ok',
      service: 'koffisoft-api',
    };
  }
}
