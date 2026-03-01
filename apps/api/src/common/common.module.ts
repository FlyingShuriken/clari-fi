import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AppAuthGuard } from './guards/app-auth.guard';

@Module({
  imports: [AuthModule],
  providers: [AppAuthGuard],
  exports: [AppAuthGuard],
})
export class CommonModule {}
