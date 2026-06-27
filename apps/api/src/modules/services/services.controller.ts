import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createServiceSchema,
  CreateServiceInput,
  Role,
  updateServiceSchema,
  UpdateServiceInput,
} from '@clinica/shared';
import { ServicesService } from './services.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Roles } from '../../common/decorators';

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Post()
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  create(@Body(new ZodValidationPipe(createServiceSchema)) body: CreateServiceInput) {
    return this.services.create(body);
  }

  @Get()
  @Roles(Role.PATIENT, Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  list() {
    return this.services.list();
  }

  @Patch(':id')
  @Roles(Role.RECEPTIONIST, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: UpdateServiceInput,
  ) {
    return this.services.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.deactivate(id);
  }
}
