import { z } from 'zod';

export const AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
} as const;
export const appointmentStatusSchema = z.nativeEnum(AppointmentStatus);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

/** Duração padrão de consulta (minutos). */
export const ALLOWED_DURATIONS = [15, 30, 45, 60] as const;
export const durationSchema = z
  .number()
  .int()
  .refine((d) => (ALLOWED_DURATIONS as readonly number[]).includes(d), {
    message: `Duração deve ser uma de: ${ALLOWED_DURATIONS.join(', ')} min`,
  });

/** Regra de disponibilidade recorrente semanal de um médico. */
export const availabilitySchema = z
  .object({
    doctorId: z.string().uuid(),
    weekday: z.number().int().min(0).max(6), // 0=domingo ... 6=sábado
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), // "HH:mm"
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    slotMinutes: durationSchema,
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'startTime deve ser anterior a endTime',
    path: ['endTime'],
  });
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

/** Consulta de slots livres para um médico em uma data. */
export const slotQuerySchema = z.object({
  doctorId: z.string().uuid(),
  date: z.coerce.date(),
});
export type SlotQuery = z.infer<typeof slotQuerySchema>;

export const slotSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});
export type Slot = z.infer<typeof slotSchema>;

const appointmentTimes = {
  doctorId: z.string().uuid(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  reason: z.string().max(500).optional(),
  // Serviço do catálogo associado ao agendamento (preço/duração). Opcional.
  serviceId: z.string().uuid().optional(),
};
const startBeforeEnd = (v: { startAt: Date; endAt: Date }) => v.startAt < v.endAt;
const startBeforeEndOpts = { message: 'startAt deve ser anterior a endAt', path: ['endAt'] };

/** Criação de agendamento pela equipe (informa o paciente explicitamente). */
export const createAppointmentSchema = z
  .object({ ...appointmentTimes, patientId: z.string().uuid() })
  .refine(startBeforeEnd, startBeforeEndOpts);
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

/** Auto-agendamento do paciente: o patientId é derivado do token, não enviado pelo cliente. */
export const createSelfAppointmentSchema = z
  .object({ ...appointmentTimes })
  .refine(startBeforeEnd, startBeforeEndOpts);
export type CreateSelfAppointmentInput = z.infer<typeof createSelfAppointmentSchema>;
