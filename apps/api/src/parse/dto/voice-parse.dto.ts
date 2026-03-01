import { IsBase64, IsISO8601, IsOptional, IsString } from 'class-validator';

export class VoiceParseDto {
  @IsOptional()
  @IsBase64()
  audioBase64?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsISO8601()
  transactionAt?: string;
}
