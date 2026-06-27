import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantContext } from '../tenant/tenant-context';
import { createTenantMiddleware } from './tenant-prisma.middleware';

/** Código de erro do PostgreSQL para violação de exclusion constraint. */
export const PG_EXCLUSION_VIOLATION = '23P01';
/** Deadlock / falha de serialização: transitórios, devem ser repetidos. */
export const PG_DEADLOCK = '40P01';
export const PG_SERIALIZATION_FAILURE = '40001';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly tenant: TenantContext) {
    super();
    // Isolamento multiempresa: toda query passa pelo filtro de tenant (ver middleware).
    this.$use(createTenantMiddleware(this.tenant));
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Verdadeiro se o erro for a violação da constraint anti-double-booking (ADR 0002). */
  static isOverlapViolation(err: unknown): boolean {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2010') {
      // P2010 = raw query failed; meta.code carrega o SQLSTATE do Postgres.
      if ((err.meta as { code?: string } | undefined)?.code === PG_EXCLUSION_VIOLATION) {
        return true;
      }
    }
    const message = (err as { message?: unknown })?.message;
    return (
      typeof message === 'string' &&
      (message.includes('appointments_no_overlap') ||
        message.includes(PG_EXCLUSION_VIOLATION))
    );
  }

  /**
   * Verdadeiro se o erro for transitório (deadlock / falha de serialização). Sob
   * concorrência, dois INSERTs sobrepostos podem entrar em espera mútua no índice
   * de exclusão e o Postgres abortar um com 40P01 — o correto é repetir a operação.
   */
  static isTransientConflict(err: unknown): boolean {
    const code =
      err instanceof Prisma.PrismaClientKnownRequestError
        ? ((err.meta as { code?: string } | undefined)?.code ?? err.code)
        : undefined;
    if (code === PG_DEADLOCK || code === PG_SERIALIZATION_FAILURE) return true;
    const message = (err as { message?: unknown })?.message;
    return (
      typeof message === 'string' &&
      (message.includes(PG_DEADLOCK) || message.includes(PG_SERIALIZATION_FAILURE))
    );
  }
}
