import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import {
  CreateAppointmentInput,
  CreateSelfAppointmentInput,
  DomainEvent,
  JwtClaims,
  Role,
  type AppointmentScheduledPayload,
} from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { PatientsService } from '../patients/patients.service';
import { AvailabilityService } from './availability.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly patients: PatientsService,
    private readonly events: EventEmitter2,
  ) {}

  /** Auto-agendamento: deriva o paciente do usuário logado (não confia em id do cliente). */
  async createForPatient(userId: string, input: CreateSelfAppointmentInput): Promise<{ id: string }> {
    const patientId = await this.patients.resolvePatientId(userId);
    if (!patientId) {
      throw new BadRequestException('Complete seu cadastro de paciente antes de agendar');
    }
    return this.create({ ...input, patientId });
  }

  async listForPatient(userId: string) {
    const patientId = await this.patients.resolvePatientId(userId);
    if (!patientId) return [];
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { startAt: 'asc' },
    });
  }

  /**
   * Cria um agendamento. A invariante anti-double-booking é garantida pela
   * exclusion constraint do Postgres (ADR 0002): se outro agendamento do mesmo
   * médico se sobrepuser, o INSERT falha com 23P01 → traduzido em 409.
   * O INSERT é feito via SQL cru para que a violação chegue como erro detectável.
   */
  async create(input: CreateAppointmentInput): Promise<{ id: string }> {
    // organizationId do agendamento deriva do médico (tenant dono da agenda).
    const organizationId = await this.ensureDoctor(input.doctorId);
    await this.ensurePatient(input.patientId);
    if (input.serviceId) await this.ensureService(input.serviceId);

    const withinWindow = await this.availability.isWithinAvailability(
      input.doctorId,
      input.startAt,
      input.endAt,
    );
    if (!withinWindow) {
      throw new BadRequestException('Horário fora da disponibilidade do médico');
    }

    const id = randomUUID();
    // Repete em caso de deadlock transitório: sob concorrência, dois INSERTs
    // sobrepostos podem se bloquear mutuamente no índice de exclusão; ao repetir,
    // o slot já está ocupado pelo vencedor e a violação vem limpa como 23P01 -> 409.
    const MAX_ATTEMPTS = 4;
    for (let attempt = 1; ; attempt++) {
      try {
        // INSERT cru (necessário p/ a exclusion constraint emitir 23P01): o middleware
        // de tenant do Prisma não cobre $executeRaw, então o organizationId vai explícito.
        await this.prisma.$executeRaw`
          INSERT INTO "appointments"
            ("id", "organizationId", "doctorId", "patientId", "serviceId", "startAt", "endAt", "status", "reason", "createdAt", "updatedAt")
          VALUES (
            ${id}::uuid, ${organizationId}::uuid, ${input.doctorId}::uuid, ${input.patientId}::uuid,
            ${input.serviceId ?? null}::uuid,
            ${input.startAt}::timestamptz, ${input.endAt}::timestamptz,
            'SCHEDULED'::"AppointmentStatus", ${input.reason ?? null}, now(), now()
          )`;
        break;
      } catch (err) {
        if (PrismaService.isOverlapViolation(err)) {
          throw new ConflictException('Horário indisponível: já existe agendamento neste período');
        }
        if (PrismaService.isTransientConflict(err) && attempt < MAX_ATTEMPTS) {
          continue;
        }
        throw err;
      }
    }

    const payload: AppointmentScheduledPayload = {
      appointmentId: id,
      doctorId: input.doctorId,
      patientId: input.patientId,
      startAt: input.startAt.toISOString(),
      endAt: input.endAt.toISOString(),
    };
    this.events.emit(DomainEvent.AppointmentScheduled, payload);

    return { id };
  }

  async cancel(id: string, actor?: JwtClaims): Promise<void> {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('Agendamento não encontrado');
    // Paciente só cancela o próprio agendamento; equipe cancela qualquer um.
    if (actor?.role === Role.PATIENT) {
      const patientId = await this.patients.resolvePatientId(actor.sub);
      if (appt.patientId !== patientId) {
        throw new ForbiddenException('Não é possível cancelar agendamento de outro paciente');
      }
    }
    await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    this.events.emit(DomainEvent.AppointmentCancelled, { appointmentId: id });
  }

  async listForDoctor(doctorId: string, date: Date) {
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return this.prisma.appointment.findMany({
      where: { doctorId, startAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { startAt: 'asc' },
    });
  }

  /** Garante que o médico existe (no tenant atual) e retorna o organizationId dele. */
  private async ensureDoctor(doctorId: string): Promise<string> {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { organizationId: true },
    });
    if (!doctor) throw new NotFoundException('Médico não encontrado');
    return doctor.organizationId;
  }

  private async ensurePatient(patientId: string): Promise<void> {
    const count = await this.prisma.patient.count({ where: { id: patientId } });
    if (count === 0) throw new NotFoundException('Paciente não encontrado');
  }

  private async ensureService(serviceId: string): Promise<void> {
    const count = await this.prisma.service.count({ where: { id: serviceId } });
    if (count === 0) throw new NotFoundException('Serviço não encontrado');
  }
}
