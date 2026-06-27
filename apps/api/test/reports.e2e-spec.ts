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
 * Relatórios/Dashboard (Fase 4): visão consolidada do período (faturamento,
 * agendamentos, serviços mais vendidos, ranking de profissionais) + isolamento.
 */
describe('Relatórios (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;

  let tokenA: string;
  let tokenB: string;

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
      data: { name: 'Rep A', slug: 'rep-a', businessType: 'CLINIC' },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Rep B', slug: 'rep-b', businessType: 'SALON' },
    });
    tokenA = await signAdmin(orgA.id, 'a@ex.com');
    tokenB = await signAdmin(orgB.id, 'b@ex.com');

    const doctorUser = await prisma.user.create({
      data: { organizationId: orgA.id, name: 'Dra Report', email: 'dr@rep.com', passwordHash: 'x', role: 'DOCTOR' },
    });
    const doctor = await prisma.doctor.create({
      data: { organizationId: orgA.id, userId: doctorUser.id, specialty: 'Geral', crm: 'CRM-REP-1' },
    });
    const patient = await prisma.patient.create({
      data: { organizationId: orgA.id, name: 'Cliente Rep', phone: '+5511900000000' },
    });

    await prisma.appointment.create({
      data: {
        organizationId: orgA.id,
        doctorId: doctor.id,
        patientId: patient.id,
        startAt: new Date(),
        endAt: new Date(Date.now() + 1_800_000),
        status: 'SCHEDULED',
      },
    });

    await prisma.invoice.create({
      data: {
        organizationId: orgA.id,
        patientId: patient.id,
        status: 'PAID',
        totalCents: 10000,
        items: { create: [{ organizationId: orgA.id, description: 'Consulta', quantity: 1, unitPriceCents: 10000 }] },
        payments: { create: [{ organizationId: orgA.id, amountCents: 10000, method: 'CASH' }] },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('consolida faturamento, agendamentos, serviços e profissionais', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/overview?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(res.body.revenueCents).toBe(10000);
    expect(res.body.invoicedCents).toBe(10000);
    expect(res.body.paidInvoices).toBe(1);
    expect(res.body.appointments.total).toBe(1);
    expect(res.body.appointments.byStatus.SCHEDULED).toBe(1);
    expect(res.body.avgTicketCents).toBe(10000);
    expect(res.body.topServices[0].label).toBe('Consulta');
    expect(res.body.topServices[0].revenueCents).toBe(10000);
    expect(res.body.byProfessional[0].name).toBe('Dra Report');
    expect(res.body.byProfessional[0].appointments).toBe(1);
  });

  it('ISOLAMENTO: outra empresa vê dashboard zerado', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/reports/overview?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(res.body.revenueCents).toBe(0);
    expect(res.body.appointments.total).toBe(0);
    expect(res.body.topServices).toHaveLength(0);
    expect(res.body.byProfessional).toHaveLength(0);
  });
});
