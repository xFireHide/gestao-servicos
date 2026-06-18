-- Enums
CREATE TYPE "Role" AS ENUM ('PATIENT', 'RECEPTIONIST', 'DOCTOR', 'ADMIN');
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- doctors
CREATE TABLE "doctors" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "specialty" TEXT NOT NULL,
    "crm" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "doctors_userId_key" ON "doctors"("userId");
CREATE UNIQUE INDEX "doctors_crm_key" ON "doctors"("crm");

-- patients
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "cpfEnc" TEXT NOT NULL,
    "cpfHash" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "patients_userId_key" ON "patients"("userId");
CREATE UNIQUE INDEX "patients_cpfHash_key" ON "patients"("cpfHash");

-- availabilities
CREATE TABLE "availabilities" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL,
    CONSTRAINT "availabilities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "availabilities_doctorId_weekday_idx" ON "availabilities"("doctorId", "weekday");

-- appointments
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "appointments_doctorId_startAt_idx" ON "appointments"("doctorId", "startAt");
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- audit_logs
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "ip" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- Foreign keys
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===========================================================================
-- ANTI-DOUBLE-BOOKING (ADR 0002): impede sobreposição de horários do mesmo
-- médico no nível do banco, mesmo sob concorrência. Consultas canceladas
-- liberam o horário (cláusula WHERE).
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
    EXCLUDE USING gist ("doctorId" WITH =, tstzrange("startAt", "endAt") WITH &&)
    WHERE ("status" <> 'CANCELLED');
