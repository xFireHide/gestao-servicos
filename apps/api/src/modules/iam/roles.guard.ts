import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtClaims, Role } from '@clinica/shared';
import { ROLES_KEY } from '../../common/decorators';

/** Aplica RBAC: a rota só prossegue se o papel do usuário estiver permitido. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: JwtClaims }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Permissão insuficiente para este recurso');
    }
    return true;
  }
}
