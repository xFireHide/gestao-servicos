import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [MailService, NotificationsService],
})
export class NotificationsModule {}
