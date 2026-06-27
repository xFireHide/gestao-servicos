import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Role } from '@clinica/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

/**
 * Catálogo de serviços (Fase 1B) + prova de isolamento multiempresa: a empresa B
 * NUNCA enxerga o serviço da empresa A, mesmo com um admin autenticado.
 */
describe('Services catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;

  let tokenA: string;
  let tokenB: string;

  const signAdmin = (organizationId: string, email: string) =>
    jwt.signAsync(
      { sub: '00000000-0000-0000-0000-0000000000aa', email, role: Role.ADMIN, organizationId },
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
    await prisma.appointment.deleteMany();
    await prisma.service.deleteMany();
    await prisma.availability.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.doctor.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    const orgA = await prisma.organization.create({
      data: { name: 'Empresa A', slug: 'empresa-a', businessType: 'CLINIC' },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Empresa B', slug: 'empresa-b', businessType: 'SALON' },
    });
    tokenA = await signAdmin(orgA.id, 'admin.a@ex.com');
    tokenB = await signAdmin(orgB.id, 'admin.b@ex.com');
  });

  afterAll(async () => {
    await app.close();
  });

  let serviceId: string;

  it('cria um serviço no catálogo (201)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Corte de cabelo', priceCents: 5000, durationMinutes: 45 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Corte de cabelo');
    expect(res.body.active).toBe(true);
    serviceId = res.body.id;
  });

  it('lista o serviço para a própria empresa', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/services')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.map((s: { id: string }) => s.id)).toContain(serviceId);
  });

  it('ISOLAMENTO: outra empresa não enxerga o serviço', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/services')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(res.body).toHaveLength(0);
  });

  it('atualiza preço e desativa o serviço', async () => {
    await request(app.getHttpServer())
      .patch(`/api/services/${serviceId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ priceCents: 6000 })
      .expect(200)
      .expect((r) => expect(r.body.priceCents).toBe(6000));

    await request(app.getHttpServer())
      .delete(`/api/services/${serviceId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200)
      .expect((r) => expect(r.body.active).toBe(false));
  });

  it('rejeita criação sem permissão (paciente) com 403', async () => {
    const patientToken = await jwt.signAsync(
      { sub: '00000000-0000-0000-0000-0000000000bb', email: 'p@ex.com', role: Role.PATIENT },
      { secret: config.get('JWT_ACCESS_SECRET'), expiresIn: 900 },
    );
    await request(app.getHttpServer())
      .post('/api/services')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ name: 'X', priceCents: 100, durationMinutes: 30 })
      .expect(403);
  });
});
