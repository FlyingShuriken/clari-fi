import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrencyCode, ExpenseSource, PaymentMethodType } from '@prisma/client';

class ConfirmLineItemDto {
  @IsString()
  descriptionRaw!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unitRaw?: string;

  @IsNumber()
  @Min(0)
  totalPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

class ConfirmReceiptDto {
  @IsUrl()
  sourceFileUrl!: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsObject()
  ocrRaw?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  parsedPayload?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

class ConfirmLocationDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  areaName?: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;
}

export class ConfirmExpenseDto {
  @IsEnum(ExpenseSource)
  source!: ExpenseSource;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsOptional()
  @IsString()
  merchantText?: string;

  @IsOptional()
  @IsEnum(PaymentMethodType)
  paymentMethod?: PaymentMethodType;

  @IsISO8601()
  transactionAt!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmLineItemDto)
  lineItems!: ConfirmLineItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmReceiptDto)
  receipt?: ConfirmReceiptDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmLocationDto)
  location?: ConfirmLocationDto;
}
