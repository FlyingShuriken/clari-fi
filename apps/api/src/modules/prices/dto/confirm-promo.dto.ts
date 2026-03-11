import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class ConfirmPromoLineItemDto {
  @IsString()
  descriptionRaw!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  unitRaw?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;

  @Type(() => Number)
  @IsNumber()
  totalPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  originalPrice?: number;

  @IsOptional()
  @IsString()
  promoText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  confidence?: number;
}

export class ConfirmPromoDto {
  @IsArray()
  @IsString({ each: true })
  fileRefs!: string[];

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsString()
  merchantText?: string;

  @IsOptional()
  @IsString()
  areaText?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsString()
  currency!: 'MYR' | 'SGD' | 'USD';

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validTo?: string;

  @ValidateNested({ each: true })
  @Type(() => ConfirmPromoLineItemDto)
  @IsArray()
  lineItems!: ConfirmPromoLineItemDto[];
}
