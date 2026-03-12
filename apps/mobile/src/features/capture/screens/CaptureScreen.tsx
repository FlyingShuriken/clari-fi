import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { ExpenseConfirmModal, type ConfirmKind } from '../components/expense-confirm-modal';
import type { ExpenseConfirmLocation } from '../components/expense-confirm-editor';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function emptyConfirmLocation(): ExpenseConfirmLocation {
  return { labelText: '', areaText: '', source: 'unset' };
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

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);

  // Pulse animation while listening
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

  // Reset + auto-open modal when voice parse completes
  useEffect(() => {
    setVoiceMerchantInput(voiceCandidate?.merchantText ?? '');
    setVoiceLocationInput(emptyConfirmLocation());
    if (voiceCandidate) setVoiceModalOpen(true);
  }, [voiceCandidate?.merchantText]);

  // Reset + auto-open modal when document parse completes
  useEffect(() => {
    if (documentParse?.documentKind === 'receipt') {
      setReceiptMerchantInput(documentParse.candidate.merchantText ?? '');
      setReceiptLocationInput(emptyConfirmLocation());
      setDocModalOpen(true);
      return;
    }
    if (documentParse?.documentKind === 'flyer') {
      setDocModalOpen(true);
      return;
    }
    setReceiptMerchantInput('');
    setReceiptLocationInput(emptyConfirmLocation());
  }, [documentParse]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // ── Confirm handlers ──────────────────────────────────────────────
  const handleVoiceConfirm = () => {
    controller.confirmVoiceExpense({
      merchantText: voiceMerchantInput,
      areaText: voiceLocationInput.areaText,
      locationLat: voiceLocationInput.lat,
      locationLng: voiceLocationInput.lng,
    });
    setVoiceModalOpen(false);
  };

  const handleDocConfirm = () => {
    if (documentParse?.documentKind === 'receipt') {
      controller.confirmParsedDocument({
        merchantText: receiptMerchantInput,
        areaText: receiptLocationInput.areaText,
        locationLat: receiptLocationInput.lat,
        locationLng: receiptLocationInput.lng,
      });
    } else {
      controller.confirmParsedDocument();
    }
    setDocModalOpen(false);
  };

  // ── Derived display values ────────────────────────────────────────
  const voiceDocKind: ConfirmKind = 'voice';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
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
        {/* ── Voice hero card ── */}
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
              : voiceCandidate
                ? 'Parsed and ready for your review.'
                : controller.transcriptInput && controller.recognitionState === 'error'
                  ? 'Parsing failed. Retry parse.'
                : controller.transcriptInput
                  ? 'Recognized on device. Parsing automatically...'
                  : 'Quick entry for ledger only.'}
          </Text>

          {/* Photo buttons — only shown when idle and no parsed result */}
          {!isListening && !isProcessing && !voiceCandidate && !controller.transcriptInput && (
            <>
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.takePhotoBtn} onPress={controller.pickDocumentCamera}>
                  <MaterialCommunityIcons name="camera-outline" size={18} color={Colors.bg} />
                  <Text style={styles.takePhotoBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.libraryBtn} onPress={controller.pickDocumentGallery}>
                  <MaterialCommunityIcons name="image-outline" size={18} color={Colors.textPrimary} />
                  <Text style={styles.libraryBtnText}>From Library</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Retry parse button for fallback/error recovery only */}
          {controller.transcriptInput && !voiceCandidate && controller.recognitionState === 'error' ? (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={controller.parseVoiceExpense}
                disabled={controller.loading}
                testID={TEST_IDS.capture.parseVoiceButton}
              >
                <Text style={styles.primaryBtnText}>Retry parse</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Voice parsed preview — tap to re-open modal */}
          {voiceCandidate ? (
            <TouchableOpacity
              style={styles.previewCard}
              onPress={() => setVoiceModalOpen(true)}
              testID={TEST_IDS.capture.confirmVoiceButton}
            >
              <View style={styles.previewLeft}>
                <View style={[styles.previewIcon, { backgroundColor: Colors.greenDim }]}>
                  <MaterialCommunityIcons name="microphone" size={15} color={Colors.green} />
                </View>
                <View style={styles.previewInfo}>
                  <Text style={styles.previewMerchant} numberOfLines={1}>
                    {voiceMerchantInput || voiceCandidate.merchantText || 'Unknown merchant'}
                  </Text>
                  <Text style={styles.previewMeta}>Voice · Tap to review & confirm</Text>
                </View>
              </View>
              <View style={styles.previewRight}>
                <Text style={styles.previewAmount}>
                  {controller.formatCurrency(voiceCandidate.totalAmount, voiceCandidate.currency)}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Document card ── */}
        {(controller.documentReady || documentParse) ? (
          <View style={styles.documentCard}>
            <View style={styles.labelRow}>
              <MaterialCommunityIcons name="image-multiple-outline" size={14} color={Colors.indigo} />
              <Text style={styles.labelText}>DOCUMENT INTELLIGENCE</Text>
            </View>

            {/* Images ready — parse action */}
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

            {/* Receipt preview — tap to re-open modal */}
            {documentParse?.documentKind === 'receipt' ? (
              <TouchableOpacity style={styles.previewCard} onPress={() => setDocModalOpen(true)}>
                <View style={styles.previewLeft}>
                  <View style={[styles.previewIcon, { backgroundColor: `${Colors.indigo}20` }]}>
                    <MaterialCommunityIcons name="receipt" size={15} color={Colors.indigo} />
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewMerchant} numberOfLines={1}>
                      {receiptMerchantInput || documentParse.candidate.merchantText || 'Unknown merchant'}
                    </Text>
                    <Text style={styles.previewMeta}>
                      Receipt · {documentParse.candidate.lineItems.length} items · Tap to confirm
                    </Text>
                  </View>
                </View>
                <View style={styles.previewRight}>
                  <Text style={[styles.previewAmount, { color: Colors.indigo }]}>
                    {controller.formatCurrency(
                      documentParse.candidate.totalAmount,
                      documentParse.candidate.currency,
                    )}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            ) : null}

            {/* Flyer preview */}
            {documentParse?.documentKind === 'flyer' ? (
              <TouchableOpacity style={styles.previewCard} onPress={() => setDocModalOpen(true)}>
                <View style={styles.previewLeft}>
                  <View style={[styles.previewIcon, { backgroundColor: `${Colors.amber}20` }]}>
                    <MaterialCommunityIcons name="tag-multiple-outline" size={15} color={Colors.amber} />
                  </View>
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewMerchant} numberOfLines={1}>
                      {documentParse.candidate.merchantText || 'Unknown store'}
                    </Text>
                    <Text style={styles.previewMeta}>
                      Flyer · {documentParse.candidate.lineItems.length} promo prices · Tap to save
                    </Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : null}

            {/* Unknown */}
            {documentParse?.documentKind === 'unknown' ? (
              <View style={styles.unknownCard}>
                <MaterialCommunityIcons name="help-circle-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.unknownText}>{documentParse.reason}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Last capture ── */}
        {lastCapture ? (
          <View style={styles.recentCard}>
            <Text style={styles.resultMeta}>Last capture</Text>
            <View style={styles.recentRow}>
              <View style={styles.recentInfo}>
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

      {/* ── Modals ── */}
      {voiceCandidate ? (
        <ExpenseConfirmModal
          visible={voiceModalOpen}
          onDismiss={() => setVoiceModalOpen(false)}
          kind={voiceDocKind}
          merchantText={voiceCandidate.merchantText ?? ''}
          amount={voiceCandidate.totalAmount}
          currency={voiceCandidate.currency}
          lineItems={voiceCandidate.lineItems.map((l) => ({
            descriptionRaw: l.descriptionRaw,
            totalPrice: l.totalPrice,
            currency: voiceCandidate.currency,
          }))}
          merchantValue={voiceMerchantInput}
          onMerchantChange={setVoiceMerchantInput}
          locationValue={voiceLocationInput}
          onLocationChange={setVoiceLocationInput}
          onConfirm={handleVoiceConfirm}
          loading={controller.loading}
          confirmLabel="Confirm voice expense"
          apiBaseUrl={controller.apiBaseUrl}
          formatCurrency={controller.formatCurrency}
        />
      ) : null}

      {documentParse?.documentKind === 'receipt' ? (
        <ExpenseConfirmModal
          visible={docModalOpen}
          onDismiss={() => setDocModalOpen(false)}
          kind="receipt"
          merchantText={documentParse.candidate.merchantText ?? ''}
          amount={documentParse.candidate.totalAmount}
          currency={documentParse.candidate.currency}
          lineItems={documentParse.candidate.lineItems.map((l) => ({
            descriptionRaw: l.descriptionRaw,
            totalPrice: l.totalPrice,
            currency: documentParse.candidate.currency,
          }))}
          merchantValue={receiptMerchantInput}
          onMerchantChange={setReceiptMerchantInput}
          locationValue={receiptLocationInput}
          onLocationChange={setReceiptLocationInput}
          onConfirm={handleDocConfirm}
          loading={controller.loading}
          confirmLabel="Confirm receipt"
          apiBaseUrl={controller.apiBaseUrl}
          formatCurrency={controller.formatCurrency}
        />
      ) : null}

      {documentParse?.documentKind === 'flyer' ? (
        <ExpenseConfirmModal
          visible={docModalOpen}
          onDismiss={() => setDocModalOpen(false)}
          kind="flyer"
          merchantText={documentParse.candidate.merchantText ?? ''}
          amount={documentParse.candidate.lineItems.reduce((s, l) => s + l.totalPrice, 0)}
          currency={documentParse.candidate.currency}
          lineItems={documentParse.candidate.lineItems.map((l) => ({
            descriptionRaw: l.descriptionRaw,
            totalPrice: l.totalPrice,
            currency: documentParse.candidate.currency,
          }))}
          validFrom={documentParse.candidate.validFrom}
          validTo={documentParse.candidate.validTo}
          merchantValue=""
          onMerchantChange={() => undefined}
          locationValue={emptyConfirmLocation()}
          onLocationChange={() => undefined}
          onConfirm={handleDocConfirm}
          loading={controller.loading}
          confirmLabel="Save promo prices"
          apiBaseUrl={controller.apiBaseUrl}
          formatCurrency={controller.formatCurrency}
        />
      ) : null}
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

  // Hero voice card
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
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  orText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  takePhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    paddingVertical: 13,
    borderRadius: 99,
  },
  takePhotoBtnText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: '700',
  },
  libraryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceHigh,
    paddingVertical: 13,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  libraryBtnText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
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
  secondaryBtnText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Compact preview card (tap to open modal)
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    gap: 10,
  },
  previewLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
    gap: 2,
  },
  previewMerchant: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  previewMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  previewRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.green,
  },

  // Document card
  documentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12,
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
  unknownCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 14,
    padding: 12,
  },
  unknownText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },

  // Recent capture
  recentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  resultMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  recentInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionCopy: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  resultAmount: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
