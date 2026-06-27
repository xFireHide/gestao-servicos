import { z } from 'zod';

/**
 * Catálogo de serviços de uma empresa: o que ela vende/agenda (consulta, corte,
 * revisão, aula...). Cada serviço tem preço e duração; um agendamento referencia um.
 */

/** Duração de um serviço em minutos: 5 a 480 (8h), em múltiplos de 5. */
export const serviceDurationSchema = z
  .number()
  .int()
  .min(5)
  .max(480)
  .refine((d) => d % 5 === 0, { message: 'Duração deve ser múltiplo de 5 minutos' });

/** Preço em centavos (evita imprecisão de ponto flutuante com dinheiro). */
export const priceCentsSchema = z.number().int().min(0).max(100_000_000);

export const createServiceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  priceCents: priceCentsSchema,
  durationMinutes: serviceDurationSchema,
  active: z.boolean().optional(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const serviceViewSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  durationMinutes: z.number().int(),
  active: z.boolean(),
});
export type ServiceView = z.infer<typeof serviceViewSchema>;
