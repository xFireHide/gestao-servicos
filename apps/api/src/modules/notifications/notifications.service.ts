import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import {
  AppointmentScheduledPayload,
  DomainEvent,
} from '@clinica/shared';
import type { Env } from '../../config/env';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MailService } from './mail.service';

const QUEUE_NAME = 'notifications';

/**
 * Escuta eventos de domínio (in-process — ADR 0003) e enfileira jobs assíncronos
 * no BullMQ/Redis. Um Worker processa os jobs e dispara e-mails/SMS/WhatsApp.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly connection: ConnectionOptions;
  private readonly queue: Queue;
  private worker?: Worker;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {
    const url = new URL(config.get('REDIS_URL', { infer: true }));
    this.connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
  }

  onModuleInit(): void {
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => {
        if (job.name === 'appointment.confirmation') {
          await this.handleConfirmation(job.data as AppointmentScheduledPayload);
        }
      },
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Job ${job?.id} falhou: ${err.message}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }

  @OnEvent(DomainEvent.AppointmentScheduled)
  async onAppointmentScheduled(payload: AppointmentScheduledPayload): Promise<void> {
    try {
      await this.queue.add('appointment.confirmation', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      });
    } catch (err) {
      this.logger.error(`Falha ao enfileirar notificação: ${String(err)}`);
    }
  }

  private async handleConfirmation(payload: AppointmentScheduledPayload): Promise<void> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: payload.appointmentId },
      include: { patient: true },
    });
    const to = appt?.patient.email;
    if (!to) {
      this.logger.warn(`Paciente sem e-mail; confirmação ignorada (${payload.appointmentId})`);
      return;
    }
    await this.mail.sendAppointmentConfirmation(to, new Date(payload.startAt));
  }
}
