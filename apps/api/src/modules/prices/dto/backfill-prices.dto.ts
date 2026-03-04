import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsIn, IsOptional } from 'class-validator';

export class BackfillPricesDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsIn(['user', 'all'])
  scope?: 'user' | 'all';
}
