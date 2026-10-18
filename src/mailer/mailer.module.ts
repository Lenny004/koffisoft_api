import { Module, Global } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { MailerService } from './mailer.service.js';
import { ConsoleMailerService } from './console-mailer.service.js';
import { SmtpMailerService } from './smtp-mailer.service.js';

@Global()
@Module({
  providers: [
    {
      provide: MailerService,
      useFactory: (config: AppConfig) => {
        if (config.mailerTransport === 'smtp') {
          return new SmtpMailerService(config);
        }
        return new ConsoleMailerService();
      },
      inject: [APP_CONFIG],
    },
  ],
  exports: [MailerService],
})
export class MailerModule {}
