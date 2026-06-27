-- ===========================================================================
-- ASSINATURA / SAAS (Fase 5)
-- Plano e situação de assinatura por empresa. Cobrança via gateway é etapa futura.
-- Aditivo: colunas com DEFAULT preenchem as empresas existentes.
-- ===========================================================================

CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'BUSINESS');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

ALTER TABLE "organizations" ADD COLUMN "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE';
ALTER TABLE "organizations" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING';
ALTER TABLE "organizations" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- A empresa que já existia (origem do produto) entra como assinatura ativa.
UPDATE "organizations" SET "subscriptionStatus" = 'ACTIVE' WHERE "slug" = 'clinica-padrao';
