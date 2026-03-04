import { Injectable } from '@nestjs/common';
import { SupabaseStorageService } from '../../infrastructure/storage/storage.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UploadArtifactDto } from './dto/upload-artifact.dto';

@Injectable()
export class ArtifactsService {
  constructor(private readonly storage: SupabaseStorageService) {}

  async uploadArtifact(user: AuthenticatedUser, dto: UploadArtifactDto) {
    const result = await this.storage.uploadBase64({
      kind: dto.kind,
      mimeType: dto.mimeType,
      base64: dto.fileBase64,
      userId: user.id,
    });

    return {
      fileRef: result.fileRef,
      storageProvider: result.storageProvider,
      publicUrl: result.publicUrl,
    };
  }
}
