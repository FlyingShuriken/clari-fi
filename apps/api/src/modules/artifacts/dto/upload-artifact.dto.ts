import { IsBase64, IsEnum, IsString } from 'class-validator';

export enum ArtifactKindDto {
  AUDIO = 'audio',
  RECEIPT = 'receipt',
  DOCUMENT = 'document',
}

export class UploadArtifactDto {
  @IsEnum(ArtifactKindDto)
  kind!: ArtifactKindDto;

  @IsString()
  mimeType!: string;

  @IsBase64()
  fileBase64!: string;
}
