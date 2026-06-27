import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { Role } from '@clinica/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

/**
 * Financeiro (Fase 3): faturamento (itens -> total), pagamentos (parcial/total ->
 * status), fluxo de caixa e isolamento entre empresas.
 */
describe('Financeiro (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;

  let tokenA: string;
  let tokenB: string;
  let patientId: string;
  let invoiceId: string;

  const from = new Date(Date.now() - 86_400_000).toISOString();
  const to = new Date(Date.now() + 86_400_000).toISOString();

  const signAdmin = (organizationId: string, email: string) =>
    jwt.signAsync(
      { sub: randomUUID(), email, role: Role.ADMIN, organizationId },
      { secret: config.get('JWT_ACCESS_SECRET'), expiresIn: 900 },
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    config = app.get(ConfigService);

    await prisma.payment.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.customerInteraction.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.service.deleteMany();
    await prisma.availability.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.doctor.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    const orgA = await prisma.organization.create({
      data: { name: 'Fin A', slug: 'fin-a', businessType: 'CLINIC' },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Fin B', slug: 'fin-b', businessType: 'SALON' },
    });
    tokenA = await signAdmin(orgA.id, 'a@ex.com');
    tokenB = await signAdmin(orgB.id, 'b@ex.com');

    const patient = await prisma.patient.create({
      data: { organizationId: orgA.id, name: 'Cliente Fin', phone: '+5511900000000' },
    });
    patientId = patient.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria fatura somando os itens (2x50 + 1x30 = R$130)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        patientId,
        items: [
          { description: 'Consulta', quantity: 2, unitPriceCents: 5000 },
          { description: 'Exame', quantity: 1, unitPriceCents: 3000 },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.totalCents).toBe(13000);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.paidCents).toBe(0);
    expect(res.body.balanceCents).toBe(13000);
    invoiceId = res.body.id;
  });

  it('pagamento parcial mantém OPEN; pagamento final marca PAID', async () => {
    const partial = await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amountCents: 5000, method: 'PIX' });
    expect(partial.status).toBe(201);
    expect(partial.body.status).toBe('OPEN');
    expect(partial.body.balanceCents).toBe(8000);

    const final = await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amountCents: 8000, method: 'CASH' });
    expect(final.status).toBe(201);
    expect(final.body.status).toBe('PAID');
    expect(final.body.balanceCents).toBe(0);
  });

  it('fluxo de caixa: entradas, despesas e saldo', async () => {
    await request(app.getHttpServer())
      .post('/api/expenses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ description: 'Material', amountCents: 2000 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/finance/cashflow?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.inflowCents).toBe(13000);
    expect(res.body.outflowCents).toBe(2000);
    expect(res.body.balanceCents).toBe(11000);
    expect(res.body.byMethod.PIX).toBe(5000);
    expect(res.body.byMethod.CASH).toBe(8000);
    expect(res.body.outstandingCents).toBe(0);
  });

  it('ISOLAMENTO: outra empresa não enxerga faturas nem caixa', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(list.body).toHaveLength(0);

    const cf = await request(app.getHttpServer())
      .get(`/api/finance/cashflow?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(cf.body.inflowCents).toBe(0);
    expect(cf.body.outstandingCents).toBe(0);

    await request(app.getHttpServer())
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });
});
