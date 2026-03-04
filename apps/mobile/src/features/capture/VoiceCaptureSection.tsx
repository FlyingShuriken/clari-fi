import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import type { VoiceParseResult } from '../../shared/types';

interface VoiceCaptureSectionProps {
  transcript: string;
  onTranscriptChange: (value: string) => void;
  recordingReady: boolean;
  parseLatencyMs: number | null;
  parseResult: VoiceParseResult | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
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
        placeholder="Use keyboard dictation, then edit transcript here"
        multiline
      />
      <Text style={styles.meta}>On-device path uses transcript directly.</Text>

      <View style={styles.row}>
        <Button title="Start Recording" onPress={props.onStartRecording} />
        <Button title="Stop Recording" onPress={props.onStopRecording} />
      </View>
      <Text style={styles.meta}>
        Audio fallback: {props.recordingReady ? 'Ready' : 'Not recorded'}
      </Text>

      <View style={styles.row}>
        <Button title="Parse Voice" onPress={props.onParseVoice} />
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
