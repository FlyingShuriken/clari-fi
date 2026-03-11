import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export type ArtifactKind = 'audio' | 'receipt' | 'document';

export interface UploadArtifactInput {
  kind: ArtifactKind;
  mimeType: string;
  base64: string;
  userId: string;
}

export interface UploadArtifactResult {
  fileRef: string;
  publicUrl?: string;
  storageProvider: 'supabase' | 'local';
}

interface StorageConfig {
  url: string;
  serviceRoleKey: string;
  bucket: string;
  publicBaseUrl: string;
}

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private cachedClient: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private configSnapshot(): StorageConfig {
    return {
      url: this.config.get<string>('SUPABASE_URL', '').replace(/\/+$/, ''),
      serviceRoleKey: this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
      bucket: this.config.get<string>('SUPABASE_STORAGE_BUCKET', 'clarifi-artifacts'),
      publicBaseUrl: this.config
        .get<string>('SUPABASE_STORAGE_PUBLIC_BASE_URL', '')
        .replace(/\/+$/, ''),
    };
  }

  private getClient(cfg: StorageConfig): SupabaseClient {
    if (!this.cachedClient) {
      this.cachedClient = createClient(cfg.url, cfg.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }

    return this.cachedClient;
  }

  async uploadBase64(input: UploadArtifactInput): Promise<UploadArtifactResult> {
    const cfg = this.configSnapshot();
    const extension = this.extensionFromMime(input.mimeType);
    const fileRef = `${input.kind}/${input.userId}/${Date.now()}-${randomUUID()}.${extension}`;

    if (!cfg.url || !cfg.serviceRoleKey) {
      return {
        fileRef: `local://${fileRef}`,
        storageProvider: 'local',
      };
    }

    const bytes = Buffer.from(input.base64, 'base64');
    const client = this.getClient(cfg);
    const { error } = await client.storage.from(cfg.bucket).upload(fileRef, bytes, {
      contentType: input.mimeType,
      upsert: true,
    });

    if (error) {
      this.logger.error(`Supabase storage upload failed: ${error.message}`);
      throw new ServiceUnavailableException('Failed to upload artifact');
    }

    const publicUrl = cfg.publicBaseUrl
      ? `${cfg.publicBaseUrl}/${cfg.bucket}/${fileRef}`
      : undefined;

    return {
      fileRef,
      publicUrl,
      storageProvider: 'supabase',
    };
  }

  async downloadAsBase64(fileRef: string): Promise<string | null> {
    if (!fileRef || fileRef.startsWith('local://')) {
      return null;
    }

    const cfg = this.configSnapshot();
    if (!cfg.url || !cfg.serviceRoleKey) {
      return null;
    }

    const client = this.getClient(cfg);
    const { data, error } = await client.storage.from(cfg.bucket).download(fileRef);

    if (error || !data) {
      this.logger.warn(`Supabase storage download failed: ${error?.message ?? 'no data'}`);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  }

  private extensionFromMime(mimeType: string): string {
    const normalized = mimeType.toLowerCase();
    if (normalized.includes('jpeg') || normalized.includes('jpg')) {
      return 'jpg';
    }
    if (normalized.includes('png')) {
      return 'png';
    }
    if (normalized.includes('m4a')) {
      return 'm4a';
    }
    if (normalized.includes('mp3')) {
      return 'mp3';
    }
    if (normalized.includes('wav')) {
      return 'wav';
    }
    return 'bin';
  }
}
