import { Injectable } from '@nestjs/common';
import { SttProvider, SttTranscribeInput, SttTranscribeResult } from './provider.interfaces';

@Injectable()
export class MockSttProvider implements SttProvider {
  async transcribe(input: SttTranscribeInput): Promise<SttTranscribeResult> {
    if (input.text?.trim()) {
      return {
        transcript: input.text.trim(),
        confidence: 0.99,
      };
    }

    if (input.audioBase64?.trim()) {
      return {
        transcript: 'Spent RM 5 at pasar to buy fish, paid with TNG',
        confidence: 0.7,
      };
    }

    return {
      transcript: '',
      confidence: 0,
    };
  }
}
