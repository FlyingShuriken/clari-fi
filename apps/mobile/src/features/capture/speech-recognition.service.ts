import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

export type RecognitionState = 'idle' | 'listening' | 'processing' | 'ready' | 'error';

interface SpeechRecognitionHandlers {
  onStart?: () => void;
  onEnd?: () => void;
  onPartialResults?: (transcript: string) => void;
  onFinalResults?: (transcript: string) => void;
  onError?: (message: string) => void;
}

type NativeSubscription = {
  remove: () => void;
};

function normalizeTranscript(event: ExpoSpeechRecognitionResultEvent): string {
  return event.results.map((result) => result.transcript.trim()).find(Boolean) ?? '';
}

function normalizeErrorMessage(event: ExpoSpeechRecognitionErrorEvent): string {
  const code = event.error?.trim() ?? 'unknown';
  const message = event.message?.trim() ?? 'Speech recognition failed.';
  return `${message} (${code})`;
}

class SpeechRecognitionService {
  private listeners: NativeSubscription[] = [];

  private clearListeners() {
    for (const listener of this.listeners) {
      listener.remove();
    }
    this.listeners = [];
  }

  configure(handlers: SpeechRecognitionHandlers): void {
    this.clearListeners();

    this.listeners.push(
      ExpoSpeechRecognitionModule.addListener('start', () => {
        handlers.onStart?.();
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        handlers.onEnd?.();
      }),
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const transcript = normalizeTranscript(event);
        if (!transcript) {
          return;
        }

        if (event.isFinal) {
          handlers.onFinalResults?.(transcript);
          return;
        }

        handlers.onPartialResults?.(transcript);
      }),
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        handlers.onError?.(normalizeErrorMessage(event));
      }),
    );
  }

  async isAvailable(): Promise<boolean> {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  }

  async start(locale: string): Promise<void> {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Microphone or speech recognition permission denied.');
    }

    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: true,
      maxAlternatives: 1,
    });
  }

  async stop(): Promise<void> {
    ExpoSpeechRecognitionModule.stop();
  }

  async cancel(): Promise<void> {
    ExpoSpeechRecognitionModule.abort();
  }

  async destroy(): Promise<void> {
    this.clearListeners();
    ExpoSpeechRecognitionModule.abort();
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
