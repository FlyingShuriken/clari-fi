import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsOptional, IsString } from 'class-validator';

export class IngestPromoDto {
  @IsString()
  fileRef!: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsString()
  merchantText?: string;

  @IsOptional()
  @IsString()
  areaText?: string;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoApprove?: boolean;
}
