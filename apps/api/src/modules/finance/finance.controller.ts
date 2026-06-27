import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  cashflowQuerySchema,
  createExpenseSchema,
  CreateExpenseInput,
  createInvoiceSchema,
  CreateInvoiceInput,
  createPaymentSchema,
  CreatePaymentInput,
  invoiceStatusSchema,
  Role,
} from '@clinica/shared';
import { FinanceService } from './finance.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Roles } from '../../common/decorators';

@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  // --- Faturas ---

  @Post('invoices')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  createInvoice(@Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput) {
    return this.finance.createInvoice(body);
  }

  @Get('invoices')
  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  listInvoices(@Query('status') status?: string, @Query('patientId') patientId?: string) {
    return this.finance.listInvoices({
      status: status ? invoiceStatusSchema.parse(status) : undefined,
      patientId: patientId || undefined,
    });
  }

  @Get('invoices/:id')
  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  getInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.finance.getInvoice(id);
  }

  @Post('invoices/:id/payments')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) body: CreatePaymentInput,
  ) {
    return this.finance.addPayment(id, body);
  }

  @Delete('invoices/:id')
  @Roles(Role.ADMIN)
  cancelInvoice(@Param('id', ParseUUIDPipe) id: string) {
    return this.finance.cancelInvoice(id);
  }

  // --- Despesas ---

  @Post('expenses')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  createExpense(@Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseInput) {
    return this.finance.createExpense(body);
  }

  @Get('expenses')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  listExpenses() {
    return this.finance.listExpenses();
  }

  // --- Fluxo de caixa ---

  @Get('finance/cashflow')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  cashflow(@Query('from') from: string, @Query('to') to: string) {
    const parsed = cashflowQuerySchema.parse({ from, to });
    return this.finance.cashflow(parsed.from, parsed.to);
  }
}
