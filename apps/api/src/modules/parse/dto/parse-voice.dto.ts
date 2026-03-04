import { IsBase64, IsISO8601, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class ParseVoiceDto {
  @IsOptional()
  @IsString()
  transcript?: string;

  @IsOptional()
  @IsBase64()
  audioBase64?: string;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  deviceConfidence?: number;

  @IsOptional()
  @IsISO8601()
  transactionAt?: string;
}
