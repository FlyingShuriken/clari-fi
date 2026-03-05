import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class PriceSignalQueryDto {
  @IsString()
  item!: string;

  @IsOptional()
  @IsString()
  areaText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(3)
  @Max(14)
  horizonDays?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includePromo?: boolean;
}
