import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env';
import { PrismaModule } from './shared/prisma/prisma.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { AuditModule } from './shared/audit/audit.module';
import { IamModule } from './modules/iam/iam.module';
import { PatientsModule } from './modules/patients/patients.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JwtAuthGuard } from './modules/iam/jwt-auth.guard';
import { RolesGuard } from './modules/iam/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    CryptoModule,
    AuditModule,
    IamModule,
    PatientsModule,
    SchedulingModule,
    DoctorsModule,
    NotificationsModule,
  ],
  providers: [
    // Ordem importa: rate-limit → autenticação → autorização (RBAC).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
