import { Injectable, NestMiddleware } from '@nestjs/common';
import { TenantContext } from './tenant-context';

/**
 * Abre o contexto de tenant (AsyncLocalStorage) no início de cada requisição,
 * envolvendo todo o pipeline (guards -> controllers -> services -> Prisma). O org
 * em si é preenchido depois, pelo JwtAuthGuard, a partir das claims do token.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenant: TenantContext) {}

  use(_req: unknown, _res: unknown, next: () => void): void {
    this.tenant.run(() => next());
  }
}
