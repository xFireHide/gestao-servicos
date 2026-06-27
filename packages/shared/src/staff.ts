import { z } from 'zod';
import { Role } from './roles';

/** Papéis que um admin pode atribuir a um membro da equipe (nunca PATIENT). */
export const staffRoleSchema = z.enum([Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN]);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const createStaffUserSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: staffRoleSchema,
    // Obrigatórios quando role = DOCTOR (vira também um profissional na agenda).
    specialty: z.string().min(2).max(120).optional(),
    crm: z.string().min(1).max(60).optional(),
  })
  .refine((v) => v.role !== Role.DOCTOR || (!!v.specialty && !!v.crm), {
    message: 'Profissional (médico) exige especialidade e registro',
    path: ['specialty'],
  });
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;

export interface StaffUserView {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  doctorId: string | null;
  specialty: string | null;
  crm: string | null;
}
