import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateInteractionInput,
  CreatePatientInput,
  CustomerStatus,
  InteractionView,
  JwtClaims,
  Role,
  UpdatePatientInput,
} from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { TenantContext } from '../../shared/tenant/tenant-context';

/** DTO de saída: CPF descriptografado e mascarado; nunca expõe cpfEnc/cpfHash. */
export interface PatientView {
  id: string;
  name: string;
  cpf: string | null; // mascarado: ***.***.***-** (null quando não informado)
  birthDate: Date | null;
  phone: string;
  email: string | null;
  userId: string | null;
  status: CustomerStatus;
  source: string | null;
  tags: string[];
  notes: string | null;
}

interface PatientRow {
  id: string;
  name: string;
  cpfEnc: string | null;
  birthDate: Date | null;
  phone: string;
  email: string | null;
  userId: string | null;
  status: CustomerStatus;
  source: string | null;
  tags: string[];
  notes: string | null;
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly tenant: TenantContext,
  ) {}

  async create(input: CreatePatientInput): Promise<PatientView> {
    // CPF é opcional (leads). Quando informado, vira hash p/ dedupe (único por empresa).
    const cpfHash = input.cpf ? this.crypto.blindIndex(input.cpf) : null;
    if (cpfHash) {
      const existing = await this.prisma.patient.findFirst({ where: { cpfHash } });
      if (existing) throw new ConflictException('Cliente com este CPF já cadastrado');
    }

    const patient = await this.prisma.patient.create({
      data: {
        organizationId: this.tenant.requireOrganizationId(),
        name: input.name,
        cpfEnc: input.cpf ? this.crypto.encrypt(input.cpf) : null,
        cpfHash,
        birthDate: input.birthDate ?? null,
        phone: input.phone,
        email: input.email ?? null,
        userId: input.userId ?? null,
        status: input.status,
        source: input.source ?? null,
        tags: input.tags ?? [],
        notes: input.notes ?? null,
      },
    });
    return this.toView(patient);
  }

  async findOne(id: string, actor: JwtClaims): Promise<PatientView> {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException('Cliente não encontrado');
    // Cliente/paciente só acessa o próprio cadastro; staff acessa todos.
    if (actor.role === Role.PATIENT && patient.userId !== actor.sub) {
      throw new ForbiddenException('Acesso negado ao cadastro de outro cliente');
    }
    return this.toView(patient);
  }

  /** Perfil do cliente vinculado ao usuário logado (autoatendimento). */
  async meProfile(userId: string): Promise<PatientView> {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new NotFoundException('Perfil de cliente não encontrado');
    return this.toView(patient);
  }

  /** Resolve o id do registro Patient a partir da conta de login. */
  async resolvePatientId(userId: string): Promise<string | null> {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });
    return patient?.id ?? null;
  }

  /** O próprio cliente completa seu cadastro; vincula ao userId do token (um por usuário). */
  async createForUser(userId: string, input: CreatePatientInput): Promise<PatientView> {
    const existing = await this.prisma.patient.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Perfil de cliente já cadastrado');
    return this.create({ ...input, userId });
  }

  /** Lista clientes, opcionalmente filtrando pelo estágio do funil (CRM). */
  async list(status?: CustomerStatus): Promise<PatientView[]> {
    const patients = await this.prisma.patient.findMany({
      where: status ? { status } : undefined,
      orderBy: { name: 'asc' },
    });
    return patients.map((p) => this.toView(p));
  }

  async update(id: string, input: UpdatePatientInput): Promise<PatientView> {
    await this.ensureExists(id);
    const data: Record<string, unknown> = { ...input };
    if (input.cpf) {
      data.cpfEnc = this.crypto.encrypt(input.cpf);
      data.cpfHash = this.crypto.blindIndex(input.cpf);
      delete data.cpf;
    }
    const patient = await this.prisma.patient.update({ where: { id }, data });
    return this.toView(patient);
  }

  /** Registra uma interação na linha do tempo do cliente (CRM). */
  async addInteraction(
    patientId: string,
    input: CreateInteractionInput,
    actor: JwtClaims,
  ): Promise<InteractionView> {
    await this.ensureExists(patientId);
    const interaction = await this.prisma.customerInteraction.create({
      data: {
        organizationId: this.tenant.requireOrganizationId(),
        patientId,
        type: input.type,
        note: input.note,
        authorId: actor.sub,
      },
    });
    return this.toInteractionView(interaction);
  }

  /** Linha do tempo do cliente (mais recentes primeiro). */
  async listInteractions(patientId: string): Promise<InteractionView[]> {
    await this.ensureExists(patientId);
    const items = await this.prisma.customerInteraction.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((i) => this.toInteractionView(i));
  }

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.patient.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Cliente não encontrado');
  }

  private toView(p: PatientRow): PatientView {
    // Decrypt resiliente: dado corrompido ou cifrado com chave antiga não derruba a lista.
    let cpf: string | null = null;
    if (p.cpfEnc) {
      cpf = '***.***.***-**';
      try {
        const plain = this.crypto.decrypt(p.cpfEnc);
        cpf = `***.***.${plain.slice(6, 9)}-**`;
      } catch {
        // mantém máscara genérica
      }
    }
    return {
      id: p.id,
      name: p.name,
      cpf,
      birthDate: p.birthDate,
      phone: p.phone,
      email: p.email,
      userId: p.userId,
      status: p.status,
      source: p.source,
      tags: p.tags,
      notes: p.notes,
    };
  }

  private toInteractionView(i: {
    id: string;
    type: InteractionView['type'];
    note: string;
    authorId: string | null;
    createdAt: Date;
  }): InteractionView {
    return {
      id: i.id,
      type: i.type,
      note: i.note,
      authorId: i.authorId,
      createdAt: i.createdAt.toISOString(),
    };
  }
}
