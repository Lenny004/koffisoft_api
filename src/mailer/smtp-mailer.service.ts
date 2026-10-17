import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { MailerService } from './mailer.service.js';

/** Transport SMTP para producción. */
@Injectable()
export class SmtpMailerService extends MailerService {
  private readonly logger = new Logger(SmtpMailerService.name);
  private readonly transporter: Transporter;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super();
    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPassword,
          }
        : undefined,
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = `${process.env.PUBLIC_SITE_URL}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? '"Koffi-Soft" <no-reply@koffisoft.example.invalid>',
      to,
      subject: 'Recupera tu contraseña - Koffi-Soft',
      text: `Hola,\n\nRecibimos una solicitud para restablecer tu contraseña.\n\nUsa este enlace para crear una nueva contraseña:\n${resetUrl}\n\nEste enlace expira en 1 hora.\n\nSi no solicitaste este cambio, ignora este mensaje.\n\nSaludos,\nEl equipo de Koffi-Soft`,
      html: `
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p><a href="${resetUrl}">Haz clic aquí para crear una nueva contraseña</a></p>
        <p>Este enlace expira en 1 hora.</p>
        <p>Si no solicitaste este cambio, ignora este mensaje.</p>
        <p>Saludos,<br>El equipo de Koffi-Soft</p>
      `,
    });

    this.logger.log(`Correo de recuperación enviado a ${to}`);
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? '"Koffi-Soft" <no-reply@koffisoft.example.invalid>',
      to,
      subject: 'Bienvenido a Koffi-Soft',
      text: `Hola ${name},\n\nBienvenido a Koffi-Soft. Tu cuenta ha sido creada exitosamente.\n\nSaludos,\nEl equipo de Koffi-Soft`,
      html: `
        <p>Hola ${name},</p>
        <p>Bienvenido a Koffi-Soft. Tu cuenta ha sido creada exitosamente.</p>
        <p>Saludos,<br>El equipo de Koffi-Soft</p>
      `,
    });

    this.logger.log(`Correo de bienvenida enviado a ${to}`);
  }
}
