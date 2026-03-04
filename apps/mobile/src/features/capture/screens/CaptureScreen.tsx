import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { TEST_IDS } from '../../../core/testing/test-ids';

function currencyLabel(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

export function CaptureScreen() {
  const controller = useClariFiController();

  const voiceCandidate = controller.voiceParse?.candidate;
  const receiptCandidate = controller.receiptParse?.candidate;

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Voice Capture" subtitle="Speak expense, review, then confirm" />
        <Card.Content style={styles.content}>
          <View style={styles.chipRow}>
            <Chip compact icon="microphone-outline">
              {controller.recognizerAvailable == null
                ? 'Recognizer: checking'
                : controller.recognizerAvailable
                  ? 'Recognizer: available'
                  : 'Recognizer: unavailable'}
            </Chip>
            <Chip compact icon="waveform">
              State: {controller.recognitionState}
            </Chip>
          </View>

          <TextInput
            label="Transcript"
            value={controller.transcriptInput}
            onChangeText={controller.setTranscriptInput}
            multiline
            mode="outlined"
            placeholder="Tap Start, speak your expense, then edit if needed."
            testID={TEST_IDS.capture.transcriptInput}
          />

          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.startListening}
              disabled={controller.loading || controller.recognitionState === 'listening'}
              icon="microphone"
              testID={TEST_IDS.capture.startListeningButton}
            >
              Start
            </Button>
            <Button
              mode="outlined"
              onPress={controller.stopListening}
              disabled={
                controller.loading ||
                (controller.recognitionState !== 'listening' &&
                  controller.recognitionState !== 'processing')
              }
              icon="stop-circle-outline"
              testID={TEST_IDS.capture.stopListeningButton}
            >
              Stop
            </Button>
          </View>

          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.parseVoiceExpense}
              disabled={controller.loading}
              icon="text-box-search-outline"
              testID={TEST_IDS.capture.parseVoiceButton}
            >
              Parse voice
            </Button>
            <Button
              mode="contained-tonal"
              onPress={controller.confirmVoiceExpense}
              disabled={controller.loading || !controller.voiceParse}
              icon="check-circle-outline"
              testID={TEST_IDS.capture.confirmVoiceButton}
            >
              Confirm
            </Button>
          </View>

          <Text variant="bodySmall" style={styles.meta}>
            Parse latency: {controller.voiceParseLatencyMs == null ? '-' : `${controller.voiceParseLatencyMs} ms`}
          </Text>

          {voiceCandidate ? (
            <View style={styles.previewBlock}>
              <Text variant="titleSmall">Parsed Voice Candidate</Text>
              <Text variant="bodySmall" style={styles.meta}>
                {voiceCandidate.merchantText || 'Unknown merchant'} · {currencyLabel(voiceCandidate.currency, voiceCandidate.totalAmount)}
              </Text>
              <Text variant="bodySmall" style={styles.meta}>
                Payment: {voiceCandidate.paymentMethod ?? 'N/A'}
              </Text>
              {voiceCandidate.note ? (
                <Text variant="bodySmall" style={styles.meta}>
                  Details: {voiceCandidate.note}
                </Text>
              ) : null}
              {voiceCandidate.lineItems.map((item, index) => (
                <Text key={`${item.descriptionRaw}-${index}`} variant="bodySmall" style={styles.lineItem}>
                  {item.descriptionRaw} · qty {item.quantity ?? 1} {item.unitRaw ?? ''} · {currencyLabel(voiceCandidate.currency, item.totalPrice)}
                </Text>
              ))}
            </View>
          ) : null}
        </Card.Content>
      </Card>

      <Card mode="contained" style={styles.card}>
        <Card.Title title="Receipt Capture" subtitle="Upload receipt image, parse, and confirm" />
        <Card.Content style={styles.content}>
          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.pickReceiptCamera}
              disabled={controller.loading}
              icon="camera-outline"
              testID={TEST_IDS.capture.receiptCameraButton}
            >
              Camera
            </Button>
            <Button
              mode="outlined"
              onPress={controller.pickReceiptGallery}
              disabled={controller.loading}
              icon="image-outline"
              testID={TEST_IDS.capture.receiptGalleryButton}
            >
              Gallery
            </Button>
          </View>

          <Text variant="bodySmall" style={styles.meta}>
            Receipt: {controller.receiptReady ? 'Ready' : 'Not selected'}
          </Text>
          <Text variant="bodySmall" style={styles.meta}>
            File ref: {controller.receiptFileRef || '-'}
          </Text>

          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.parseReceiptExpense}
              disabled={controller.loading || !controller.receiptReady}
              icon="file-search-outline"
              testID={TEST_IDS.capture.parseReceiptButton}
            >
              Parse receipt
            </Button>
            <Button
              mode="contained-tonal"
              onPress={controller.confirmReceiptExpense}
              disabled={controller.loading || !controller.receiptParse}
              icon="check-circle-outline"
              testID={TEST_IDS.capture.confirmReceiptButton}
            >
              Confirm
            </Button>
          </View>

          <Text variant="bodySmall" style={styles.meta}>
            Parse latency:{' '}
            {controller.receiptParseLatencyMs == null ? '-' : `${controller.receiptParseLatencyMs} ms`}
          </Text>

          {receiptCandidate ? (
            <>
              <Divider />
              <View style={styles.previewBlock}>
                <Text variant="titleSmall">Parsed Receipt Candidate</Text>
                <Text variant="bodySmall" style={styles.meta}>
                  {receiptCandidate.merchantText || 'Unknown merchant'} ·{' '}
                  {currencyLabel(receiptCandidate.currency, receiptCandidate.totalAmount)}
                </Text>
                {receiptCandidate.note ? (
                  <Text variant="bodySmall" style={styles.meta}>
                    Details: {receiptCandidate.note}
                  </Text>
                ) : null}
                {receiptCandidate.lineItems.map((item, index) => (
                  <Text key={`${item.descriptionRaw}-${index}`} variant="bodySmall" style={styles.lineItem}>
                    {item.descriptionRaw} · qty {item.quantity ?? 1} {item.unitRaw ?? ''} ·{' '}
                    {currencyLabel(receiptCandidate.currency, item.totalPrice)}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
        </Card.Content>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
  },
  content: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  previewBlock: {
    gap: 6,
  },
  meta: {
    color: '#475569',
  },
  lineItem: {
    color: '#0f172a',
  },
});
