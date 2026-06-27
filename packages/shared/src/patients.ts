import { z } from 'zod';

/** Validação de CPF (formato + dígitos verificadores). PII sensível — criptografado em repouso. */
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

export const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(isValidCpf, { message: 'CPF inválido' });

/** Funil de cliente (CRM): lead captado -> cliente ativo -> inativo. */
export const CustomerStatus = {
  LEAD: 'LEAD',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export const customerStatusSchema = z.nativeEnum(CustomerStatus);
export type CustomerStatus = z.infer<typeof customerStatusSchema>;

export const createPatientSchema = z.object({
  name: z.string().min(2).max(120),
  // CPF e nascimento são opcionais: um lead (ex.: captado por anúncio) pode ter só nome+telefone.
  cpf: cpfSchema.optional(),
  birthDate: z.coerce.date().optional(),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional(),
  // userId vincula o paciente a uma conta de login (autoatendimento). Opcional p/ cadastro na recepção.
  userId: z.string().uuid().optional(),
  // Campos de CRM.
  status: customerStatusSchema.optional(),
  source: z.string().max(120).optional(), // origem do lead (indicação, Instagram, etc.)
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial();
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

/** Tipos de interação registrados na linha do tempo do cliente (CRM). */
export const InteractionType = {
  NOTE: 'NOTE',
  CALL: 'CALL',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  MEETING: 'MEETING',
  OTHER: 'OTHER',
} as const;
export const interactionTypeSchema = z.nativeEnum(InteractionType);
export type InteractionType = z.infer<typeof interactionTypeSchema>;

export const createInteractionSchema = z.object({
  type: interactionTypeSchema.default(InteractionType.NOTE),
  note: z.string().min(1).max(2000),
});
export type CreateInteractionInput = z.infer<typeof createInteractionSchema>;

export const interactionViewSchema = z.object({
  id: z.string().uuid(),
  type: interactionTypeSchema,
  note: z.string(),
  authorId: z.string().uuid().nullable(),
  createdAt: z.string(),
});
export type InteractionView = z.infer<typeof interactionViewSchema>;
