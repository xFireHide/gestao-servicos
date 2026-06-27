-- ===========================================================================
-- CATÁLOGO DE SERVIÇOS (Fase 1B / generalização)
-- Generaliza "consulta" para qualquer serviço de negócio (preço + duração).
-- Aditivo e não-destrutivo: o agendamento ganha um vínculo OPCIONAL a um serviço.
-- ===========================================================================

-- 1. Catálogo de serviços (escopo por empresa).
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "services_organizationId_idx" ON "services"("organizationId");
ALTER TABLE "services" ADD CONSTRAINT "services_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Vínculo opcional do agendamento ao serviço.
ALTER TABLE "appointments" ADD COLUMN "serviceId" UUID;
CREATE INDEX "appointments_serviceId_idx" ON "appointments"("serviceId");
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
