import { Injectable } from '@nestjs/common';
import { ProfessionalStat, ReportOverview, TopService } from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Visão consolidada do período (isolamento por empresa via middleware do Prisma). */
  async overview(from: Date, to: Date): Promise<ReportOverview> {
    const [payments, invoices, openInvoices, appointments] = await Promise.all([
      this.prisma.payment.findMany({
        where: { paidAt: { gte: from, lte: to } },
        select: { amountCents: true },
      }),
      this.prisma.invoice.findMany({
        where: { issuedAt: { gte: from, lte: to } },
        select: {
          status: true,
          totalCents: true,
          items: { select: { description: true, quantity: true, unitPriceCents: true, serviceId: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: { status: 'OPEN' },
        select: { totalCents: true, payments: { select: { amountCents: true } } },
      }),
      this.prisma.appointment.findMany({
        where: { startAt: { gte: from, lte: to } },
        select: { status: true, doctor: { select: { id: true, user: { select: { name: true } } } } },
      }),
    ]);

    const revenueCents = payments.reduce((s, p) => s + p.amountCents, 0);
    const invoicedCents = invoices.reduce((s, i) => s + i.totalCents, 0);
    const paidInvoices = invoices.filter((i) => i.status === 'PAID').length;
    const openInvoicesCount = invoices.filter((i) => i.status === 'OPEN').length;
    const outstandingCents = openInvoices.reduce((s, inv) => {
      const paid = inv.payments.reduce((a, p) => a + p.amountCents, 0);
      return s + Math.max(0, inv.totalCents - paid);
    }, 0);

    // Serviços mais vendidos (por descrição do item da fatura).
    const svcMap = new Map<string, TopService>();
    for (const inv of invoices) {
      for (const it of inv.items) {
        const key = it.serviceId ?? it.description;
        const entry = svcMap.get(key) ?? { label: it.description, count: 0, revenueCents: 0 };
        entry.count += it.quantity;
        entry.revenueCents += it.quantity * it.unitPriceCents;
        svcMap.set(key, entry);
      }
    }
    const topServices = [...svcMap.values()]
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5);

    // Agendamentos: total, por status e ranking por profissional.
    const byStatus: Record<string, number> = {};
    const profMap = new Map<string, ProfessionalStat>();
    for (const a of appointments) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      const stat = profMap.get(a.doctor.id) ?? {
        professionalId: a.doctor.id,
        name: a.doctor.user.name,
        appointments: 0,
      };
      stat.appointments += 1;
      profMap.set(a.doctor.id, stat);
    }
    const byProfessional = [...profMap.values()].sort((a, b) => b.appointments - a.appointments);

    const avgTicketCents = appointments.length > 0 ? Math.round(revenueCents / appointments.length) : 0;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      revenueCents,
      invoicedCents,
      outstandingCents,
      paidInvoices,
      openInvoices: openInvoicesCount,
      avgTicketCents,
      appointments: { total: appointments.length, byStatus },
      topServices,
      byProfessional,
    };
  }
}
