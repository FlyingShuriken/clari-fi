import { IsBase64, IsOptional, IsString, IsUrl } from 'class-validator';

export class ReceiptParseDto {
  @IsOptional()
  @IsBase64()
  imageBase64?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  mockText?: string;
}
