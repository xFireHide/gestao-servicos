# ADR 0004 — Multi-tenancy (SaaS multiempresa) por banco compartilhado + isolamento por linha

- **Status:** Aceito
- **Data:** 2026-06-27

## Contexto
O produto deixou de ser um sistema de clínica única para se tornar um **SaaS de gestão para
qualquer empresa de serviços** (ERP-lite). Várias empresas-cliente (tenants) usam a mesma
instância, e os dados de uma **nunca** podem vazar para outra. A decisão de multi-tenancy é
arquitetural e cara de adiar, então foi feita já na fundação (Fase 1A), antes de generalizar o
domínio (clínica → negócio genérico).

## Decisão
**Banco compartilhado + schema compartilhado + isolamento por linha (`organizationId`).**

- Novo agregado `Organization` (tenant) com `slug` único e `businessType` (vertical).
- Toda tabela de domínio (`users`, `doctors`, `patients`, `availabilities`, `appointments`)
  ganha `organizationId NOT NULL` (FK `ON DELETE CASCADE`). `audit_logs` recebe a coluna como
  opcional (ações de sistema podem não ter tenant).
- Unicidade que era global passa a ser **por empresa**: `@@unique([organizationId, cpfHash])`
  (pacientes) e `@@unique([organizationId, crm])` (médicos). `users.email` permanece global
  (uma conta de login pertence a uma única empresa → login sem seleção de tenant).
- **Isolamento forçado na camada de acesso**: o contexto de tenant é carregado por requisição
  via `AsyncLocalStorage` (`TenantContext`); um middleware abre o contexto, o `JwtAuthGuard` o
  preenche a partir da claim `organizationId` do JWT, e um middleware do Prisma (`$use`) injeta
  `organizationId` no `where`/`data` de toda query dos modelos de tenant.
  - `findUnique`/`findUniqueOrThrow` são convertidos para `findFirst*` (mesmo retorno) para
    permitir o filtro por `organizationId` (limitação do Prisma: `where` único não aceita campo
    não-único).
  - Escritas por id (`update`/`delete`) ficam protegidas pela leitura org-guarded que as precede.
  - `$executeRaw` (INSERT do agendamento) **não** passa pelo `$use`: o `organizationId` é
    derivado do médico e informado explicitamente.
- Migração **faseada e reversível**: cria empresa padrão → adiciona coluna nullable → backfill
  dos dados existentes → trava `NOT NULL`. Os dados da clínica original migram para a empresa
  `clinica-padrao` sem perda.

## Consequências
- **+** Custo de infra baixo e operação simples (uma instância serve todas as empresas).
- **+** Isolamento transparente: serviços não precisam lembrar de filtrar por empresa.
- **+** Mesmo CPF/CRM pode existir em empresas diferentes sem conflito.
- **+** O mesmo código roda como instância isolada (on-premise) para um cliente que exigir.
- **−** Isolamento depende do contexto de tenant estar setado; rotas públicas (ex.: slots,
  registro) precisam resolver a empresa explicitamente (slug). Sem contexto, o `$use` não filtra.
- **−** `$use` do Prisma está deprecado (migrar para Client Extensions no futuro).
- **−** Sob concorrência, o INSERT do agendamento pode sofrer deadlock transitório (40P01) por
  interação das FKs com o índice de exclusão (ADR 0002); tratado com **retry** (na nova tentativa
  o conflito vem limpo como `23P01` → `409`).
- **Pendente (hardening):** converter writes por id para checagem explícita de tenant e cobrir
  todo entrypoint público com resolução de empresa quando o onboarding multi-tenant (Fase 6) for
  ligado.
