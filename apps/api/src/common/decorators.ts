import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { JwtClaims, Role } from '@clinica/shared';

/** Marca uma rota como pública (sem JWT). */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe a rota aos papéis informados (RBAC). */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Injeta as claims do usuário autenticado. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtClaims => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtClaims }>();
    return request.user;
  },
);
