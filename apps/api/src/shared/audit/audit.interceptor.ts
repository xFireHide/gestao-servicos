import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { JwtClaims } from '@clinica/shared';
import { AuditService } from './audit.service';

export const AUDIT_KEY = 'audit:action';

/** Anota uma rota para auditar o acesso. `resource` usa :param da rota, ex.: 'patient::id'. */
export const Audit = (action: string, resource: string) =>
  SetMetadata(AUDIT_KEY, { action, resource });

interface AuditMeta {
  action: string;
  resource: string;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_KEY, context.getHandler());
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<{
      user?: JwtClaims;
      params: Record<string, string>;
      ip?: string;
    }>();

    // Resolve :params no template do recurso (ex.: 'patient::id' -> 'patient:<uuid>').
    const resource = meta.resource.replace(/:(\w+)/g, (_m, key: string) => req.params[key] ?? '?');

    return next.handle().pipe(
      tap(() => {
        void this.audit.record({
          actorId: req.user?.sub ?? null,
          actorRole: req.user?.role ?? null,
          action: meta.action,
          resource,
          ip: req.ip ?? null,
        });
      }),
    );
  }
}
