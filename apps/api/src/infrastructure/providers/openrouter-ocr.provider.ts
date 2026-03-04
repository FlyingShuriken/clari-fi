import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OcrExtractInput,
  OcrExtractResult,
  OcrProvider,
} from './provider.interfaces';

interface OpenRouterCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

@Injectable()
export class OpenRouterOcrProvider implements OcrProvider {
  private readonly logger = new Logger(OpenRouterOcrProvider.name);

  constructor(private readonly config: ConfigService) {}

  async extract(input: OcrExtractInput): Promise<OcrExtractResult> {
    if (input.mockText?.trim()) {
      return {
        rawText: input.mockText.trim(),
        confidence: 0.9,
        rawPayload: {
          provider: 'openrouter',
          mode: 'mockText',
        },
      };
    }

    if (!input.imageBase64 && !input.imageUrl) {
      return {
        rawText: '',
        confidence: 0,
        rawPayload: {
          provider: 'openrouter',
          mode: 'empty',
        },
      };
    }

    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENROUTER_API_KEY is required for OPENROUTER OCR provider',
      );
    }

    const baseUrl = this.config
      .get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      .replace(/\/+$/, '');
    const model = this.config.get<string>(
      'OPENROUTER_OCR_MODEL',
      'openai/gpt-4.1-mini',
    );
    const appUrl = this.config.get<string>('OPENROUTER_APP_URL');
    const appName = this.config.get<string>('OPENROUTER_APP_NAME');

    const imageUrl = input.imageUrl
      ? input.imageUrl
      : `data:image/jpeg;base64,${input.imageBase64}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (appUrl) {
      headers['HTTP-Referer'] = appUrl;
    }
    if (appName) {
      headers['X-Title'] = appName;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all visible text from this receipt. Return plain text with line breaks and no commentary.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `OpenRouter OCR request failed (${response.status}): ${body}`,
      );
      throw new ServiceUnavailableException('OCR provider request failed');
    }

    const payload = (await response.json()) as OpenRouterCompletionResponse;
    const rawText = payload.choices?.[0]?.message?.content?.trim() ?? '';

    return {
      rawText,
      confidence: rawText ? 0.88 : 0,
      rawPayload: {
        provider: 'openrouter',
        model,
      },
    };
  }
}
