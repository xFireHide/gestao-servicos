import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  createPatientSchema,
  CreatePatientInput,
  JwtClaims,
  Role,
  updatePatientSchema,
  UpdatePatientInput,
} from '@clinica/shared';
import { PatientsService } from './patients.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../../common/decorators';
import { Audit, AuditInterceptor } from '../../shared/audit/audit.interceptor';

@Controller('patients')
@UseInterceptors(AuditInterceptor)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post()
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @UsePipes(new ZodValidationPipe(createPatientSchema))
  create(@Body() body: CreatePatientInput) {
    return this.patients.create(body);
  }

  // Rotas /me declaradas antes de /:id para não serem capturadas pelo param uuid.
  @Get('me')
  @Roles(Role.PATIENT)
  meProfile(@CurrentUser() user: JwtClaims) {
    return this.patients.meProfile(user.sub);
  }

  @Post('me')
  @Roles(Role.PATIENT)
  createMyProfile(
    @CurrentUser() user: JwtClaims,
    @Body(new ZodValidationPipe(createPatientSchema)) body: CreatePatientInput,
  ) {
    return this.patients.createForUser(user.sub, body);
  }

  @Get()
  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  list() {
    return this.patients.list();
  }

  @Get(':id')
  @Audit('patient.read', 'patient::id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtClaims) {
    return this.patients.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  @Audit('patient.update', 'patient::id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePatientSchema)) body: UpdatePatientInput,
  ) {
    return this.patients.update(id, body);
  }
}
