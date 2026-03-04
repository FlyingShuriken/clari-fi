import { Injectable } from '@nestjs/common';
import { OcrExtractInput, OcrExtractResult, OcrProvider } from './provider.interfaces';

@Injectable()
export class MockOcrProvider implements OcrProvider {
  async extract(input: OcrExtractInput): Promise<OcrExtractResult> {
    const rawText =
      input.mockText?.trim() ??
      'PASAR PAGI\nFish RM 5.00\nVegetable RM 3.50\nTOTAL RM 8.50';

    return {
      rawText,
      confidence: 0.82,
      rawPayload: {
        provider: 'mock',
        length: rawText.length,
      },
    };
  }
}
