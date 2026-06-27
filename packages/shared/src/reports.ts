import { z } from 'zod';

/** Janela de tempo de um relatório. */
export const reportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export interface TopService {
  label: string;
  count: number; // unidades vendidas
  revenueCents: number; // qtd * preço unitário
}

export interface ProfessionalStat {
  professionalId: string;
  name: string;
  appointments: number;
}

/** Visão consolidada (dashboard) de um período. */
export interface ReportOverview {
  from: string;
  to: string;
  revenueCents: number; // recebimentos (pagamentos) no período
  invoicedCents: number; // total faturado (faturas emitidas no período)
  outstandingCents: number; // saldo devedor de faturas em aberto
  paidInvoices: number;
  openInvoices: number;
  avgTicketCents: number; // ticket médio por atendimento no período
  appointments: {
    total: number;
    byStatus: Record<string, number>;
  };
  topServices: TopService[];
  byProfessional: ProfessionalStat[];
}
