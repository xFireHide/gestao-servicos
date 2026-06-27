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
 * Gestão de equipe & profissionais (Fase 6): admin cria staff/profissionais,
 * gerencia disponibilidade; RBAC e isolamento entre empresas.
 */
describe('Equipe & profissionais (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let config: ConfigService;

  let adminA: string;
  let adminB: string;
  let orgAId: string;
  let doctorId: string;

  const sign = (organizationId: string, role: Role, email: string) =>
    jwt.signAsync(
      { sub: randomUUID(), email, role, organizationId },
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
      data: { name: 'Eq A', slug: 'eq-a', businessType: 'CLINIC' },
    });
    const orgB = await prisma.organization.create({
      data: { name: 'Eq B', slug: 'eq-b', businessType: 'SALON' },
    });
    orgAId = orgA.id;
    adminA = await sign(orgA.id, Role.ADMIN, 'admin.a@ex.com');
    adminB = await sign(orgB.id, Role.ADMIN, 'admin.b@ex.com');
  });

  afterAll(async () => {
    await app.close();
  });

  it('admin cria uma recepcionista', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminA}`)
      .send({ name: 'Rec A', email: 'rec@a.com', password: 'senha1234', role: 'RECEPTIONIST' });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('RECEPTIONIST');
    expect(res.body.doctorId).toBeNull();
  });

  it('admin cria um profissional (médico) com especialidade e registro', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminA}`)
      .send({
        name: 'Dr A',
        email: 'dr@a.com',
        password: 'senha1234',
        role: 'DOCTOR',
        specialty: 'Cardiologia',
        crm: 'CRM-A-1',
      });
    expect(res.status).toBe(201);
    expect(res.body.doctorId).toBeTruthy();
    expect(res.body.specialty).toBe('Cardiologia');
    doctorId = res.body.doctorId;
  });

  it('rejeita médico sem especialidade/registro (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${adminA}`)
      .send({ name: 'Dr B', email: 'drb@a.com', password: 'senha1234', role: 'DOCTOR' })
      .expect(400);
  });

  it('lista a equipe (sem clientes)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminA}`)
      .expect(200);
    expect(res.body).toHaveLength(2);
  });

  it('gerencia disponibilidade do profissional (criar, listar, excluir)', async () => {
    await request(app.getHttpServer())
      .post('/api/availability')
      .set('Authorization', `Bearer ${adminA}`)
      .send({ doctorId, weekday: 1, startTime: '09:00', endTime: '12:00', slotMinutes: 30 })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/doctors/${doctorId}/availability`)
      .set('Authorization', `Bearer ${adminA}`)
      .expect(200);
    expect(list.body).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/availability/${list.body[0].id}`)
      .set('Authorization', `Bearer ${adminA}`)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/api/doctors/${doctorId}/availability`)
      .set('Authorization', `Bearer ${adminA}`)
      .expect(200);
    expect(after.body).toHaveLength(0);
  });

  it('recepcionista não pode criar usuários (403)', async () => {
    const recToken = await sign(orgAId, Role.RECEPTIONIST, 'rec@a.com');
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${recToken}`)
      .send({ name: 'X', email: 'x@a.com', password: 'senha1234', role: 'RECEPTIONIST' })
      .expect(403);
  });

  it('ISOLAMENTO: outra empresa não vê a equipe da primeira', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminB}`)
      .expect(200);
    expect(res.body).toHaveLength(0);
  });
});
