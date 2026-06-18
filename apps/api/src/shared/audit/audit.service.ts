import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  resource: string;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Trilha de auditoria append-only (LGPD): registra acessos a recursos sensíveis. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          actorRole: entry.actorRole ?? null,
          action: entry.action,
          resource: entry.resource,
          ip: entry.ip ?? null,
          metadata: (entry.metadata ?? undefined) as never,
        },
      });
    } catch (err) {
      // Auditoria nunca deve derrubar a requisição principal — apenas registra a falha.
      this.logger.error(`Falha ao gravar auditoria: ${String(err)}`);
    }
  }
}
