# Sistema de Agendamento para Clínica Médica

Monorepo TypeScript (pnpm + Turborepo). Monólito modular em NestJS + frontends Next.js.
Mercado-alvo: Brasil / LGPD. Veja as decisões de arquitetura em [`infra/adr/`](infra/adr).

## Estrutura
```
apps/
  api/          # NestJS — monólito modular (IAM, Scheduling, Patients, Doctors, Notifications)
  staff-web/    # Next.js (3000) — Recepção/Admin + Médico (RBAC): login, pacientes, agenda
  patient-web/  # Next.js (3002) — paciente: cadastro, autoagendamento, minhas consultas
packages/
  shared/       # schemas Zod + tipos de DTO (fonte única de verdade)
  config/       # tsconfig/eslint compartilhados
infra/
  docker-compose.yml  # Postgres + Redis + MinIO + MailHog
  adr/                # Architecture Decision Records
```

## Desenvolvimento
```bash
corepack enable pnpm          # habilita pnpm
pnpm install                  # instala dependências do workspace
docker compose -f infra/docker-compose.yml up -d   # sobe Postgres/Redis/MinIO/MailHog
cp .env.example .env
pnpm --filter @clinica/api prisma migrate dev       # cria schema + exclusion constraint
pnpm --filter @clinica/api seed                     # dados fake (nunca dados reais — LGPD)
pnpm dev                                            # sobe api (3001) + staff-web (3000) + patient-web (3002)
```

Portal da equipe em http://localhost:3000 · Portal do paciente em http://localhost:3002.
Login seed da equipe (apenas dev): `admin@clinica.local` / `senha123`
(também `recepcao@clinica.local` e `dra.ana@clinica.local`, mesma senha). O paciente cria a própria
conta em `/register` no portal do paciente.

CI: `.github/workflows/ci.yml` roda lint + typecheck + build + e2e (com Postgres/Redis) em cada push/PR.

> Infra dev usa portas de host **5433** (Postgres) e **6380** (Redis) para evitar conflito com
> outros serviços locais — ver `.env.example`.

## Verificação
```bash
pnpm --filter @clinica/api test:e2e   # inclui teste de corrida de double-booking
pnpm lint && pnpm typecheck && pnpm build
```

## Destaques de arquitetura
- **Anti-double-booking** garantido no banco via exclusion constraint GiST do Postgres (ADR 0002).
- **RBAC** com papéis PATIENT / RECEPTIONIST / DOCTOR / ADMIN.
- **Trilha de auditoria** (LGPD): registra quem acessou qual prontuário e quando.
- **Eventos** in-process (`EventEmitter2`) + filas BullMQ; migráveis para broker (ADR 0003).
