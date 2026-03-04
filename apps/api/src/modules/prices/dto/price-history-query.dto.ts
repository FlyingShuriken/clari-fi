import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';

export class PriceHistoryQueryDto {
  @IsString()
  item!: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['day', 'week'])
  interval?: 'day' | 'week';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includePromo?: boolean;
}
