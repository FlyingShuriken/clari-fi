import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyClerkDto } from './dto/verify-clerk.dto';

@Controller('auth/clerk')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyClerkDto) {
    const user = await this.authService.resolveAndUpsertFromToken(dto.clerkSessionToken);

    return {
      user,
    };
  }
}
