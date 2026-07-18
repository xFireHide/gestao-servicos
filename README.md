# Gestão de Serviços — multi-tenant SaaS (ERP-lite)

Management platform for **any appointment-based service business** (clinic, salon,
gym, workshop, consultancy). Started as a clinic scheduler and was generalized into
a **multi-tenant SaaS**: many companies in one system, data fully isolated per company.

TypeScript monorepo (pnpm + Turborepo): modular NestJS monolith + Next.js frontends.
Target market: Brazil / LGPD. Architecture decisions in [`infra/adr/`](infra/adr).

## Modules

| Domain | What it does |
|---|---|
| **Onboarding / Subscription** | Self-service company + first-admin signup (auto-login); FREE/PRO/BUSINESS plans, 14-day trial |
| **IAM** | JWT + refresh auth, RBAC (PATIENT/RECEPTIONIST/DOCTOR/ADMIN) |
| **Team & professionals** | Admin creates staff; professionals with specialty/registration and availability |
| **Scheduling** | Weekly availability, free slots, booking (DB-enforced anti-double-booking) |
| **Customers / CRM** | Customers and leads (LEAD/ACTIVE/INACTIVE funnel), source, tags, interaction timeline |
| **Service catalog** | Services with price (cents) and duration; optional link to bookings |
| **Finance** | Invoices + items, payments (partial/full), expenses, cash flow |
| **Reports / Dashboard** | Revenue, average ticket, bookings by status, top services, professional ranking |
| **Notifications** | In-process events + BullMQ queues (confirmation email) |

## Structure

```
apps/    api (NestJS modular monolith) · staff-web (Next.js :3000) · patient-web (:3002)
packages/ shared (Zod schemas + DTO types) · config (shared tsconfig/eslint)
infra/   docker-compose (Postgres/Redis/MinIO/MailHog) · adr (Architecture Decision Records)
```

## Multi-tenancy

Shared DB + row-level isolation: every domain table has `organizationId`, enforced in
the data layer — a Prisma middleware injects the `organizationId` (resolved from the JWT
via `AsyncLocalStorage`) into every query. See [ADR 0004](infra/adr/0004-multitenancy-saas.md).

## Development

```bash
corepack enable pnpm
pnpm install
docker compose -f infra/docker-compose.yml up -d      # Postgres/Redis/MinIO/MailHog
cp .env.example .env
pnpm --filter @clinica/api prisma migrate deploy       # migrations (incl. exclusion constraint)
pnpm --filter @clinica/api seed                        # fake data only (never real — LGPD)
pnpm dev                                               # api :3001 + staff-web :3000 + patient-web :3002
```

Staff portal at http://localhost:3000 (`/signup` for a new company) · customer portal at :3002.
Dev seed login (company `clinica-padrao`, dev only): `admin@clinica.local` / `senha123`.

> Dev infra uses host ports **5433** (Postgres) and **6380** (Redis) to avoid conflicts.

## Verification

```bash
pnpm --filter @clinica/api test:e2e    # 8 suites / 36 tests, all with cross-company isolation
pnpm lint && pnpm typecheck && pnpm build
```

## Architecture highlights

- **Multi-tenant** row-level isolation enforced at the data layer (ADR 0004).
- **Anti-double-booking** via Postgres GiST exclusion constraint (ADR 0002), with retry on transient deadlock.
- **RBAC**, **money always in cents** (no float), **audit trail** (LGPD).
- **Events** (`EventEmitter2`) + BullMQ queues, migratable to a broker (ADR 0003).

## Roadmap

- Automated billing via gateway (card/PIX) — plan changes are manual today.
- Per-plan limit enforcement (e.g. FREE = 1 professional); per-professional commission.
- Internal renaming (Doctor→Professional, Patient→Customer) — deferred (risk).
