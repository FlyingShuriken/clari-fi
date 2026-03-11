import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import {
  ExpenseConfirmEditor,
  type ExpenseConfirmLocation,
} from '../components/expense-confirm-editor';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function currencyLabel(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function displayMerchantTitle(primary: string | undefined, secondary: string | undefined, fallback: string): string {
  const merchant = primary?.trim();
  if (merchant) {
    return merchant;
  }

  const location = secondary?.trim();
  if (location) {
    return location;
  }

  return fallback;
}

function emptyConfirmLocation(): ExpenseConfirmLocation {
  return {
    labelText: '',
    areaText: '',
    source: 'unset',
  };
}

export function CaptureScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  const isListening = controller.recognitionState === 'listening';
  const isProcessing = controller.recognitionState === 'processing';
  const voiceCandidate = controller.voiceParse?.candidate;
  const documentParse = controller.documentParse;
  const lastCapture = controller.ledgerItems[0] ?? null;
  const [voiceMerchantInput, setVoiceMerchantInput] = useState('');
  const [voiceLocationInput, setVoiceLocationInput] = useState<ExpenseConfirmLocation>(emptyConfirmLocation);
  const [receiptMerchantInput, setReceiptMerchantInput] = useState('');
  const [receiptLocationInput, setReceiptLocationInput] = useState<ExpenseConfirmLocation>(emptyConfirmLocation);

  useEffect(() => {
    if (!isListening) {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1.55, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.35, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, pulseAnim, pulseOpacity]);

  useEffect(() => {
    setVoiceMerchantInput(voiceCandidate?.merchantText ?? '');
    setVoiceLocationInput(emptyConfirmLocation());
  }, [voiceCandidate?.merchantText]);

  useEffect(() => {
    if (documentParse?.documentKind === 'receipt') {
      setReceiptMerchantInput(documentParse.candidate.merchantText ?? '');
      setReceiptLocationInput(emptyConfirmLocation());
      return;
    }

    setReceiptMerchantInput('');
    setReceiptLocationInput(emptyConfirmLocation());
  }, [documentParse]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.appName}>ClariFi</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerChip} onPress={() => navigation.navigate('Subscription')}>
            <MaterialCommunityIcons name="crown-outline" size={16} color={Colors.green} />
            <Text style={styles.headerChipText}>
              {controller.subscription?.plan === 'PREMIUM' ? 'Premium' : 'Upgrade'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('Account')}>
            <MaterialCommunityIcons name="cog-outline" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroCard}>
          <View style={styles.labelRow}>
            <View style={styles.greenDot} />
            <Text style={styles.labelText}>VOICE CAPTURE</Text>
          </View>

          <View style={styles.micWrapper}>
            <Animated.View
              style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: pulseOpacity }]}
            />
            <TouchableOpacity
              style={[styles.micBtn, isListening && styles.micBtnActive]}
              onPress={isListening ? controller.stopListening : controller.startListening}
              disabled={controller.loading || isProcessing}
              testID={isListening ? TEST_IDS.capture.stopListeningButton : TEST_IDS.capture.startListeningButton}
            >
              {isProcessing ? (
                <ActivityIndicator size={34} color={Colors.bg} />
              ) : (
                <MaterialCommunityIcons
                  name={isListening ? 'stop' : 'microphone'}
                  size={42}
                  color={Colors.bg}
                />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.heroTitle}>
            {isListening ? 'Listening…' : isProcessing ? 'Processing…' : 'Speak an expense'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {controller.recognizerAvailable === false
              ? 'Voice recognizer unavailable on this device'
              : 'Quick entry for ledger only. Voice no longer feeds market prices.'}
          </Text>

          {(controller.transcriptInput || voiceCandidate) ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={controller.parseVoiceExpense}
                disabled={controller.loading}
                testID={TEST_IDS.capture.parseVoiceButton}
              >
                <Text style={styles.primaryBtnText}>Parse voice</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {voiceCandidate ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultMeta}>Voice expense</Text>
              <Text style={styles.resultTitle}>
                {displayMerchantTitle(
                  voiceMerchantInput || voiceCandidate.merchantText,
                  voiceLocationInput.labelText || voiceLocationInput.areaText,
                  'Unknown merchant',
                )}
              </Text>
              <Text style={styles.resultAmount}>{currencyLabel(voiceCandidate.currency, voiceCandidate.totalAmount)}</Text>
              <ExpenseConfirmEditor
                apiBaseUrl={controller.apiBaseUrl}
                merchantValue={voiceMerchantInput}
                onMerchantChange={setVoiceMerchantInput}
                locationValue={voiceLocationInput}
                onLocationChange={setVoiceLocationInput}
              />
              <TouchableOpacity
                style={styles.primaryBtnFull}
                onPress={() =>
                  controller.confirmVoiceExpense({
                    merchantText: voiceMerchantInput,
                    areaText: voiceLocationInput.areaText,
                    locationLat: voiceLocationInput.lat,
                    locationLng: voiceLocationInput.lng,
                  })
                }
                disabled={controller.loading}
                testID={TEST_IDS.capture.confirmVoiceButton}
              >
                <Text style={styles.primaryBtnText}>Confirm voice expense</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.documentCard}>
          <View style={styles.labelRow}>
            <MaterialCommunityIcons name="image-multiple-outline" size={14} color={Colors.indigo} />
            <Text style={styles.labelText}>DOCUMENT INTELLIGENCE</Text>
          </View>
          <Text style={styles.sectionTitle}>Scan or upload a receipt or booklet</Text>
          <Text style={styles.sectionCopy}>
            The app auto-detects whether your image is a paid receipt or a promo flyer. Receipts save expenses. Flyers save promotion prices only.
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={controller.pickDocumentCamera}>
              <MaterialCommunityIcons name="camera-outline" size={16} color={Colors.bg} />
              <Text style={styles.primaryBtnText}>Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={controller.pickDocumentGallery}>
              <MaterialCommunityIcons name="image-outline" size={16} color={Colors.textPrimary} />
              <Text style={styles.secondaryBtnText}>Upload images</Text>
            </TouchableOpacity>
          </View>

          {controller.documentReady ? (
            <View style={styles.selectedCard}>
              <Text style={styles.selectedTitle}>
                {controller.documentImageCount} image{controller.documentImageCount === 1 ? '' : 's'} ready
              </Text>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.primaryBtn} onPress={controller.parseSelectedDocument}>
                  <Text style={styles.primaryBtnText}>Detect & parse</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={controller.clearParsedDocument}>
                  <Text style={styles.secondaryBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {documentParse?.documentKind === 'receipt' ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultMeta}>Detected receipt</Text>
              <Text style={styles.resultTitle}>
                {displayMerchantTitle(
                  receiptMerchantInput || documentParse.candidate.merchantText,
                  receiptLocationInput.labelText || receiptLocationInput.areaText,
                  'Unknown merchant',
                )}
              </Text>
              <Text style={styles.resultAmount}>
                {currencyLabel(documentParse.candidate.currency, documentParse.candidate.totalAmount)}
              </Text>
              <ExpenseConfirmEditor
                apiBaseUrl={controller.apiBaseUrl}
                merchantValue={receiptMerchantInput}
                onMerchantChange={setReceiptMerchantInput}
                locationValue={receiptLocationInput}
                onLocationChange={setReceiptLocationInput}
              />
              {documentParse.candidate.lineItems.slice(0, 4).map((item, index) => (
                <Text key={`${item.descriptionRaw}-${index}`} style={styles.resultLine}>
                  {item.descriptionRaw} · {currencyLabel(documentParse.candidate.currency, item.totalPrice)}
                </Text>
              ))}
              <TouchableOpacity
                style={styles.primaryBtnFull}
                onPress={() =>
                  controller.confirmParsedDocument({
                    merchantText: receiptMerchantInput,
                    areaText: receiptLocationInput.areaText,
                    locationLat: receiptLocationInput.lat,
                    locationLng: receiptLocationInput.lng,
                  })
                }
                disabled={controller.loading}
              >
                <Text style={styles.primaryBtnText}>Confirm receipt expense</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {documentParse?.documentKind === 'flyer' ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultMeta}>Detected flyer / booklet</Text>
              <Text style={styles.resultTitle}>{documentParse.candidate.merchantText || 'Unknown store'}</Text>
              <Text style={styles.sectionCopy}>
                {documentParse.candidate.validFrom || documentParse.candidate.validTo
                  ? `Valid ${documentParse.candidate.validFrom ?? '?'} → ${documentParse.candidate.validTo ?? '?'}`
                  : 'No validity dates detected'}
              </Text>
              {documentParse.candidate.lineItems.slice(0, 4).map((item, index) => (
                <Text key={`${item.descriptionRaw}-${index}`} style={styles.resultLine}>
                  {item.descriptionRaw} · {currencyLabel(documentParse.candidate.currency, item.totalPrice)}
                </Text>
              ))}
              <TouchableOpacity style={styles.primaryBtnFull} onPress={() => controller.confirmParsedDocument()}>
                <Text style={styles.primaryBtnText}>Save promo prices</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {documentParse?.documentKind === 'unknown' ? (
            <View style={styles.resultCard}>
              <Text style={styles.resultMeta}>Could not classify</Text>
              <Text style={styles.sectionCopy}>{documentParse.reason}</Text>
            </View>
          ) : null}
        </View>

        {lastCapture ? (
          <View style={styles.recentCard}>
            <Text style={styles.resultMeta}>Last capture</Text>
            <View style={styles.recentRow}>
              <View>
                <Text style={styles.resultTitle}>{lastCapture.merchant}</Text>
                <Text style={styles.sectionCopy}>{lastCapture.paymentMethod}</Text>
              </View>
              <Text style={styles.resultAmount}>
                {controller.formatCurrency(lastCapture.totalAmount, lastCapture.currency)}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  greeting: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  appName: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.greenDim,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  headerChipText: {
    color: Colors.green,
    fontSize: 12,
    fontWeight: '700',
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    gap: 14,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 26,
    padding: 20,
    gap: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
  },
  labelText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  micWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 170,
  },
  pulseRing: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: Colors.green,
  },
  micBtn: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: Colors.coral,
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 120,
  },
  primaryBtnFull: {
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 120,
  },
  secondaryBtnDisabled: {
    opacity: 0.45,
  },
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  documentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionCopy: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  selectedCard: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  selectedTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  resultMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  resultTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  resultAmount: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  resultLine: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
});
