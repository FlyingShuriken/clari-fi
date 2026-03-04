import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoPushSender } from './providers/expo-push.sender';
import { MockPushSender } from './providers/mock-push.sender';
import { PUSH_SENDER } from './providers/push-sender.types';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ExpoPushSender,
    MockPushSender,
    {
      provide: PUSH_SENDER,
      inject: [ConfigService, ExpoPushSender, MockPushSender],
      useFactory: (
        config: ConfigService,
        expoPushSender: ExpoPushSender,
        mockPushSender: MockPushSender,
      ) => {
        const provider = config.get<string>('PUSH_PROVIDER')?.trim().toLowerCase() ?? 'expo';
        return provider === 'mock' ? mockPushSender : expoPushSender;
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
