import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SttProvider,
  SttTranscribeInput,
  SttTranscribeResult,
} from './provider.interfaces';

interface OpenRouterTranscriptionResponse {
  text?: string;
}

@Injectable()
export class OpenRouterSttProvider implements SttProvider {
  private readonly logger = new Logger(OpenRouterSttProvider.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
    if (input.text?.trim()) {
      return {
        transcript: input.text.trim(),
        confidence: 0.99,
      };
    }

    if (!input.audioBase64?.trim()) {
      return {
        transcript: '',
        confidence: 0,
      };
    }

    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY is required for OPENROUTER STT provider',
      );
    }

    const baseUrl = this.config
      .get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      .replace(/\/+$/, '');
    const model = this.config.get<string>(
      'OPENROUTER_STT_MODEL',
      'openai/gpt-4o-mini-transcribe',
    );
    const appUrl = this.config.get<string>('OPENROUTER_APP_URL');
    const appName = this.config.get<string>('OPENROUTER_APP_NAME');

    const audioBytes = Buffer.from(input.audioBase64, 'base64');
    const formData = new FormData();
    formData.append('model', model);
    formData.append(
      'file',
      new Blob([audioBytes], { type: 'audio/m4a' }),
      'voice-note.m4a',
    );

    if (input.locale?.trim()) {
      formData.append('language', input.locale.split('-')[0].toLowerCase());
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };
    if (appUrl) {
      headers['HTTP-Referer'] = appUrl;
    }
    if (appName) {
      headers['X-Title'] = appName;
    }

    const response = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `OpenRouter STT request failed (${response.status}): ${body}`,
      );
      throw new ServiceUnavailableException('STT provider request failed');
    }

    const payload = (await response.json()) as OpenRouterTranscriptionResponse;
    const transcript = payload.text?.trim() ?? '';

    return {
      transcript,
      confidence: transcript ? 0.9 : 0,
    };
  }
}
