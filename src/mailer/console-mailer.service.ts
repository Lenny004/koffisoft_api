import { Injectable, Logger } from '@nestjs/common';

import { MailerService } from './mailer.service.js';

/** Transport de consola para desarrollo (imprime en lugar de enviar). */
@Injectable()
export class ConsoleMailerService extends MailerService {
  private readonly logger = new Logger(ConsoleMailerService.name);

  /**
   * Imprime en consola el contenido del correo de recuperación (solo desarrollo).
   */
  async sendPasswordReset(to: string, token: string): Promise<void> {
    this.logger.log('='.repeat(80));
    this.logger.log('📧 Correo de Recuperación de Contraseña (Desarrollo)');
    this.logger.log('='.repeat(80));
    this.logger.log(`Para: ${to}`);
    this.logger.log(`Asunto: Recupera tu contraseña - Koffi-Soft`);
    this.logger.log('');
    this.logger.log('Hola,');
    this.logger.log('');
    this.logger.log('Recibimos una solicitud para restablecer tu contraseña.');
    this.logger.log('');
    this.logger.log(`Token de recuperación: ${token}`);
    this.logger.log('');
    this.logger.log('Este token expira en 1 hora.');
    this.logger.log('');
    this.logger.log('Si no solicitaste este cambio, ignora este mensaje.');
    this.logger.log('');
    this.logger.log('Saludos,');
    this.logger.log('El equipo de Koffi-Soft');
    this.logger.log('='.repeat(80));
  }

  /**
   * Imprime en consola el correo de bienvenida (solo desarrollo).
   */
  async sendWelcome(to: string, name: string): Promise<void> {
    this.logger.log('='.repeat(80));
    this.logger.log('📧 Correo de Bienvenida (Desarrollo)');
    this.logger.log('='.repeat(80));
    this.logger.log(`Para: ${to}`);
    this.logger.log(`Asunto: Bienvenido a Koffi-Soft`);
    this.logger.log('');
    this.logger.log(`Hola ${name},`);
    this.logger.log('');
    this.logger.log('Bienvenido a Koffi-Soft. Tu cuenta ha sido creada exitosamente.');
    this.logger.log('');
    this.logger.log('Saludos,');
    this.logger.log('El equipo de Koffi-Soft');
    this.logger.log('='.repeat(80));
  }
}
