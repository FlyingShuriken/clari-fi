import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';

interface AlertFormSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

const inputTheme = {
  colors: { onSurface: Colors.textPrimary, onSurfaceVariant: Colors.textSecondary },
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function AlertFormSheet({ visible, onDismiss }: AlertFormSheetProps) {
  const controller = useClariFiController();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss create alert form"
        />

        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
          accessibilityViewIsModal
          accessibilityLabel="Create alert sheet"
        >
          <View style={styles.header}>
            <Text style={styles.formTitle}>Create alert</Text>
            <TouchableOpacity
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close create alert form"
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              style={styles.closeBtn}
            >
              <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.kindRow}>
              {(['THRESHOLD', 'SIGNAL'] as const).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kindChip, controller.alertKind === k && styles.kindChipActive]}
                  onPress={() => controller.setAlertKind(k)}
                  accessibilityRole="button"
                  accessibilityLabel={k === 'THRESHOLD' ? 'Threshold alert' : 'Smart signal alert'}
                  accessibilityState={{ selected: controller.alertKind === k }}
                >
                  <Text style={[styles.kindText, controller.alertKind === k && styles.kindTextActive]}>
                    {k === 'THRESHOLD' ? 'Threshold' : 'Smart signal'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              label="Item"
              value={controller.alertItem}
              onChangeText={controller.setAlertItem}
              mode="outlined"
              style={styles.input}
              theme={inputTheme}
            />

            {controller.alertKind === 'THRESHOLD' ? (
              <TextInput
                label="Target unit price"
                value={controller.alertTargetUnitPrice}
                onChangeText={controller.setAlertTargetUnitPrice}
                keyboardType="decimal-pad"
                mode="outlined"
                style={styles.input}
                theme={inputTheme}
              />
            ) : (
              <>
                <View style={styles.kindRow}>
                  {(['BOTH', 'BUY_NOW', 'WAIT'] as const).map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[
                        styles.kindChip,
                        controller.alertSignalDecisionFilter === f && styles.kindChipActive,
                      ]}
                      onPress={() => controller.setAlertSignalDecisionFilter(f)}
                      accessibilityRole="button"
                      accessibilityLabel={`Signal decision filter ${f === 'BOTH' ? 'buy and wait' : f === 'BUY_NOW' ? 'buy now' : 'wait'}`}
                      accessibilityState={{ selected: controller.alertSignalDecisionFilter === f }}
                    >
                      <Text
                        style={[
                          styles.kindText,
                          controller.alertSignalDecisionFilter === f && styles.kindTextActive,
                        ]}
                      >
                        {f === 'BOTH' ? 'Buy + Wait' : f === 'BUY_NOW' ? 'Buy' : 'Wait'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  label="Min confidence (0–1)"
                  value={controller.alertSignalMinConfidence}
                  onChangeText={controller.setAlertSignalMinConfidence}
                  keyboardType="decimal-pad"
                  mode="outlined"
                  style={styles.input}
                  theme={inputTheme}
                />
              </>
            )}

            <View style={styles.locationRow}>
              <TextInput
                label="Radius km"
                value={controller.alertRadiusKm}
                onChangeText={controller.setAlertRadiusKm}
                keyboardType="decimal-pad"
                mode="outlined"
                style={[styles.input, { flex: 1 }]}
                theme={inputTheme}
              />
              <TextInput
                label="Area"
                value={controller.alertAreaText}
                onChangeText={controller.setAlertAreaText}
                mode="outlined"
                style={[styles.input, { flex: 1 }]}
                theme={inputTheme}
              />
            </View>

            <View style={styles.formBtns}>
              <TouchableOpacity
                style={styles.createBtn}
                onPress={async () => {
                  await controller.createAlert();
                  onDismiss();
                }}
                disabled={controller.loading}
                testID={TEST_IDS.alerts.createButton}
                accessibilityRole="button"
                accessibilityLabel="Create alert"
                accessibilityState={{ disabled: controller.loading }}
              >
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loadBtn}
                onPress={controller.loadAlerts}
                disabled={controller.loading}
                testID={TEST_IDS.alerts.loadAlertsButton}
                accessibilityRole="button"
                accessibilityLabel="Sync alert rules"
                accessibilityState={{ disabled: controller.loading }}
              >
                <Text style={styles.loadBtnText}>Sync alerts</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  content: {
    gap: 10,
    paddingBottom: 8,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  kindChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kindChipActive: {
    backgroundColor: Colors.greenDim,
    borderColor: Colors.green,
  },
  kindText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  kindTextActive: {
    color: Colors.green,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surface,
  },
  locationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  createBtn: {
    flex: 1,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  createBtnText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  loadBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
