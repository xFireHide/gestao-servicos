import { z } from 'zod';

/**
 * Tipo de negócio (vertical) de uma empresa-cliente do SaaS. Dirige terminologia e
 * templates de cada portal. CLINIC mantém a compatibilidade com a origem do produto.
 */
export const BusinessType = {
  CLINIC: 'CLINIC',
  SALON: 'SALON',
  GYM: 'GYM',
  WORKSHOP: 'WORKSHOP',
  CONSULTING: 'CONSULTING',
  GENERIC: 'GENERIC',
} as const;
export const businessTypeSchema = z.nativeEnum(BusinessType);
export type BusinessType = z.infer<typeof businessTypeSchema>;

/** Slug usado na URL pública de cada empresa (ex.: /b/minha-clinica). */
export const orgSlugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug deve ser kebab-case (a-z, 0-9, hífen)');

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: orgSlugSchema,
  businessType: businessTypeSchema.default(BusinessType.GENERIC),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const organizationViewSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  businessType: businessTypeSchema,
});
export type OrganizationView = z.infer<typeof organizationViewSchema>;
