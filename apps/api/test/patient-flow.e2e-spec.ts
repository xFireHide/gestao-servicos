import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AuthTokens } from '@clinica/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

/**
 * Fluxo de autoatendimento do paciente: cadastro → perfil → auto-agendamento →
 * listagem; e a regra de que um paciente não cancela agendamento de outro.
 */
describe('Patient self-service (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let doctorId: string;
  const date = new Date('2026-09-07T00:00:00.000Z');
  const startAt = '2026-09-07T10:00:00.000Z';
  const endAt = '2026-09-07T10:30:00.000Z';

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Paciente Teste', email, password: 'senha1234' })
      .then((r) => (r.body as AuthTokens).accessToken);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.appointment.deleteMany();
    await prisma.availability.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.doctor.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    // Empresa única: register() sem orgSlug cai automaticamente nela.
    const org = await prisma.organization.create({
      data: { name: 'Org PF', slug: 'org-pf', businessType: 'CLINIC' },
    });
    const organizationId = org.id;

    const doctorUser = await prisma.user.create({
      data: { organizationId, name: 'Dra. X', email: 'drx@clinica.local', passwordHash: 'x', role: 'DOCTOR' },
    });
    const doctor = await prisma.doctor.create({
      data: { organizationId, userId: doctorUser.id, specialty: 'Geral', crm: 'CRM-PF-1' },
    });
    doctorId = doctor.id;
    await prisma.availability.create({
      data: {
        organizationId,
        doctorId,
        weekday: date.getUTCDay(),
        startTime: '09:00',
        endTime: '12:00',
        slotMinutes: 30,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('bloqueia agendamento antes de completar o cadastro (400)', async () => {
    const token = await register('p1@ex.com');
    const res = await request(app.getHttpServer())
      .post('/api/appointments/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId, startAt, endAt });
    expect(res.status).toBe(400);
  });

  it('paciente completa cadastro, agenda e lista o próprio agendamento', async () => {
    const token = await register('p2@ex.com');

    await request(app.getHttpServer())
      .post('/api/patients/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Paciente Dois',
        cpf: '529.982.247-25',
        birthDate: '1990-01-01',
        phone: '+5511988887777',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/patients/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const booked = await request(app.getHttpServer())
      .post('/api/appointments/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId, startAt, endAt });
    expect(booked.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get('/api/appointments/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('paciente não cancela agendamento de outro paciente (403)', async () => {
    const mine = await prisma.appointment.findFirst({ where: { status: 'SCHEDULED' } });

    const otherToken = await register('p3@ex.com');
    await request(app.getHttpServer())
      .post('/api/patients/me')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        name: 'Paciente Três',
        cpf: '111.444.777-35',
        birthDate: '1991-02-02',
        phone: '+5511977776666',
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .delete(`/api/appointments/${mine!.id}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});
