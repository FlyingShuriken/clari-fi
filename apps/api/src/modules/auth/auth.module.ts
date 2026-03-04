import { Global, Module } from '@nestjs/common';
import { ClerkVerifierService } from '../../infrastructure/auth/clerk-verifier.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppAuthGuard } from './guards/app-auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, ClerkVerifierService, AppAuthGuard],
  exports: [AuthService, AppAuthGuard],
})
export class AuthModule {}
