#!/usr/bin/env bash
# Sobe o ambiente completo de desenvolvimento:
# infra (Postgres/Redis/MinIO/MailHog) -> migrações -> seed -> apps (api + portais).
#
# Uso:
#   ./run.sh           # sobe tudo e inicia os apps em modo dev
#   ./run.sh --reset   # zera o banco (apaga volumes) antes de subir
set -euo pipefail
cd "$(dirname "$0")"

info() { printf "\n\033[1;34m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✖ %s\033[0m\n" "$1"; exit 1; }

command -v docker >/dev/null 2>&1 || fail "Docker não encontrado. Instale o Docker Desktop e tente de novo."
docker info >/dev/null 2>&1 || fail "Docker não está rodando. Abra o Docker Desktop e tente de novo."

if [ "${1:-}" = "--reset" ]; then
  info "Resetando banco (apagando volumes)..."
  docker compose -f infra/docker-compose.yml down -v
fi

info "Subindo infra (Postgres/Redis/MinIO/MailHog)..."
docker compose -f infra/docker-compose.yml up -d

info "Aguardando o Postgres aceitar conexões..."
for i in $(seq 1 60); do
  if docker exec clinica-postgres pg_isready -U clinica >/dev/null 2>&1; then break; fi
  [ "$i" = "60" ] && fail "Postgres não respondeu em 60s."
  sleep 1
done

if [ ! -f .env ]; then
  cp .env.example .env
  info ".env criado a partir do .env.example (ajuste os segredos antes de produção)."
fi

info "Habilitando pnpm e instalando dependências..."
corepack enable pnpm >/dev/null 2>&1 || true
pnpm install

info "Aplicando migrações do banco..."
pnpm --filter @clinica/api prisma migrate deploy

info "Populando dados de exemplo (seed — apenas dev)..."
pnpm --filter @clinica/api seed

info "Subindo os apps: API :3001 · Equipe :3000 · Cliente :3002"
echo "   Portal da equipe:  http://localhost:3000  (criar empresa: /signup)"
echo "   Portal do cliente: http://localhost:3002"
echo "   E-mails de teste (MailHog): http://localhost:8025"
pnpm dev
