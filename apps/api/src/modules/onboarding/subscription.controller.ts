import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common';
import {
  JwtClaims,
  Role,
  updateSubscriptionSchema,
  UpdateSubscriptionInput,
} from '@clinica/shared';
import { OnboardingService } from './onboarding.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../../common/decorators';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @Roles(Role.RECEPTIONIST, Role.DOCTOR, Role.ADMIN)
  get(@CurrentUser() user: JwtClaims) {
    return this.onboarding.getSubscription(this.orgId(user));
  }

  @Patch()
  @Roles(Role.ADMIN)
  update(
    @CurrentUser() user: JwtClaims,
    @Body(new ZodValidationPipe(updateSubscriptionSchema)) body: UpdateSubscriptionInput,
  ) {
    return this.onboarding.updateSubscription(this.orgId(user), body);
  }

  private orgId(user: JwtClaims): string {
    if (!user.organizationId) throw new BadRequestException('Usuário sem empresa associada');
    return user.organizationId;
  }
}
