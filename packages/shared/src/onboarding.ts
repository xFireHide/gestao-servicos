import { z } from 'zod';
import { businessTypeSchema, orgSlugSchema } from './organizations';

/** Planos do SaaS (cobrança via gateway é etapa futura). */
export const SubscriptionPlan = {
  FREE: 'FREE',
  PRO: 'PRO',
  BUSINESS: 'BUSINESS',
} as const;
export const subscriptionPlanSchema = z.nativeEnum(SubscriptionPlan);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

/** Situação da assinatura de uma empresa. */
export const SubscriptionStatus = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
} as const;
export const subscriptionStatusSchema = z.nativeEnum(SubscriptionStatus);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

/** Cadastro self-service de uma nova empresa + seu primeiro administrador. */
export const onboardingSchema = z.object({
  organizationName: z.string().min(2).max(120),
  slug: orgSlugSchema,
  businessType: businessTypeSchema.default('GENERIC'),
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const updateSubscriptionSchema = z.object({
  plan: subscriptionPlanSchema,
});
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export interface SubscriptionView {
  organizationId: string;
  name: string;
  slug: string;
  businessType: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
}
