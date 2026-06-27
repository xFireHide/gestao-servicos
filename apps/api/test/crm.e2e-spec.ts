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
 * CRM (Fase 2): captação de lead sem CPF, funil (LEAD -> ACTIVE), linha do tempo
 * de interações e isolamento entre empresas.
 */
describe('CRM / Clientes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;

  let tokenA: string;
  let tokenB: string;
  let leadId: string;

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
      data: { name: 'CRM A', slug: 'crm-a', businessType: 'SALON' },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'CRM B', slug: 'crm-b', businessType: 'GYM' },
    });
    tokenA = await signAdmin(orgA.id, 'a@ex.com');
    tokenB = await signAdmin(orgB.id, 'b@ex.com');
  });

  afterAll(async () => {
    await app.close();
  });

  it('cadastra um LEAD sem CPF (só nome + telefone)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/patients')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Cliente Lead',
        phone: '+5511999998888',
        status: 'LEAD',
        source: 'Instagram',
        tags: ['vip', 'campanha'],
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('LEAD');
    expect(res.body.cpf).toBeNull();
    expect(res.body.tags).toEqual(['vip', 'campanha']);
    leadId = res.body.id;
  });

  it('filtra clientes por estágio do funil (?status=LEAD)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/patients?status=LEAD')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.map((p: { id: string }) => p.id)).toContain(leadId);
  });

  it('converte o lead em cliente ativo (PATCH status)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/patients/${leadId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'ACTIVE' })
      .expect(200)
      .expect((r) => expect(r.body.status).toBe('ACTIVE'));
  });

  it('registra e lista interações na linha do tempo', async () => {
    await request(app.getHttpServer())
      .post(`/api/patients/${leadId}/interactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'CALL', note: 'Ligação de boas-vindas' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/patients/${leadId}/interactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe('CALL');
    expect(res.body[0].note).toBe('Ligação de boas-vindas');
  });

  it('ISOLAMENTO: outra empresa não enxerga o cliente nem suas interações', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/patients')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(list.body).toHaveLength(0);

    // O lead existe, mas para a empresa B é como se não existisse (404).
    await request(app.getHttpServer())
      .get(`/api/patients/${leadId}/interactions`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });
});
