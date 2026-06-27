import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateServiceInput, ServiceView, UpdateServiceInput } from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContext } from '../../shared/tenant/tenant-context';

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
  active: boolean;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  async create(input: CreateServiceInput): Promise<ServiceView> {
    const service = await this.prisma.service.create({
      data: {
        organizationId: this.tenant.requireOrganizationId(),
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
        durationMinutes: input.durationMinutes,
        active: input.active ?? true,
      },
    });
    return this.toView(service);
  }

  /** Lista o catálogo da empresa atual (isolamento por tenant no middleware do Prisma). */
  async list(): Promise<ServiceView[]> {
    const services = await this.prisma.service.findMany({ orderBy: { name: 'asc' } });
    return services.map((s) => this.toView(s));
  }

  async update(id: string, input: UpdateServiceInput): Promise<ServiceView> {
    await this.ensureExists(id);
    const service = await this.prisma.service.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        priceCents: input.priceCents,
        durationMinutes: input.durationMinutes,
        active: input.active,
      },
    });
    return this.toView(service);
  }

  /** Desativação lógica: preserva histórico de agendamentos que referenciam o serviço. */
  async deactivate(id: string): Promise<ServiceView> {
    await this.ensureExists(id);
    const service = await this.prisma.service.update({ where: { id }, data: { active: false } });
    return this.toView(service);
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.service.findFirst({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('Serviço não encontrado');
  }

  private toView(s: ServiceRow): ServiceView {
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      priceCents: s.priceCents,
      durationMinutes: s.durationMinutes,
      active: s.active,
    };
  }
}
