import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Role } from '@clinica/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

/**
 * Verificação central: a invariante anti-double-booking (ADR 0002) resiste a
 * requisições concorrentes — exatamente uma vence, a outra recebe 409.
 */
describe('Scheduling (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;

  let doctorId: string;
  let patientId: string;
  let staffToken: string;

  // Data/horário determinístico dentro da janela de disponibilidade.
  const date = new Date('2026-09-07T00:00:00.000Z');
  const startAt = '2026-09-07T09:00:00.000Z';
  const endAt = '2026-09-07T09:30:00.000Z';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    config = app.get(ConfigService);

    // Limpeza em ordem segura de FKs (organizations por último: cascateia o tenant).
    await prisma.invoice.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.availability.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.doctor.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    const org = await prisma.organization.create({
      data: { name: 'Org E2E', slug: 'org-e2e', businessType: 'CLINIC' },
    });
    const organizationId = org.id;

    const admin = await prisma.user.create({
      data: {
        organizationId,
        name: 'Admin E2E',
        email: 'admin.e2e@clinica.local',
        passwordHash: 'x',
        role: 'ADMIN',
      },
    });
    staffToken = await jwt.signAsync(
      { sub: admin.id, email: admin.email, role: Role.ADMIN, organizationId },
      { secret: config.get('JWT_ACCESS_SECRET'), expiresIn: 900 },
    );

    const doctorUser = await prisma.user.create({
      data: {
        organizationId,
        name: 'Dra. Teste',
        email: 'dra.teste@clinica.local',
        passwordHash: 'x',
        role: 'DOCTOR',
      },
    });
    const doctor = await prisma.doctor.create({
      data: { organizationId, userId: doctorUser.id, specialty: 'Clínica Geral', crm: 'CRM-E2E-1' },
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

    const patient = await prisma.patient.create({
      data: {
        organizationId,
        name: 'Paciente Teste',
        cpfEnc: 'enc',
        cpfHash: 'hash-e2e',
        birthDate: new Date('1990-01-01'),
        phone: '+5511999990000',
      },
    });
    patientId = patient.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('impede double-booking sob concorrência (1 vence, 1 recebe 409)', async () => {
    const server = app.getHttpServer();
    const book = () =>
      request(server)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ doctorId, patientId, startAt, endAt });

    const results = await Promise.all([book(), book()]);
    const statuses = results.map((r) => r.status).sort();

    expect(statuses).toEqual([201, 409]);

    const active = await prisma.appointment.count({
      where: { doctorId, status: { not: 'CANCELLED' } },
    });
    expect(active).toBe(1);
  });

  it('rejeita agendamento fora da disponibilidade (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        doctorId,
        patientId,
        startAt: '2026-09-07T13:00:00.000Z',
        endAt: '2026-09-07T13:30:00.000Z',
      });
    expect(res.status).toBe(400);
  });

  it('exige autenticação em rota protegida (401)', async () => {
    const res = await request(app.getHttpServer()).get('/api/patients');
    expect(res.status).toBe(401);
  });

  it('aplica RBAC: token sem permissão recebe 403', async () => {
    const patientToken = await jwt.signAsync(
      { sub: patientId, email: 'p@x.com', role: Role.PATIENT },
      { secret: config.get('JWT_ACCESS_SECRET'), expiresIn: 900 },
    );
    const res = await request(app.getHttpServer())
      .get('/api/patients')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });

  it('libera o horário após cancelamento (rebooking permitido)', async () => {
    const existing = await prisma.appointment.findFirst({
      where: { doctorId, status: 'SCHEDULED' },
    });
    await request(app.getHttpServer())
      .delete(`/api/appointments/${existing!.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ doctorId, patientId, startAt, endAt });
    expect(res.status).toBe(201);
  });
});
