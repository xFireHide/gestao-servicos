import { z } from 'zod';

/** Situação de uma fatura. */
export const InvoiceStatus = {
  OPEN: 'OPEN',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export const invoiceStatusSchema = z.nativeEnum(InvoiceStatus);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

/** Meio de pagamento. */
export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  PIX: 'PIX',
  TRANSFER: 'TRANSFER',
  OTHER: 'OTHER',
} as const;
export const paymentMethodSchema = z.nativeEnum(PaymentMethod);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

const amountCentsSchema = z.number().int().min(0).max(1_000_000_000);

export const invoiceItemInputSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(10_000).default(1),
  unitPriceCents: amountCentsSchema,
  serviceId: z.string().uuid().optional(),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const createInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(invoiceItemInputSchema).min(1).max(100),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const createPaymentSchema = z.object({
  amountCents: amountCentsSchema.refine((v) => v > 0, { message: 'Valor deve ser positivo' }),
  method: paymentMethodSchema.default(PaymentMethod.CASH),
  paidAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const createExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amountCents: amountCentsSchema.refine((v) => v > 0, { message: 'Valor deve ser positivo' }),
  category: z.string().max(80).optional(),
  occurredAt: z.coerce.date().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/** Janela do relatório de fluxo de caixa. */
export const cashflowQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type CashflowQuery = z.infer<typeof cashflowQuerySchema>;

// --- Views (saída) ---

export interface InvoiceItemView {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  serviceId: string | null;
}

export interface PaymentView {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  paidAt: string;
  notes: string | null;
}

export interface InvoiceView {
  id: string;
  patientId: string;
  appointmentId: string | null;
  status: InvoiceStatus;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  notes: string | null;
  issuedAt: string;
  dueDate: string | null;
  items: InvoiceItemView[];
  payments: PaymentView[];
}

export interface CashflowReport {
  from: string;
  to: string;
  inflowCents: number; // recebimentos no período
  outflowCents: number; // despesas no período
  balanceCents: number; // saldo (entradas - saídas)
  byMethod: Record<string, number>; // recebimentos por meio de pagamento
  outstandingCents: number; // total em aberto (faturas OPEN, saldo devedor)
}
