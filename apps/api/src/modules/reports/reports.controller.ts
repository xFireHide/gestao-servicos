import { Controller, Get, Query } from '@nestjs/common';
import { reportQuerySchema, Role } from '@clinica/shared';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  @Roles(Role.RECEPTIONIST, Role.ADMIN, Role.DOCTOR)
  overview(@Query('from') from: string, @Query('to') to: string) {
    const parsed = reportQuerySchema.parse({ from, to });
    return this.reports.overview(parsed.from, parsed.to);
  }
}
