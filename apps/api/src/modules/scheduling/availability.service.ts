import { Injectable, NotFoundException } from '@nestjs/common';
import { AvailabilityInput, Slot } from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';

/** Combina data (UTC) + "HH:mm" em um instante UTC. */
function atTime(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, m, 0, 0),
  );
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertRule(input: AvailabilityInput) {
    const organizationId = await this.ensureDoctor(input.doctorId);
    return this.prisma.availability.create({
      data: {
        organizationId,
        doctorId: input.doctorId,
        weekday: input.weekday,
        startTime: input.startTime,
        endTime: input.endTime,
        slotMinutes: input.slotMinutes,
      },
    });
  }

  /** Slots livres de um médico numa data: gera a grade e remove os já ocupados. */
  async freeSlots(doctorId: string, date: Date): Promise<Slot[]> {
    await this.ensureDoctor(doctorId);
    const weekday = date.getUTCDay();
    const rules = await this.prisma.availability.findMany({ where: { doctorId, weekday } });

    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0),
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const booked = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        status: { not: 'CANCELLED' },
        startAt: { gte: dayStart, lt: dayEnd },
      },
      select: { startAt: true, endAt: true },
    });

    const slots: Slot[] = [];
    for (const rule of rules) {
      let cursor = atTime(date, rule.startTime);
      const windowEnd = atTime(date, rule.endTime);
      const step = rule.slotMinutes * 60 * 1000;
      while (cursor.getTime() + step <= windowEnd.getTime()) {
        const slotEnd = new Date(cursor.getTime() + step);
        const overlaps = booked.some(
          (b) => b.startAt < slotEnd && cursor < b.endAt,
        );
        if (!overlaps) {
          slots.push({ startAt: cursor.toISOString(), endAt: slotEnd.toISOString() });
        }
        cursor = slotEnd;
      }
    }
    return slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  /** Verifica se [startAt,endAt) cabe dentro de alguma janela de disponibilidade do dia. */
  async isWithinAvailability(doctorId: string, startAt: Date, endAt: Date): Promise<boolean> {
    const weekday = startAt.getUTCDay();
    const rules = await this.prisma.availability.findMany({ where: { doctorId, weekday } });
    return rules.some((rule) => {
      const windowStart = atTime(startAt, rule.startTime);
      const windowEnd = atTime(startAt, rule.endTime);
      return startAt >= windowStart && endAt <= windowEnd;
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
}
