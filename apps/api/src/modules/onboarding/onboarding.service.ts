import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  AuthTokens,
  OnboardingInput,
  Role,
  SubscriptionPlan,
  SubscriptionView,
  UpdateSubscriptionInput,
} from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from '../iam/auth.service';

const TRIAL_DAYS = 14;

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  plan: SubscriptionView['plan'];
  subscriptionStatus: SubscriptionView['status'];
  trialEndsAt: Date | null;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /** Cadastro self-service: cria empresa + 1º admin atomicamente e já autentica. */
  async register(input: OnboardingInput): Promise<AuthTokens> {
    const slugTaken = await this.prisma.organization.findUnique({ where: { slug: input.slug } });
    if (slugTaken) throw new ConflictException('Este identificador de empresa já está em uso');

    const emailTaken = await this.prisma.user.findUnique({ where: { email: input.adminEmail } });
    if (emailTaken) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await argon2.hash(input.adminPassword);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const admin = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: input.slug,
          businessType: input.businessType,
          plan: 'PRO',
          subscriptionStatus: 'TRIALING',
          trialEndsAt,
        },
      });
      return tx.user.create({
        data: {
          organizationId: org.id,
          name: input.adminName,
          email: input.adminEmail,
          passwordHash,
          role: Role.ADMIN,
        },
      });
    });

    return this.auth.issueTokensForUser({
      id: admin.id,
      email: admin.email,
      role: admin.role as Role,
      organizationId: admin.organizationId,
    });
  }

  async getSubscription(organizationId: string): Promise<SubscriptionView> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Empresa não encontrada');
    return this.toView(org);
  }

  /** Troca de plano manual (placeholder até a integração de cobrança). */
  async updateSubscription(
    organizationId: string,
    input: UpdateSubscriptionInput,
  ): Promise<SubscriptionView> {
    const org = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: input.plan as SubscriptionPlan,
        // Ao definir um plano manualmente, considera a assinatura ativa.
        subscriptionStatus: 'ACTIVE',
      },
    });
    return this.toView(org);
  }

  private toView(org: OrgRow): SubscriptionView {
    return {
      organizationId: org.id,
      name: org.name,
      slug: org.slug,
      businessType: org.businessType,
      plan: org.plan,
      status: org.subscriptionStatus,
      trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
    };
  }
}
