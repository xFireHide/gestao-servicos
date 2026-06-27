import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { CreateStaffUserInput, Role, StaffRole, StaffUserView } from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContext } from '../../shared/tenant/tenant-context';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  doctor: { id: string; specialty: string; crm: string } | null;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  /** Admin cria um membro da equipe; se for médico, também cria o perfil de profissional. */
  async create(input: CreateStaffUserInput): Promise<StaffUserView> {
    const organizationId = this.tenant.requireOrganizationId();

    const emailTaken = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await argon2.hash(input.password);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { organizationId, name: input.name, email: input.email, passwordHash, role: input.role },
        });
        if (input.role === Role.DOCTOR) {
          await tx.doctor.create({
            data: {
              organizationId,
              userId: created.id,
              specialty: input.specialty as string,
              crm: input.crm as string,
            },
          });
        }
        return tx.user.findUniqueOrThrow({
          where: { id: created.id },
          include: { doctor: { select: { id: true, specialty: true, crm: true } } },
        });
      });
      return this.toView(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Registro profissional (CRM) já cadastrado nesta empresa');
      }
      throw err;
    }
  }

  /** Lista a equipe interna (exclui clientes/pacientes). */
  async list(): Promise<StaffUserView[]> {
    const users = await this.prisma.user.findMany({
      where: { role: { not: Role.PATIENT } },
      include: { doctor: { select: { id: true, specialty: true, crm: true } } },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => this.toView(u));
  }

  private toView(u: UserRow): StaffUserView {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as StaffRole,
      doctorId: u.doctor?.id ?? null,
      specialty: u.doctor?.specialty ?? null,
      crm: u.doctor?.crm ?? null,
    };
  }
}
