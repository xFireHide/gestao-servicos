import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AuthTokens } from '@clinica/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

/**
 * Camada SaaS (Fase 5): cadastro self-service de empresa + 1º admin (auto-login)
 * e leitura/alteração da assinatura.
 */
describe('Onboarding / Assinatura (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.payment.deleteMany();
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
  });

  afterAll(async () => {
    await app.close();
  });

  const payload = {
    organizationName: 'Salão da Ana',
    slug: 'salao-da-ana',
    businessType: 'SALON',
    adminName: 'Ana',
    adminEmail: 'ana@salao.com',
    adminPassword: 'senha1234',
  };

  it('cadastra empresa + admin e já retorna tokens (auto-login)', async () => {
    const res = await request(app.getHttpServer()).post('/api/onboarding').send(payload);
    expect(res.status).toBe(201);
    const body = res.body as AuthTokens;
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    token = body.accessToken;
  });

  it('a assinatura inicia em trial no plano PRO', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/subscription')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.plan).toBe('PRO');
    expect(res.body.status).toBe('TRIALING');
    expect(res.body.trialEndsAt).toBeTruthy();
    expect(res.body.slug).toBe('salao-da-ana');
  });

  it('o admin criado consegue logar', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: payload.adminEmail, password: payload.adminPassword })
      .expect(201);
  });

  it('troca de plano deixa a assinatura ativa', async () => {
    await request(app.getHttpServer())
      .patch('/api/subscription')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'BUSINESS' })
      .expect(200)
      .expect((r) => {
        expect(r.body.plan).toBe('BUSINESS');
        expect(r.body.status).toBe('ACTIVE');
      });
  });

  it('rejeita slug ou e-mail já usados (409)', async () => {
    await request(app.getHttpServer()).post('/api/onboarding').send(payload).expect(409);
    await request(app.getHttpServer())
      .post('/api/onboarding')
      .send({ ...payload, slug: 'outro-slug' })
      .expect(409);
  });
});
