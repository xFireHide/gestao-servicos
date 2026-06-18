import { z } from 'zod';

/** Nomes de eventos de domínio (in-process hoje, broker no futuro — ADR 0003). */
export const DomainEvent = {
  AppointmentScheduled: 'appointment.scheduled',
  AppointmentCancelled: 'appointment.cancelled',
} as const;

/** Payload de AppointmentScheduled — contrato estável independente do transporte. */
export const appointmentScheduledPayloadSchema = z.object({
  appointmentId: z.string().uuid(),
  doctorId: z.string().uuid(),
  patientId: z.string().uuid(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});
export type AppointmentScheduledPayload = z.infer<typeof appointmentScheduledPayloadSchema>;
