import { Global, Module } from '@nestjs/common';
import { TenantContext } from './tenant-context';

/** Disponibiliza o contexto de tenant globalmente (usado pelo Prisma, guards e services). */
@Global()
@Module({
  providers: [TenantContext],
  exports: [TenantContext],
})
export class TenantModule {}
