import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import {
  AuthTokens,
  JwtClaims,
  LoginInput,
  RegisterInput,
  Role,
} from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { Env } from '../../config/env';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Autoatendimento público cria sempre PATIENT; outros papéis só por ADMIN. */
  async register(input: RegisterInput): Promise<AuthTokens> {
    const organizationId = await this.resolveOrganizationId(input.orgSlug);

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        // organizationId explícito: rota pública não tem contexto de tenant ativo.
        organizationId,
        name: input.name,
        email: input.email,
        passwordHash,
        role: Role.PATIENT,
      },
    });
    return this.issueTokens({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      organizationId: user.organizationId,
    });
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.issueTokens({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      organizationId: user.organizationId,
    });
  }

  /**
   * Resolve a empresa (tenant) do cadastro. Usa o slug informado pela página da
   * empresa; na ausência dele, cai para a única empresa existente (compat. single-tenant).
   */
  private async resolveOrganizationId(orgSlug?: string): Promise<string> {
    if (orgSlug) {
      const org = await this.prisma.organization.findUnique({ where: { slug: orgSlug } });
      if (!org) throw new BadRequestException('Empresa não encontrada');
      return org.id;
    }
    const orgs = await this.prisma.organization.findMany({ take: 2, select: { id: true } });
    const only = orgs.length === 1 ? orgs[0] : undefined;
    if (only) return only.id;
    throw new BadRequestException('Informe a empresa (orgSlug) para se cadastrar');
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let claims: JwtClaims;
    try {
      claims = await this.jwt.verifyAsync<JwtClaims>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token revogado ou expirado');
    }

    // Rotação: revoga o token usado e emite um novo par.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens({
      sub: claims.sub,
      email: claims.email,
      role: claims.role,
      organizationId: claims.organizationId,
    });
  }

  private async issueTokens(claims: JwtClaims): Promise<AuthTokens> {
    const accessTtl = this.config.get('JWT_ACCESS_TTL', { infer: true });
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });

    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(claims, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: refreshTtl,
      jwtid: randomBytes(16).toString('hex'),
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: claims.sub,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
