import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { RecognitionState } from './speech-recognition.service';
import type { VoiceParseResult } from '../../shared/types';

interface VoiceCaptureSectionProps {
  transcript: string;
  onTranscriptChange: (value: string) => void;
  recognitionState: RecognitionState;
  recognizerAvailable: boolean | null;
  parseLatencyMs: number | null;
  parseResult: VoiceParseResult | null;
  onStartListening: () => void;
  onStopListening: () => void;
  onParseVoice: () => void;
  onConfirmVoice: () => void;
}

export function VoiceCaptureSection(props: VoiceCaptureSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>2) Voice Capture</Text>

      <TextInput
        style={styles.input}
        value={props.transcript}
        onChangeText={props.onTranscriptChange}
        placeholder="Tap Start Listening, speak, then edit transcript if needed"
        multiline
      />
      <Text style={styles.meta}>On-device STT (primary) with transcript-first parsing.</Text>

      <View style={styles.row}>
        <Button
          title="Start Listening"
          onPress={props.onStartListening}
          disabled={props.recognitionState === 'listening'}
        />
        <Button
          title="Stop Listening"
          onPress={props.onStopListening}
          disabled={
            props.recognitionState !== 'listening' &&
            props.recognitionState !== 'processing'
          }
        />
      </View>
      <Text style={styles.meta}>
        Recognizer available:{' '}
        {props.recognizerAvailable == null
          ? 'Checking...'
          : props.recognizerAvailable
            ? 'Yes'
            : 'No'}
      </Text>
      <Text style={styles.meta}>
        Recognition state: {props.recognitionState}
      </Text>

      <View style={styles.row}>
        <Button
          title="Parse Voice"
          onPress={props.onParseVoice}
          disabled={
            props.recognitionState === 'listening' ||
            props.recognitionState === 'processing'
          }
        />
        <Button title="Confirm Expense" onPress={props.onConfirmVoice} />
      </View>
      <Text style={styles.meta}>
        Parse latency: {props.parseLatencyMs == null ? '-' : `${props.parseLatencyMs} ms`}
      </Text>

      {props.parseResult ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Voice Parse</Text>
          <Text style={styles.preview}>{JSON.stringify(props.parseResult, null, 2)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
    minHeight: 80,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  meta: {
    fontSize: 12,
    color: '#334155',
  },
  previewContainer: {
    marginTop: 8,
    borderRadius: 8,
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 10,
    backgroundColor: '#f1f5f9',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  preview: {
    fontFamily: 'Courier',
    fontSize: 12,
  },
});
