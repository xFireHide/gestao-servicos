import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthTokens, OnboardingInput, onboardingSchema } from '@clinica/shared';
import { OnboardingService } from './onboarding.service';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../../common/decorators';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Cadastro público de uma nova empresa + primeiro administrador (auto-login). */
  @Public()
  @Post()
  @UsePipes(new ZodValidationPipe(onboardingSchema))
  register(@Body() body: OnboardingInput): Promise<AuthTokens> {
    return this.onboarding.register(body);
  }
}
