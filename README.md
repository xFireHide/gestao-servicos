# Gestão de Empresas — SaaS multiempresa (ERP-lite)

Plataforma de gestão para **qualquer negócio de serviços com hora marcada** (clínica, salão,
academia, oficina, consultoria...). Nasceu como um sistema de agendamento de clínica e foi
generalizada para um **SaaS multiempresa**: várias empresas no mesmo sistema, dados 100%
isolados por empresa.

Monorepo TypeScript (pnpm + Turborepo). Monólito modular em NestJS + frontends Next.js.
Mercado-alvo: Brasil / LGPD. Decisões de arquitetura em [`infra/adr/`](infra/adr).

## Módulos

| Domínio | O que faz |
|---|---|
| **Onboarding / Assinatura** | Cadastro self-service de empresa + 1º admin (auto-login); planos FREE/PRO/BUSINESS, trial de 14 dias |
| **IAM** | Autenticação JWT + refresh, RBAC (PATIENT/RECEPTIONIST/DOCTOR/ADMIN) |
| **Equipe & profissionais** | Admin cria membros da equipe; profissionais com especialidade/registro e disponibilidade |
| **Agendamento** | Disponibilidade semanal, slots livres, agendamento (anti-double-booking no banco) |
| **Clientes / CRM** | Cadastro de clientes e leads (funil LEAD/ACTIVE/INACTIVE), origem, tags, linha do tempo de interações |
| **Catálogo de serviços** | Serviços com preço (centavos) e duração; vínculo opcional ao agendamento |
| **Financeiro** | Faturas + itens, pagamentos (parcial/total), despesas e fluxo de caixa |
| **Relatórios / Dashboard** | Faturamento, ticket médio, agendamentos por status, serviços mais vendidos, ranking de profissionais |
| **Notificações** | Eventos in-process + filas BullMQ (e-mail de confirmação) |

## Estrutura
```
apps/
  api/          # NestJS — monólito modular multiempresa
                #   IAM, Onboarding/Subscription, Users(Equipe), Scheduling,
                #   Patients(CRM), Services, Finance, Reports, Notifications
  staff-web/    # Next.js (3000) — portal da equipe (RBAC):
                #   /signup, login, Dashboard, Agenda, Pacientes(+detalhe/CRM),
                #   Serviços, Equipe, Financeiro, Assinatura
  patient-web/  # Next.js (3002) — cliente: cadastro, autoagendamento, minhas consultas
packages/
  shared/       # schemas Zod + tipos de DTO (fonte única de verdade)
  config/       # tsconfig/eslint compartilhados
infra/
  docker-compose.yml  # Postgres + Redis + MinIO + MailHog
  adr/                # Architecture Decision Records
```

## Multi-tenancy (isolamento por empresa)

Banco compartilhado + isolamento por linha: toda tabela de domínio tem `organizationId`, e o
isolamento é **forçado na camada de acesso** — um middleware do Prisma injeta o `organizationId`
(resolvido do JWT via `AsyncLocalStorage`) em toda query. Detalhes em
[ADR 0004](infra/adr/0004-multitenancy-saas.md).

## Desenvolvimento
```bash
corepack enable pnpm          # habilita pnpm
pnpm install                  # instala dependências do workspace
docker compose -f infra/docker-compose.yml up -d   # sobe Postgres/Redis/MinIO/MailHog
cp .env.example .env
pnpm --filter @clinica/api prisma migrate deploy    # aplica as migrações (inclui exclusion constraint)
pnpm --filter @clinica/api seed                     # dados fake (nunca dados reais — LGPD)
pnpm dev                                            # sobe api (3001) + staff-web (3000) + patient-web (3002)
```

Portal da equipe em http://localhost:3000 · Portal do cliente em http://localhost:3002.

- **Criar nova empresa:** http://localhost:3000/signup (cadastro self-service + trial PRO).
- **Login seed da equipe** (empresa `clinica-padrao`, apenas dev): `admin@clinica.local` / `senha123`
  (também `recepcao@clinica.local` e `dra.ana@clinica.local`, mesma senha).
- O cliente cria a própria conta em `/register` no portal do cliente.

CI: `.github/workflows/ci.yml` roda lint + typecheck + build + e2e (com Postgres/Redis) em cada push/PR.

> Infra dev usa portas de host **5433** (Postgres) e **6380** (Redis) para evitar conflito com
> outros serviços locais — ver `.env.example`.

## Verificação
```bash
pnpm --filter @clinica/api test:e2e   # 8 suites / 36 testes: double-booking, financeiro, CRM,
                                       # relatórios, onboarding, equipe — todos com isolamento entre empresas
pnpm lint && pnpm typecheck && pnpm build
```

## Destaques de arquitetura
- **Multiempresa (SaaS)** com isolamento por linha forçado no acesso a dados (ADR 0004).
- **Anti-double-booking** garantido no banco via exclusion constraint GiST do Postgres (ADR 0002),
  com retry em deadlock transitório sob concorrência.
- **RBAC** com papéis PATIENT / RECEPTIONIST / DOCTOR / ADMIN.
- **Dinheiro sempre em centavos** (inteiros) — sem imprecisão de ponto flutuante.
- **Trilha de auditoria** (LGPD): registra quem acessou qual recurso e quando.
- **Eventos** in-process (`EventEmitter2`) + filas BullMQ; migráveis para broker (ADR 0003).

## Roadmap / pendências
- Cobrança automática via gateway (cartão/PIX) — a troca de plano hoje é manual.
- Enforcement de limites por plano (ex.: FREE = 1 profissional).
- Comissão por profissional.
- Generalização de nomenclatura interna (Doctor→Professional, Patient→Customer) — adiada por risco.
