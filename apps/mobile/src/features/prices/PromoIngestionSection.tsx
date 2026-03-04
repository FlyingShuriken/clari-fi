import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

interface PromoIngestionSectionProps {
  promoReady: boolean;
  promoFileRef: string;
  merchantText: string;
  onMerchantTextChange: (value: string) => void;
  areaText: string;
  onAreaTextChange: (value: string) => void;
  promoIngestPreview: string;
  promoListPreview: string;
  onPickPromoCamera: () => void;
  onPickPromoGallery: () => void;
  onIngestPromo: () => void;
  onLoadPromos: () => void;
}

export function PromoIngestionSection(props: PromoIngestionSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>7) Promo Ingestion</Text>

      <View style={styles.row}>
        <Button title="Promo Camera" onPress={props.onPickPromoCamera} />
        <Button title="Promo Gallery" onPress={props.onPickPromoGallery} />
      </View>
      <Text style={styles.meta}>Promo image: {props.promoReady ? 'Ready' : 'Not selected'}</Text>
      <Text style={styles.meta}>Artifact ref: {props.promoFileRef || '-'}</Text>

      <Text style={styles.label}>Merchant hint (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.merchantText}
        onChangeText={props.onMerchantTextChange}
        placeholder="Borneo Hypermart"
      />

      <Text style={styles.label}>Area hint (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.areaText}
        onChangeText={props.onAreaTextChange}
        placeholder="Kota Kinabalu"
      />

      <View style={styles.row}>
        <Button title="Ingest Promo" onPress={props.onIngestPromo} />
        <Button title="Load Promos" onPress={props.onLoadPromos} />
      </View>

      {props.promoIngestPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Ingest Response</Text>
          <Text style={styles.preview}>{props.promoIngestPreview}</Text>
        </View>
      ) : null}

      {props.promoListPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Promo List</Text>
          <Text style={styles.preview}>{props.promoListPreview}</Text>
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
