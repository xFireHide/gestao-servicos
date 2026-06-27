import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CashflowReport,
  CreateExpenseInput,
  CreateInvoiceInput,
  CreatePaymentInput,
  InvoiceStatus,
  InvoiceView,
  PaymentMethod,
} from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContext } from '../../shared/tenant/tenant-context';

interface PaymentRow {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  paidAt: Date;
  notes: string | null;
}
interface ItemRow {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  serviceId: string | null;
}
interface InvoiceRow {
  id: string;
  patientId: string;
  appointmentId: string | null;
  status: InvoiceStatus;
  totalCents: number;
  notes: string | null;
  issuedAt: Date;
  dueDate: Date | null;
  items: ItemRow[];
  payments: PaymentRow[];
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  async createInvoice(input: CreateInvoiceInput): Promise<InvoiceView> {
    const organizationId = this.tenant.requireOrganizationId();
    await this.ensurePatient(input.patientId);

    const totalCents = input.items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0);

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        patientId: input.patientId,
        appointmentId: input.appointmentId ?? null,
        dueDate: input.dueDate ?? null,
        notes: input.notes ?? null,
        totalCents,
        items: {
          create: input.items.map((it) => ({
            organizationId,
            description: it.description,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            serviceId: it.serviceId ?? null,
          })),
        },
      },
      include: { items: true, payments: true },
    });
    return this.toView(invoice);
  }

  async getInvoice(id: string): Promise<InvoiceView> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    return this.toView(invoice);
  }

  async listInvoices(filters: { status?: InvoiceStatus; patientId?: string }): Promise<InvoiceView[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
      },
      include: { items: true, payments: true },
      orderBy: { issuedAt: 'desc' },
    });
    return invoices.map((i) => this.toView(i));
  }

  /** Registra um pagamento e atualiza o status da fatura (OPEN -> PAID quando quitada). */
  async addPayment(invoiceId: string, input: CreatePaymentInput): Promise<InvoiceView> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Fatura cancelada não aceita pagamentos');
    }

    await this.prisma.payment.create({
      data: {
        organizationId: this.tenant.requireOrganizationId(),
        invoiceId,
        amountCents: input.amountCents,
        method: input.method,
        paidAt: input.paidAt ?? new Date(),
        notes: input.notes ?? null,
      },
    });

    const paid = invoice.payments.reduce((s, p) => s + p.amountCents, 0) + input.amountCents;
    if (paid >= invoice.totalCents && invoice.status !== InvoiceStatus.PAID) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.PAID },
      });
    }
    return this.getInvoice(invoiceId);
  }

  async cancelInvoice(id: string): Promise<InvoiceView> {
    const found = await this.prisma.invoice.findFirst({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('Fatura não encontrada');
    await this.prisma.invoice.update({ where: { id }, data: { status: InvoiceStatus.CANCELLED } });
    return this.getInvoice(id);
  }

  async createExpense(input: CreateExpenseInput) {
    return this.prisma.expense.create({
      data: {
        organizationId: this.tenant.requireOrganizationId(),
        description: input.description,
        amountCents: input.amountCents,
        category: input.category ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  async listExpenses() {
    return this.prisma.expense.findMany({ orderBy: { occurredAt: 'desc' } });
  }

  /** Fluxo de caixa do período: entradas (pagamentos) − saídas (despesas) + em aberto. */
  async cashflow(from: Date, to: Date): Promise<CashflowReport> {
    const [payments, expenses, openInvoices] = await Promise.all([
      this.prisma.payment.findMany({
        where: { paidAt: { gte: from, lte: to } },
        select: { amountCents: true, method: true },
      }),
      this.prisma.expense.findMany({
        where: { occurredAt: { gte: from, lte: to } },
        select: { amountCents: true },
      }),
      this.prisma.invoice.findMany({
        where: { status: InvoiceStatus.OPEN },
        select: { totalCents: true, payments: { select: { amountCents: true } } },
      }),
    ]);

    const inflowCents = payments.reduce((s, p) => s + p.amountCents, 0);
    const outflowCents = expenses.reduce((s, e) => s + e.amountCents, 0);
    const byMethod: Record<string, number> = {};
    for (const p of payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amountCents;
    const outstandingCents = openInvoices.reduce((s, inv) => {
      const paid = inv.payments.reduce((a, p) => a + p.amountCents, 0);
      return s + Math.max(0, inv.totalCents - paid);
    }, 0);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      inflowCents,
      outflowCents,
      balanceCents: inflowCents - outflowCents,
      byMethod,
      outstandingCents,
    };
  }

  private async ensurePatient(patientId: string): Promise<void> {
    const count = await this.prisma.patient.count({ where: { id: patientId } });
    if (count === 0) throw new NotFoundException('Cliente não encontrado');
  }

  private toView(inv: InvoiceRow): InvoiceView {
    const paidCents = inv.payments.reduce((s, p) => s + p.amountCents, 0);
    return {
      id: inv.id,
      patientId: inv.patientId,
      appointmentId: inv.appointmentId,
      status: inv.status,
      totalCents: inv.totalCents,
      paidCents,
      balanceCents: inv.totalCents - paidCents,
      notes: inv.notes,
      issuedAt: inv.issuedAt.toISOString(),
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      items: inv.items.map((it) => ({
        id: it.id,
        description: it.description,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        serviceId: it.serviceId,
      })),
      payments: inv.payments.map((p) => ({
        id: p.id,
        amountCents: p.amountCents,
        method: p.method,
        paidAt: p.paidAt.toISOString(),
        notes: p.notes,
      })),
    };
  }
}
