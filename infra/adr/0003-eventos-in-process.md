# ADR 0003 — Eventos in-process agora, broker depois

- **Status:** Aceito
- **Data:** 2026-06-16

## Contexto
A arquitetura-alvo usa Kafka/RabbitMQ para desacoplar domínios (ex.: `AppointmentScheduled` →
notificações). Operar um broker no MVP adiciona infraestrutura e modos de falha sem necessidade
comprovada.

## Decisão
Publicar eventos de domínio com `EventEmitter2` (in-process). O módulo `notifications` assina
`appointment.scheduled` e enfileira um job no **BullMQ (Redis)** — já assíncrono e durável o
suficiente para lembretes/e-mails. O contrato de evento (payload tipado em `@clinica/shared`)
é o mesmo que será publicado num broker no futuro.

## Consequências
- **+** Zero infra extra além do Redis (já necessário para cache/filas).
- **+** Migração para RabbitMQ/Kafka troca apenas o publisher/subscriber, mantendo o payload.
- **−** Eventos in-process não cruzam limites de processo — aceitável enquanto monólito (ADR 0001).
