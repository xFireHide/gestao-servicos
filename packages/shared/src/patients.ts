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

export const createPatientSchema = z.object({
  name: z.string().min(2).max(120),
  cpf: cpfSchema,
  birthDate: z.coerce.date(),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional(),
  // userId vincula o paciente a uma conta de login (autoatendimento). Opcional p/ cadastro na recepção.
  userId: z.string().uuid().optional(),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial();
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
