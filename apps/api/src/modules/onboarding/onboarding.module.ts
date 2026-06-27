import { Module } from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SubscriptionController } from './subscription.controller';

@Module({
  imports: [IamModule],
  controllers: [OnboardingController, SubscriptionController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
