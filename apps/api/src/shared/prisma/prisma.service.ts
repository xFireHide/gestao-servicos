import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Código de erro do PostgreSQL para violação de exclusion constraint. */
export const PG_EXCLUSION_VIOLATION = '23P01';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
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
}
