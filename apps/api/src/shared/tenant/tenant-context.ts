import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Estado de tenant carregado por requisição. `organizationId` nulo = sem tenant (sistema/público). */
interface TenantStore {
  organizationId: string | null;
}

/**
 * Contexto de tenant por requisição via AsyncLocalStorage. O middleware estabelece
 * o "store" no início da request; o guard de autenticação preenche o organizationId
 * a partir das claims do JWT; o middleware do Prisma o lê para isolar os dados.
 *
 * O store é um objeto mutável compartilhado: criado antes dos guards e preenchido
 * por eles, de modo que toda query subsequente da request enxergue o org correto.
 */
@Injectable()
export class TenantContext {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  /** Executa `fn` dentro de um novo contexto de tenant (store inicia sem org). */
  run<T>(fn: () => T): T {
    return this.als.run({ organizationId: null }, fn);
  }

  /** Define o org da request atual (chamado pelo guard de autenticação). */
  setOrganizationId(organizationId: string | null): void {
    const store = this.als.getStore();
    if (store) store.organizationId = organizationId ?? null;
  }

  /** Org da request atual, ou null fora de uma request (seed/jobs/sistema). */
  getOrganizationId(): string | null {
    return this.als.getStore()?.organizationId ?? null;
  }

  /** Org da request atual; lança se ausente (uso em escritas que exigem tenant). */
  requireOrganizationId(): string {
    const organizationId = this.getOrganizationId();
    if (!organizationId) {
      throw new Error('Contexto de empresa (tenant) ausente para esta operação');
    }
    return organizationId;
  }
}
