import { Controller, Get } from '@nestjs/common';

@Controller('health')
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
