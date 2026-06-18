/**
 * Seed de desenvolvimento. NUNCA usar dados reais de pacientes (LGPD) — apenas dados fake.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createCipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const rawKey = process.env.FIELD_ENCRYPTION_KEY ?? 'dev-key';
const decoded = Buffer.from(rawKey, 'base64');
const key = decoded.length === 32 ? decoded : createHash('sha256').update(rawKey).digest();

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}
const blindIndex = (v: string) => createHmac('sha256', key).update(v).digest('hex');

async function main(): Promise<void> {
  const password = await argon2.hash('senha123');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinica.local' },
    update: {},
    create: { name: 'Admin', email: 'admin@clinica.local', passwordHash: password, role: 'ADMIN' },
  });

  const recep = await prisma.user.upsert({
    where: { email: 'recepcao@clinica.local' },
    update: {},
    create: {
      name: 'Recepção',
      email: 'recepcao@clinica.local',
      passwordHash: password,
      role: 'RECEPTIONIST',
    },
  });

  const doctorUser = await prisma.user.upsert({
    where: { email: 'dra.ana@clinica.local' },
    update: {},
    create: {
      name: 'Dra. Ana Cardoso',
      email: 'dra.ana@clinica.local',
      passwordHash: password,
      role: 'DOCTOR',
    },
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {},
    create: { userId: doctorUser.id, specialty: 'Cardiologia', crm: 'CRM-SP-123456' },
  });

  // Disponibilidade seg-sex 09:00-12:00, slots de 30min.
  for (let weekday = 1; weekday <= 5; weekday++) {
    await prisma.availability.create({
      data: { doctorId: doctor.id, weekday, startTime: '09:00', endTime: '12:00', slotMinutes: 30 },
    });
  }

  const cpf = '52998224725'; // CPF fake válido
  await prisma.patient.upsert({
    where: { cpfHash: blindIndex(cpf) },
    update: {},
    create: {
      name: 'João Paciente',
      cpfEnc: encrypt(cpf),
      cpfHash: blindIndex(cpf),
      birthDate: new Date('1990-05-20'),
      phone: '+5511999990000',
      email: 'joao.paciente@example.com',
    },
  });

  console.log('Seed concluído:', {
    admin: admin.email,
    recep: recep.email,
    doctor: doctorUser.email,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
