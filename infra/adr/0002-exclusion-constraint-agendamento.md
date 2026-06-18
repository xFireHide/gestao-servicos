# ADR 0002 — Prevenção de double-booking via exclusion constraint do PostgreSQL

- **Status:** Aceito
- **Data:** 2026-06-16

## Contexto
O requisito crítico do sistema é impedir que dois agendamentos do mesmo médico se sobreponham
sob concorrência (dois pacientes reservando o mesmo horário simultaneamente). Validar apenas em
código (ler-depois-escrever) é vulnerável a condições de corrida entre transações concorrentes.

## Decisão
Garantir a invariante **no nível do banco** com uma constraint de exclusão GiST baseada em
**expressão** (sem coluna extra, para não causar drift no Prisma):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist ("doctorId" WITH =, tstzrange("startAt", "endAt") WITH &&)
  WHERE ("status" <> 'CANCELLED');
```

A aplicação cria o agendamento dentro de uma transação; se a constraint for violada, o Postgres
lança erro `23P01` (exclusion_violation), traduzido pela aplicação em `409 Conflict`
("horário indisponível").

## Consequências
- **+** Correção garantida independentemente da lógica de aplicação ou de corridas.
- **+** Agendamentos cancelados liberam o horário (cláusula `WHERE`).
- **+** Constraint por expressão → o Prisma não enxerga colunas extras (sem drift).
- **−** Constraint aplicada via migration SQL custom; aplicar com `prisma migrate deploy`.
- **−** Requer extensão `btree_gist` (disponível no Postgres padrão).
