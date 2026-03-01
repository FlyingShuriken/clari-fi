import { IsNotEmpty, IsString } from 'class-validator';

export class VerifySupabaseDto {
  @IsString()
  @IsNotEmpty()
  supabaseAccessToken!: string;
}
