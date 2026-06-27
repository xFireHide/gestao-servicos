import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  availabilitySchema,
  AvailabilityInput,
  createAppointmentSchema,
  CreateAppointmentInput,
  createSelfAppointmentSchema,
  CreateSelfAppointmentInput,
  JwtClaims,
  Role,
  slotQuerySchema,
} from '@clinica/shared';
import { AvailabilityService } from './availability.service';
import { AppointmentsService } from './appointments.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Public, Roles } from '../../common/decorators';

@Controller()
export class SchedulingController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly appointments: AppointmentsService,
  ) {}

  @Post('availability')
  @Roles(Role.DOCTOR, Role.ADMIN)
  createAvailability(@Body(new ZodValidationPipe(availabilitySchema)) body: AvailabilityInput) {
    return this.availability.upsertRule(body);
  }

  @Get('doctors/:id/availability')
  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  listAvailability(@Param('id', ParseUUIDPipe) id: string) {
    return this.availability.listRules(id);
  }

  @Delete('availability/:id')
  @Roles(Role.DOCTOR, Role.ADMIN)
  deleteAvailability(@Param('id', ParseUUIDPipe) id: string) {
    return this.availability.deleteRule(id);
  }

  /** Slots livres — leitura pública (paciente vê antes mesmo de logar). */
  @Public()
  @Get('slots')
  freeSlots(@Query('doctorId') doctorId: string, @Query('date') date: string) {
    const parsed = slotQuerySchema.parse({ doctorId, date });
    return this.availability.freeSlots(parsed.doctorId, parsed.date);
  }

  /** Agendamento pela equipe (informa o paciente). */
  @Post('appointments')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  create(@Body(new ZodValidationPipe(createAppointmentSchema)) body: CreateAppointmentInput) {
    return this.appointments.create(body);
  }

  /** Auto-agendamento do paciente (paciente derivado do token). */
  @Post('appointments/me')
  @Roles(Role.PATIENT)
  createMine(
    @CurrentUser() user: JwtClaims,
    @Body(new ZodValidationPipe(createSelfAppointmentSchema)) body: CreateSelfAppointmentInput,
  ) {
    return this.appointments.createForPatient(user.sub, body);
  }

  @Get('appointments/me')
  @Roles(Role.PATIENT)
  listMine(@CurrentUser() user: JwtClaims) {
    return this.appointments.listForPatient(user.sub);
  }

  @Delete('appointments/:id')
  @Roles(Role.PATIENT, Role.RECEPTIONIST, Role.ADMIN)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtClaims) {
    return this.appointments.cancel(id, user);
  }

  @Get('doctors/:id/appointments')
  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  listForDoctor(@Param('id', ParseUUIDPipe) id: string, @Query('date') date: string) {
    return this.appointments.listForDoctor(id, new Date(date));
  }
}
