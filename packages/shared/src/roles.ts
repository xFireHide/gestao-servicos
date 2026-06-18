import { z } from 'zod';

/** Papéis de RBAC. Um usuário tem exatamente um papel principal. */
export const Role = {
  PATIENT: 'PATIENT',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
  ADMIN: 'ADMIN',
} as const;

export const roleSchema = z.nativeEnum(Role);
export type Role = z.infer<typeof roleSchema>;

/** Papéis considerados "staff interno" (acessam o portal staff-web). */
export const STAFF_ROLES: Role[] = [Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN];
