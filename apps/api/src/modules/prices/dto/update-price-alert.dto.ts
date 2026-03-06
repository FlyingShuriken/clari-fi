import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdatePriceAlertDto {
  @IsOptional()
  @IsString()
  item?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  targetUnitPrice?: number;

  @IsOptional()
  @IsIn(['THRESHOLD', 'SIGNAL'])
  kind?: 'THRESHOLD' | 'SIGNAL';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radiusKm?: number;

  @IsOptional()
  @IsString()
  areaText?: string;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsIn(['BUY_NOW', 'WAIT', 'BOTH'])
  signalDecisionFilter?: 'BUY_NOW' | 'WAIT' | 'BOTH';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  signalMinConfidence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10080)
  signalCooldownMinutes?: number;
}
