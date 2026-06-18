import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { jwtClaimsSchema } from '@clinica/shared';
import type { Env } from '../../config/env';
import { IS_PUBLIC_KEY } from '../../common/decorators';

/** Valida o JWT de acesso e popula request.user, exceto em rotas @Public. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: unknown;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso ausente');
    }
    const token = header.slice('Bearer '.length);

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      request.user = jwtClaimsSchema.parse(payload);
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso inválido ou expirado');
    }
  }
}
