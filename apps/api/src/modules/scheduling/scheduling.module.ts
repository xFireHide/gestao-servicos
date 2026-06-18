import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { AvailabilityService } from './availability.service';
import { AppointmentsService } from './appointments.service';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [PatientsModule],
  controllers: [SchedulingController],
  providers: [AvailabilityService, AppointmentsService],
  exports: [AvailabilityService, AppointmentsService],
})
export class SchedulingModule {}
