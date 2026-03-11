import { IsArray, IsBase64, IsIn, IsOptional, IsString } from 'class-validator';

export class ParseDocumentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fileRefs?: string[];

  @IsOptional()
  @IsArray()
  @IsBase64({}, { each: true })
  imageBase64s?: string[];

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsIn(['receipt', 'flyer'])
  preferredKind?: 'receipt' | 'flyer';
}
