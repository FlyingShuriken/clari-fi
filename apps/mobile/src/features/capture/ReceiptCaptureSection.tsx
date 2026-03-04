import { Button, StyleSheet, Text, View } from 'react-native';
import type { ReceiptParseResult } from '../../shared/types';

interface ReceiptCaptureSectionProps {
  receiptReady: boolean;
  receiptFileRef: string;
  parseLatencyMs: number | null;
  parseResult: ReceiptParseResult | null;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onParseReceipt: () => void;
  onConfirmReceipt: () => void;
}

export function ReceiptCaptureSection(props: ReceiptCaptureSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>3) Receipt Capture</Text>

      <View style={styles.row}>
        <Button title="Camera" onPress={props.onPickCamera} />
        <Button title="Gallery" onPress={props.onPickGallery} />
      </View>
      <Text style={styles.meta}>Receipt image: {props.receiptReady ? 'Ready' : 'Not selected'}</Text>
      <Text style={styles.meta}>Artifact ref: {props.receiptFileRef || '-'}</Text>

      <View style={styles.row}>
        <Button title="Parse Receipt" onPress={props.onParseReceipt} />
        <Button title="Confirm Expense" onPress={props.onConfirmReceipt} />
      </View>
      <Text style={styles.meta}>
        Parse latency: {props.parseLatencyMs == null ? '-' : `${props.parseLatencyMs} ms`}
      </Text>

      {props.parseResult ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Receipt Parse</Text>
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
