import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { normalizeLooseText } from './price-intelligence.utils';

interface CanonicalizationResult {
  canonicalName: string;
  canonicalUnit?: string;
  confidence: number;
}

interface OpenRouterCompletionResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            text?: string;
          }>;
    };
  }>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractResponseText(payload: OpenRouterCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => asString(part.text))
      .join('\n')
      .trim();
  }

  return '';
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // keep extracting fenced object
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

@Injectable()
export class ItemNormalizerService {
  private readonly logger = new Logger(ItemNormalizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async findCanonicalItemByQuery(query: string) {
    const normalized = normalizeLooseText(query);
    if (!normalized) {
      return null;
    }

    const exact = await this.prisma.canonicalItem.findUnique({
      where: { canonicalName: normalized },
    });
    if (exact) {
      return exact;
    }

    const alias = await this.prisma.itemAlias.findFirst({
      where: { aliasText: normalized },
      include: { canonicalItem: true },
    });
    if (alias) {
      return alias.canonicalItem;
    }

    return this.prisma.canonicalItem.findFirst({
      where: {
        canonicalName: {
          contains: normalized,
          mode: 'insensitive',
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async resolveCanonicalItem(input: {
    descriptionRaw: string;
    unitRaw?: string | null;
    locale?: string;
  }) {
    const aliasText = normalizeLooseText(input.descriptionRaw);
    if (!aliasText) {
      throw new Error('Cannot normalize empty item description');
    }

    const locale = normalizeLooseText(input.locale ?? '') || 'und';

    const existingAlias = await this.prisma.itemAlias.findFirst({
      where: {
        aliasText,
        locale,
      },
      include: {
        canonicalItem: true,
      },
    });

    if (existingAlias) {
      return {
        canonicalItem: existingAlias.canonicalItem,
        confidence: 0.98,
        aliasText,
      };
    }

    const llm = await this.canonicalizeWithLlm({
      aliasText,
      unitRaw: input.unitRaw,
      locale,
    });

    const canonicalName = normalizeLooseText(llm.canonicalName || aliasText) || aliasText;
    const canonicalUnit = normalizeLooseText(llm.canonicalUnit ?? '') || undefined;

    const canonicalItem = await this.prisma.canonicalItem.upsert({
      where: {
        canonicalName,
      },
      create: {
        canonicalName,
        canonicalUnit,
      },
      update: {
        canonicalUnit: canonicalUnit ?? undefined,
      },
    });

    await this.prisma.itemAlias.upsert({
      where: {
        aliasText_locale: {
          aliasText,
          locale,
        },
      },
      create: {
        canonicalItemId: canonicalItem.id,
        aliasText,
        locale,
      },
      update: {
        canonicalItemId: canonicalItem.id,
      },
    });

    return {
      canonicalItem,
      confidence: llm.confidence,
      aliasText,
    };
  }

  private async canonicalizeWithLlm(input: {
    aliasText: string;
    unitRaw?: string | null;
    locale: string;
  }): Promise<CanonicalizationResult> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY')?.trim();
    if (!apiKey) {
      this.metrics.trackCounter('prices.normalizer.llm.missing_key.count', 1);
      return {
        canonicalName: input.aliasText,
        canonicalUnit: normalizeLooseText(input.unitRaw ?? '') || undefined,
        confidence: 0.55,
      };
    }

    const model =
      this.config.get<string>('OPENROUTER_NORMALIZER_MODEL')?.trim() ||
      this.config.get<string>('OPENROUTER_PARSER_MODEL', 'openai/gpt-4.1-mini');
    const baseUrl = this.config
      .get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
      .replace(/\/+$/, '');

    const startedAt = Date.now();

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You normalize grocery and household item aliases. Return strict JSON only.',
            },
            {
              role: 'user',
              content: [
                `Alias: ${input.aliasText}`,
                `Locale: ${input.locale}`,
                `Unit (optional): ${input.unitRaw ?? ''}`,
                'Return JSON schema: {"canonicalName": string, "canonicalUnit": string|null, "confidence": number}',
                'Rules: canonicalName must be concise singular noun phrase, lowercase, no punctuation.',
              ].join('\n'),
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenRouter normalizer failed: ${response.status} ${text}`);
      }

      const payload = (await response.json()) as OpenRouterCompletionResponse;
      const text = extractResponseText(payload);
      const parsed = parseJsonObject(text);
      if (!parsed) {
        throw new Error('OpenRouter normalizer returned invalid JSON payload');
      }

      const canonicalName = normalizeLooseText(asString(parsed.canonicalName) || input.aliasText);
      const canonicalUnit = normalizeLooseText(asString(parsed.canonicalUnit));
      const confidenceRaw = Number(parsed.confidence);
      const confidence = Number.isFinite(confidenceRaw)
        ? Math.max(0, Math.min(1, confidenceRaw))
        : 0.7;

      this.metrics.trackCounter('prices.normalizer.llm.success.count', 1);
      this.metrics.trackTiming('prices.normalizer.llm.latency_ms', Date.now() - startedAt);

      return {
        canonicalName,
        canonicalUnit: canonicalUnit || undefined,
        confidence,
      };
    } catch (error) {
      this.logger.warn(
        `Canonicalization fallback to alias text for "${input.aliasText}": ${String(error)}`,
      );
      this.metrics.trackCounter('prices.normalizer.llm.failure.count', 1);

      return {
        canonicalName: input.aliasText,
        canonicalUnit: normalizeLooseText(input.unitRaw ?? '') || undefined,
        confidence: 0.55,
      };
    }
  }
}
