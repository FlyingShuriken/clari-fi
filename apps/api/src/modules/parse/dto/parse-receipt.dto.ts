import { IsBase64, IsOptional, IsString } from 'class-validator';

export class ParseReceiptDto {
  @IsOptional()
  @IsString()
  fileRef?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsBase64()
  imageBase64?: string;

  @IsOptional()
  @IsString()
  mockText?: string;
}
