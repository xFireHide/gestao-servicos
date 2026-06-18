import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Env } from '../../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: ConfigService<Env, true>) {
    this.from = config.get('MAIL_FROM', { infer: true });
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: false,
    });
  }

  async sendAppointmentConfirmation(to: string, when: Date): Promise<void> {
    const formatted = when.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Confirmação de agendamento',
      text: `Sua consulta foi agendada para ${formatted}. Em caso de dúvidas, entre em contato.`,
    });
    this.logger.log(`E-mail de confirmação enviado para ${to}`);
  }
}
