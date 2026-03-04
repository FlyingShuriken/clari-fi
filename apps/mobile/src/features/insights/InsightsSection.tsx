import { Button, StyleSheet, Text, View } from 'react-native';

interface InsightsSectionProps {
  ledgerPreview: string;
  reportPreview: string;
  onLoadLedger: () => void;
  onLoadReport: () => void;
}

export function InsightsSection(props: InsightsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>4) Ledger & Report</Text>

      <View style={styles.row}>
        <Button title="Load Ledger" onPress={props.onLoadLedger} />
        <Button title="Load Monthly Report" onPress={props.onLoadReport} />
      </View>

      {props.ledgerPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Ledger Response</Text>
          <Text style={styles.preview}>{props.ledgerPreview}</Text>
        </View>
      ) : null}

      {props.reportPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Report Response</Text>
          <Text style={styles.preview}>{props.reportPreview}</Text>
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
