import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  createInteractionSchema,
  CreateInteractionInput,
  createPatientSchema,
  CreatePatientInput,
  customerStatusSchema,
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
  list(@Query('status') status?: string) {
    const parsed = status ? customerStatusSchema.parse(status) : undefined;
    return this.patients.list(parsed);
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

  // --- CRM: linha do tempo de interações ---

  @Get(':id/interactions')
  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  @Audit('patient.interactions.read', 'patient::id')
  listInteractions(@Param('id', ParseUUIDPipe) id: string) {
    return this.patients.listInteractions(id);
  }

  @Post(':id/interactions')
  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  @Audit('patient.interactions.create', 'patient::id')
  addInteraction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createInteractionSchema)) body: CreateInteractionInput,
    @CurrentUser() user: JwtClaims,
  ) {
    return this.patients.addInteraction(id, body, user);
  }
}
