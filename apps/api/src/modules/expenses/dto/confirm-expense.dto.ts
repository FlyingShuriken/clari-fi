import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CurrencyCode,
  ExpenseProvenance,
  ExpenseSource,
  PaymentMethodType,
} from '@prisma/client';

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
  @IsString()
  fileRef!: string;

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

export class ConfirmExpenseDto {
  @IsEnum(ExpenseSource)
  source!: ExpenseSource;

  @IsOptional()
  @IsEnum(ExpenseProvenance)
  provenance?: ExpenseProvenance;

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

  @IsOptional()
  @IsNumber()
  @Min(0)
  parseLatencyMs?: number;

  @IsOptional()
  @IsBoolean()
  requiresCorrection?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmLineItemDto)
  lineItems!: ConfirmLineItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ConfirmReceiptDto)
  receipt?: ConfirmReceiptDto;
}
