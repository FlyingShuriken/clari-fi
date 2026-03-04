import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

interface PriceIntelligenceSectionProps {
  itemQuery: string;
  onItemQueryChange: (value: string) => void;
  areaQuery: string;
  onAreaQueryChange: (value: string) => void;
  latInput: string;
  onLatInputChange: (value: string) => void;
  lngInput: string;
  onLngInputChange: (value: string) => void;
  radiusKmInput: string;
  onRadiusKmInputChange: (value: string) => void;
  interval: 'day' | 'week';
  onIntervalChange: (value: 'day' | 'week') => void;
  includePromo: boolean;
  onToggleIncludePromo: () => void;
  comparePreview: string;
  historyPreview: string;
  backfillPreview: string;
  onLoadCompare: () => void;
  onLoadHistory: () => void;
  onRunBackfill: () => void;
}

export function PriceIntelligenceSection(props: PriceIntelligenceSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>5) Price Intelligence</Text>

      <Text style={styles.label}>Item</Text>
      <TextInput
        style={styles.input}
        value={props.itemQuery}
        onChangeText={props.onItemQueryChange}
        placeholder="watermelon"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Area (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.areaQuery}
        onChangeText={props.onAreaQueryChange}
        placeholder="Kota Kinabalu"
      />

      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.label}>Lat</Text>
          <TextInput
            style={styles.input}
            value={props.latInput}
            onChangeText={props.onLatInputChange}
            keyboardType="decimal-pad"
            placeholder="5.9804"
          />
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>Lng</Text>
          <TextInput
            style={styles.input}
            value={props.lngInput}
            onChangeText={props.onLngInputChange}
            keyboardType="decimal-pad"
            placeholder="116.0735"
          />
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>Radius km</Text>
          <TextInput
            style={styles.input}
            value={props.radiusKmInput}
            onChangeText={props.onRadiusKmInputChange}
            keyboardType="decimal-pad"
            placeholder="10"
          />
        </View>
      </View>

      <View style={styles.row}>
        <Button title="Compare Prices" onPress={props.onLoadCompare} />
        <Button title="History" onPress={props.onLoadHistory} />
      </View>

      <View style={styles.row}>
        <Button
          title={`Interval: ${props.interval}`}
          onPress={() => props.onIntervalChange(props.interval === 'day' ? 'week' : 'day')}
        />
        <Button
          title={props.includePromo ? 'Promo: On' : 'Promo: Off'}
          onPress={props.onToggleIncludePromo}
        />
      </View>

      <View style={styles.row}>
        <Button title="Backfill Mine" onPress={props.onRunBackfill} />
      </View>

      {props.comparePreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Compare Response</Text>
          <Text style={styles.preview}>{props.comparePreview}</Text>
        </View>
      ) : null}

      {props.historyPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>History Response</Text>
          <Text style={styles.preview}>{props.historyPreview}</Text>
        </View>
      ) : null}

      {props.backfillPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Backfill Response</Text>
          <Text style={styles.preview}>{props.backfillPreview}</Text>
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
  label: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 6,
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
