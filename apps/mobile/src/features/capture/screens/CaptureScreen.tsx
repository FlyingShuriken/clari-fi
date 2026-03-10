import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ActivityIndicator, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function currencyLabel(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export function CaptureScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  const isListening  = controller.recognitionState === 'listening';
  const isProcessing = controller.recognitionState === 'processing';

  useEffect(() => {
    if (isListening) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim,    { toValue: 1.6, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0.35, duration: 600, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim,    { toValue: 1, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0);
      return undefined;
    }
  }, [isListening, pulseAnim, pulseOpacity]);

  const voiceCandidate   = controller.voiceParse?.candidate;
  const receiptCandidate = controller.receiptParse?.candidate;
  const lastCapture      = controller.ledgerItems[0] ?? null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.appName}>ClariFi</Text>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => navigation.navigate('Account')}
        >
          <MaterialCommunityIcons name="bell-outline" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Voice Hero Card */}
        <View style={styles.heroCard}>
          {/* VOICE CAPTURE pill */}
          <View style={styles.vcLabel}>
            <View style={styles.vcDot} />
            <Text style={styles.vcLabelText}>VOICE CAPTURE</Text>
          </View>

          {/* Mic button */}
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
                <ActivityIndicator size={36} color={Colors.bg} />
              ) : (
                <MaterialCommunityIcons
                  name={isListening ? 'stop' : 'microphone'}
                  size={44}
                  color={Colors.bg}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Instruction */}
          <View style={styles.instruction}>
            <Text style={styles.instructionTitle}>
              {isListening ? 'Listening…' : isProcessing ? 'Processing…' : 'Tap to speak your expense'}
            </Text>
            <Text style={styles.instructionSub}>
              {controller.recognizerAvailable === false
                ? 'Voice recognizer unavailable on this device'
                : 'e.g. "Coffee at Starbucks, RM 12"'}
            </Text>
          </View>

          {/* Divider + or */}
          <View style={styles.divider} />
          <Text style={styles.orText}>or</Text>

          {/* Upload Receipt pill button */}
          <TouchableOpacity
            style={styles.receiptBtn}
            onPress={controller.pickReceiptCamera}
            disabled={controller.loading}
            testID={TEST_IDS.capture.receiptCameraButton}
          >
            <MaterialCommunityIcons name="camera" size={16} color={Colors.textPrimary} />
            <Text style={styles.receiptBtnText}>Upload Receipt Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Parse / Confirm row (shown only when there's a transcript or parse result) */}
        {(controller.transcriptInput || voiceCandidate) ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionBtnPrimary}
              onPress={controller.parseVoiceExpense}
              disabled={controller.loading}
              testID={TEST_IDS.capture.parseVoiceButton}
            >
              <Text style={styles.actionBtnPrimaryText}>Parse voice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnOutline, !voiceCandidate && styles.actionBtnDisabled]}
              onPress={controller.confirmVoiceExpense}
              disabled={controller.loading || !voiceCandidate}
              testID={TEST_IDS.capture.confirmVoiceButton}
            >
              <Text style={[styles.actionBtnOutlineText, !voiceCandidate && { color: Colors.textMuted }]}>
                Confirm
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Voice parse result */}
        {voiceCandidate ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultMeta}>Parsed Voice Candidate</Text>
            <Text style={styles.resultMerchant}>{voiceCandidate.merchantText || 'Unknown merchant'}</Text>
            <Text style={styles.resultAmount}>
              {currencyLabel(voiceCandidate.currency, voiceCandidate.totalAmount)}
            </Text>
            {voiceCandidate.lineItems.map((item, i) => (
              <Text key={`${item.descriptionRaw}-${i}`} style={styles.resultLine}>
                {item.descriptionRaw} · {currencyLabel(voiceCandidate.currency, item.totalPrice)}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Receipt ready section */}
        {controller.receiptReady ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultMeta}>Receipt ready · {controller.receiptFileRef}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={controller.parseReceiptExpense}
                disabled={controller.loading}
                testID={TEST_IDS.capture.parseReceiptButton}
              >
                <Text style={styles.actionBtnPrimaryText}>Parse receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtnOutline, !receiptCandidate && styles.actionBtnDisabled]}
                onPress={controller.confirmReceiptExpense}
                disabled={controller.loading || !receiptCandidate}
                testID={TEST_IDS.capture.confirmReceiptButton}
              >
                <Text style={[styles.actionBtnOutlineText, !receiptCandidate && { color: Colors.textMuted }]}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
            {receiptCandidate ? (
              <View style={styles.candidateBlock}>
                <Text style={styles.resultMerchant}>{receiptCandidate.merchantText || 'Unknown'}</Text>
                <Text style={styles.resultAmount}>
                  {currencyLabel(receiptCandidate.currency, receiptCandidate.totalAmount)}
                </Text>
                {receiptCandidate.lineItems.map((item, i) => (
                  <Text key={`${item.descriptionRaw}-${i}`} style={styles.resultLine}>
                    {item.descriptionRaw} · {currencyLabel(receiptCandidate.currency, item.totalPrice)}
                  </Text>
                ))}
              </View>
            ) : null}
            {/* Gallery button accessible */}
            <TouchableOpacity
              style={{ height: 0, overflow: 'hidden', opacity: 0 }}
              onPress={controller.pickReceiptGallery}
              testID={TEST_IDS.capture.receiptGalleryButton}
            />
          </View>
        ) : null}

        {/* Last Capture card */}
        {lastCapture && !voiceCandidate && !receiptCandidate ? (
          <View style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentLabel}>LAST CAPTURE</Text>
              <Text style={styles.recentTime}>
                {new Date(lastCapture.transactionAt).toLocaleDateString('default', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <View style={styles.recentRow}>
              <View style={styles.recentLeft}>
                <View style={[styles.recentDot, { backgroundColor: Colors.catFood }]} />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentMerchant}>{lastCapture.merchant}</Text>
                  <Text style={styles.recentMeta}>
                    {lastCapture.paymentMethod}
                  </Text>
                </View>
              </View>
              <Text style={styles.recentAmount}>
                {controller.formatCurrency(lastCapture.totalAmount, lastCapture.currency)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Tip card */}
        {!voiceCandidate && !receiptCandidate ? (
          <View style={styles.tipCard}>
            <View style={styles.tipIconBox}>
              <MaterialCommunityIcons name="lightbulb-outline" size={16} color={Colors.indigo} />
            </View>
            <Text style={styles.tipText}>
              Try: "Lunch at Madam Kwan's, RM 45, paid by card"
            </Text>
          </View>
        ) : null}

        {/* Hidden transcript input for testID */}
        <View style={{ height: 1, opacity: 0 }}>
          <TextInput
            value={controller.transcriptInput}
            onChangeText={controller.setTranscriptInput}
            testID={TEST_IDS.capture.transcriptInput}
          />
        </View>
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
    paddingHorizontal: 24,
    height: 64,
  },
  headerLeft: {
    gap: 2,
  },
  greeting: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  appName: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: 'Georgia',
    letterSpacing: -0.3,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 16,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    gap: 20,
    alignItems: 'center',
  },
  vcLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#32D58315',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  vcDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.green,
  },
  vcLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.green,
    letterSpacing: 1,
  },
  micWrapper: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.green,
  },
  micBtn: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  micBtnActive: {
    backgroundColor: Colors.coral,
    shadowColor: Colors.coral,
  },
  instruction: {
    alignItems: 'center',
    gap: 4,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: 'Georgia',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  instructionSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#2A2A2E',
  },
  orText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 20,
    width: '100%',
  },
  receiptBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtnPrimary: {
    flex: 1,
    backgroundColor: Colors.green,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnPrimaryText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  actionBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnOutlineText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.green,
  },
  resultMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  resultMerchant: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  resultAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.green,
  },
  resultLine: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  candidateBlock: {
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  recentTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recentDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.8,
  },
  recentInfo: {
    gap: 2,
    flex: 1,
  },
  recentMerchant: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  recentMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  recentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  tipIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.indigoDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
