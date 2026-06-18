import { Controller, Get, Injectable } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Role } from '@clinica/shared';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { Roles } from '../../common/decorators';

export interface DoctorView {
  id: string;
  name: string;
  specialty: string;
  crm: string;
}

@Injectable()
export class DoctorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<DoctorView[]> {
    const doctors = await this.prisma.doctor.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { specialty: 'asc' },
    });
    return doctors.map((d) => ({
      id: d.id,
      name: d.user.name,
      specialty: d.specialty,
      crm: d.crm,
    }));
  }
}

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @Get()
  @Roles(Role.PATIENT, Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  list(): Promise<DoctorView[]> {
    return this.doctors.list();
  }
}

@Module({
  controllers: [DoctorsController],
  providers: [DoctorsService],
})
export class DoctorsModule {}
