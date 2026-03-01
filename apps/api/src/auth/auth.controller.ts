import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { VerifySupabaseDto } from './dto/verify-supabase.dto';
import { AuthService } from './auth.service';

@Controller('auth/supabase')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifySupabaseDto) {
    const identity = await this.authService.verifySupabaseToken(dto.supabaseAccessToken);
    const user = await this.authService.upsertUser(identity);

    const accessToken = await this.authService.signAppToken({
      sub: user.id,
      email: user.email,
      supabaseUserId: user.supabaseUserId,
    });

    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: '1d',
      user,
    };
  }
}
