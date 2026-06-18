# ADR 0001 — Monólito modular como ponto de partida

- **Status:** Aceito
- **Data:** 2026-06-16

## Contexto
A arquitetura-alvo descreve microsserviços (IAM, Scheduling, Patients, Notifications, Billing) com
API Gateway e broker de mensagens (Kafka/RabbitMQ). Para um MVP de clínica, essa infraestrutura
impõe custo operacional e complexidade desproporcionais ao valor entregue inicialmente.

## Decisão
Construir um **monólito modular** em NestJS. Cada domínio é um módulo NestJS isolado
(`modules/iam`, `modules/scheduling`, `modules/patients`, `modules/notifications`) com fronteiras
explícitas: comunicação entre domínios via eventos in-process (`EventEmitter2`) e interfaces de
serviço, nunca acessando o repositório de outro módulo diretamente.

## Consequências
- **+** Um único deploy, um Postgres, transações locais simples, DX rápida.
- **+** Cada módulo mapeia 1:1 para um futuro microsserviço — extração evolutiva (ADR 0003).
- **−** Escala vertical até o ponto em que um domínio precise escalar isoladamente.
- **Gatilho de revisão:** quando `scheduling` ou `notifications` exigir escala/deploy independente.
