-- ===========================================================================
-- FUNDAÇÃO MULTIEMPRESA (Fase 1A)
-- Introduz Organization (tenant) e vincula todo dado de domínio a uma empresa.
-- Estratégia faseada e reversível: cria empresa padrão -> adiciona coluna
-- nullable -> backfill -> trava NOT NULL. Dados de clínica existentes migram
-- para a empresa padrão sem perda.
-- ===========================================================================

-- 1. Vertical de negócio (tenant).
CREATE TYPE "BusinessType" AS ENUM ('CLINIC', 'SALON', 'GYM', 'WORKSHOP', 'CONSULTING', 'GENERIC');

-- 2. Tabela de empresas (tenants).
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL DEFAULT 'GENERIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- 3. Empresa padrão para backfill (a clínica que originou o produto).
INSERT INTO "organizations" ("id", "name", "slug", "businessType", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Clínica (padrão)', 'clinica-padrao', 'CLINIC', now());

-- 4. Colunas organizationId nullable (para permitir backfill antes do NOT NULL).
ALTER TABLE "users" ADD COLUMN "organizationId" UUID;
ALTER TABLE "doctors" ADD COLUMN "organizationId" UUID;
ALTER TABLE "patients" ADD COLUMN "organizationId" UUID;
ALTER TABLE "availabilities" ADD COLUMN "organizationId" UUID;
ALTER TABLE "appointments" ADD COLUMN "organizationId" UUID;
ALTER TABLE "audit_logs" ADD COLUMN "organizationId" UUID;

-- 5. Backfill: tudo que já existe pertence à empresa padrão.
UPDATE "users"          SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "doctors"        SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "patients"       SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "availabilities" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "appointments"   SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "audit_logs"     SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;

-- 6. Trava NOT NULL nas tabelas de domínio (audit_logs permanece opcional).
ALTER TABLE "users"          ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "doctors"        ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "patients"       ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "availabilities" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "appointments"   ALTER COLUMN "organizationId" SET NOT NULL;

-- 7. Unicidade passa a ser por empresa (mesmo CPF/CRM pode existir em empresas distintas).
DROP INDEX "doctors_crm_key";
CREATE UNIQUE INDEX "doctors_organizationId_crm_key" ON "doctors"("organizationId", "crm");
DROP INDEX "patients_cpfHash_key";
CREATE UNIQUE INDEX "patients_organizationId_cpfHash_key" ON "patients"("organizationId", "cpfHash");

-- 8. Índices de tenant (filtro de isolamento usa organizationId em toda query).
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX "doctors_organizationId_idx" ON "doctors"("organizationId");
CREATE INDEX "patients_organizationId_idx" ON "patients"("organizationId");
CREATE INDEX "availabilities_organizationId_idx" ON "availabilities"("organizationId");
CREATE INDEX "appointments_organizationId_idx" ON "appointments"("organizationId");
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- 9. Foreign keys para organizations (ON DELETE CASCADE: apagar empresa apaga seus dados).
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
