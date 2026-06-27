import { Body, Controller, Get, Post } from '@nestjs/common';
import { createStaffUserSchema, CreateStaffUserInput, Role } from '@clinica/shared';
import { UsersService } from './users.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Roles } from '../../common/decorators';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body(new ZodValidationPipe(createStaffUserSchema)) body: CreateStaffUserInput) {
    return this.users.create(body);
  }

  @Get()
  @Roles(Role.ADMIN)
  list() {
    return this.users.list();
  }
}
