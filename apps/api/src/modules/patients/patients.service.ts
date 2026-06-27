import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePatientInput, JwtClaims, Role, UpdatePatientInput } from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CryptoService } from '../../shared/crypto/crypto.service';
import { TenantContext } from '../../shared/tenant/tenant-context';

/** DTO de saída: CPF descriptografado e mascarado; nunca expõe cpfEnc/cpfHash. */
export interface PatientView {
  id: string;
  name: string;
  cpf: string; // mascarado: ***.***.***-**
  birthDate: Date;
  phone: string;
  email: string | null;
  userId: string | null;
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly tenant: TenantContext,
  ) {}

  async create(input: CreatePatientInput): Promise<PatientView> {
    const cpfHash = this.crypto.blindIndex(input.cpf);
    // cpfHash é único por empresa; o middleware de tenant injeta o organizationId no filtro.
    const existing = await this.prisma.patient.findFirst({ where: { cpfHash } });
    if (existing) throw new ConflictException('Paciente com este CPF já cadastrado');

    const patient = await this.prisma.patient.create({
      data: {
        organizationId: this.tenant.requireOrganizationId(),
        name: input.name,
        cpfEnc: this.crypto.encrypt(input.cpf),
        cpfHash,
        birthDate: input.birthDate,
        phone: input.phone,
        email: input.email ?? null,
        userId: input.userId ?? null,
      },
    });
    return this.toView(patient);
  }

  async findOne(id: string, actor: JwtClaims): Promise<PatientView> {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException('Paciente não encontrado');
    // Paciente só acessa o próprio prontuário; staff acessa todos.
    if (actor.role === Role.PATIENT && patient.userId !== actor.sub) {
      throw new ForbiddenException('Acesso negado ao prontuário de outro paciente');
    }
    return this.toView(patient);
  }

  /** Perfil do paciente vinculado ao usuário logado (autoatendimento). */
  async meProfile(userId: string): Promise<PatientView> {
    const patient = await this.prisma.patient.findUnique({ where: { userId } });
    if (!patient) throw new NotFoundException('Perfil de paciente não encontrado');
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

  /** O próprio paciente completa seu cadastro; vincula ao userId do token (um por usuário). */
  async createForUser(userId: string, input: CreatePatientInput): Promise<PatientView> {
    const existing = await this.prisma.patient.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Perfil de paciente já cadastrado');
    return this.create({ ...input, userId });
  }

  async list(): Promise<PatientView[]> {
    const patients = await this.prisma.patient.findMany({ orderBy: { name: 'asc' } });
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

  private async ensureExists(id: string): Promise<void> {
    const count = await this.prisma.patient.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Paciente não encontrado');
  }

  private toView(p: {
    id: string;
    name: string;
    cpfEnc: string;
    birthDate: Date;
    phone: string;
    email: string | null;
    userId: string | null;
  }): PatientView {
    // Decrypt resiliente: dado corrompido ou cifrado com chave antiga não derruba a lista.
    let masked = '***.***.***-**';
    try {
      const cpf = this.crypto.decrypt(p.cpfEnc);
      masked = `***.***.${cpf.slice(6, 9)}-**`;
    } catch {
      // mantém máscara genérica
    }
    return {
      id: p.id,
      name: p.name,
      cpf: masked,
      birthDate: p.birthDate,
      phone: p.phone,
      email: p.email,
      userId: p.userId,
    };
  }
}
