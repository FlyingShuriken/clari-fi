import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

interface PriceAlertsSectionProps {
  item: string;
  onItemChange: (value: string) => void;
  targetUnitPrice: string;
  onTargetUnitPriceChange: (value: string) => void;
  radiusKm: string;
  onRadiusKmChange: (value: string) => void;
  areaText: string;
  onAreaTextChange: (value: string) => void;
  lat: string;
  onLatChange: (value: string) => void;
  lng: string;
  onLngChange: (value: string) => void;
  alertsPreview: string;
  eventsPreview: string;
  checkPreview: string;
  unreadCount: number;
  onCreateAlert: () => void;
  onLoadAlerts: () => void;
  onCheckAlerts: () => void;
  onLoadEvents: () => void;
  onMarkAllRead: () => void;
}

export function PriceAlertsSection(props: PriceAlertsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>6) Price Alerts (In-App)</Text>

      <Text style={styles.label}>Item</Text>
      <TextInput
        style={styles.input}
        value={props.item}
        onChangeText={props.onItemChange}
        placeholder="watermelon"
        autoCapitalize="none"
      />

      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.label}>Target unit price</Text>
          <TextInput
            style={styles.input}
            value={props.targetUnitPrice}
            onChangeText={props.onTargetUnitPriceChange}
            keyboardType="decimal-pad"
            placeholder="5.00"
          />
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>Radius km</Text>
          <TextInput
            style={styles.input}
            value={props.radiusKm}
            onChangeText={props.onRadiusKmChange}
            keyboardType="decimal-pad"
            placeholder="10"
          />
        </View>
      </View>

      <Text style={styles.label}>Area (optional)</Text>
      <TextInput
        style={styles.input}
        value={props.areaText}
        onChangeText={props.onAreaTextChange}
        placeholder="Kota Kinabalu"
      />

      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.label}>Current lat</Text>
          <TextInput
            style={styles.input}
            value={props.lat}
            onChangeText={props.onLatChange}
            keyboardType="decimal-pad"
            placeholder="5.9804"
          />
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>Current lng</Text>
          <TextInput
            style={styles.input}
            value={props.lng}
            onChangeText={props.onLngChange}
            keyboardType="decimal-pad"
            placeholder="116.0735"
          />
        </View>
      </View>

      <View style={styles.row}>
        <Button title="Create Alert" onPress={props.onCreateAlert} />
        <Button title="Load Alerts" onPress={props.onLoadAlerts} />
      </View>

      <View style={styles.row}>
        <Button title="Check Nearby Alerts" onPress={props.onCheckAlerts} />
        <Button title="Load Events" onPress={props.onLoadEvents} />
      </View>

      <View style={styles.row}>
        <Button title={`Unread: ${props.unreadCount}`} onPress={props.onLoadEvents} />
        <Button title="Mark All Read" onPress={props.onMarkAllRead} />
      </View>

      {props.alertsPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Alerts Response</Text>
          <Text style={styles.preview}>{props.alertsPreview}</Text>
        </View>
      ) : null}

      {props.checkPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Check Response</Text>
          <Text style={styles.preview}>{props.checkPreview}</Text>
        </View>
      ) : null}

      {props.eventsPreview ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Events Response</Text>
          <Text style={styles.preview}>{props.eventsPreview}</Text>
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
