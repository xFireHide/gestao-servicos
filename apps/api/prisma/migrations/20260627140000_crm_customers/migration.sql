-- ===========================================================================
-- CRM / CLIENTES (Fase 2)
-- Generaliza "paciente" para "cliente" com funil (lead -> ativo -> inativo),
-- origem, tags e linha do tempo de interações. CPF/nascimento viram opcionais
-- (um lead pode ter só nome + telefone). Aditivo e não-destrutivo.
-- ===========================================================================

-- 1. Enums de CRM.
CREATE TYPE "CustomerStatus" AS ENUM ('LEAD', 'ACTIVE', 'INACTIVE');
CREATE TYPE "InteractionType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'OTHER');

-- 2. Campos de CRM no cliente (DEFAULT preenche linhas existentes).
ALTER TABLE "patients" ADD COLUMN "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "patients" ADD COLUMN "source" TEXT;
ALTER TABLE "patients" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "patients" ADD COLUMN "notes" TEXT;

-- 3. CPF e nascimento passam a ser opcionais (suporte a leads).
ALTER TABLE "patients" ALTER COLUMN "cpfEnc" DROP NOT NULL;
ALTER TABLE "patients" ALTER COLUMN "cpfHash" DROP NOT NULL;
ALTER TABLE "patients" ALTER COLUMN "birthDate" DROP NOT NULL;

CREATE INDEX "patients_organizationId_status_idx" ON "patients"("organizationId", "status");

-- 4. Linha do tempo de interações com o cliente.
CREATE TABLE "customer_interactions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "type" "InteractionType" NOT NULL DEFAULT 'NOTE',
    "note" TEXT NOT NULL,
    "authorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_interactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_interactions_organizationId_idx" ON "customer_interactions"("organizationId");
CREATE INDEX "customer_interactions_patientId_createdAt_idx" ON "customer_interactions"("patientId", "createdAt");
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
