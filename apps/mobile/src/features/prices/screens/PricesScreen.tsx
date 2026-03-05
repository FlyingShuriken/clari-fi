import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Switch, Text, TextInput } from 'react-native-paper';
import { ScreenContainer } from '../../../components/ui/screen-container';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { TEST_IDS } from '../../../core/testing/test-ids';

export function PricesScreen() {
  const controller = useClariFiController();

  return (
    <ScreenContainer>
      <Card mode="contained" style={styles.card}>
        <Card.Title title="Price Intelligence" subtitle="Compare and track item prices" />
        <Card.Content style={styles.content}>
          <TextInput
            label="Item"
            value={controller.priceQueryItem}
            onChangeText={controller.setPriceQueryItem}
            mode="outlined"
            autoCapitalize="none"
            testID={TEST_IDS.prices.itemInput}
          />

          <TextInput
            label="Area (optional)"
            value={controller.priceQueryArea}
            onChangeText={controller.setPriceQueryArea}
            mode="outlined"
          />

          <View style={styles.row}>
            <TextInput
              style={styles.flexInput}
              label="Lat"
              value={controller.priceQueryLat}
              onChangeText={controller.setPriceQueryLat}
              mode="outlined"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.flexInput}
              label="Lng"
              value={controller.priceQueryLng}
              onChangeText={controller.setPriceQueryLng}
              mode="outlined"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.flexInput}
              label="Radius km"
              value={controller.priceQueryRadiusKm}
              onChangeText={controller.setPriceQueryRadiusKm}
              mode="outlined"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.rowBetween}>
            <Chip
              icon={controller.priceHistoryInterval === 'day' ? 'calendar-today' : 'calendar-week'}
              onPress={() =>
                controller.setPriceHistoryInterval(
                  controller.priceHistoryInterval === 'day' ? 'week' : 'day',
                )
              }
            >
              Interval: {controller.priceHistoryInterval}
            </Chip>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Include promos</Text>
              <Switch
                value={controller.includePromo}
                onValueChange={controller.setIncludePromo}
                testID={TEST_IDS.prices.includePromoSwitch}
              />
            </View>
          </View>

          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.loadPriceCompareResult}
              loading={controller.loading}
              disabled={controller.loading}
              icon="swap-horizontal"
              testID={TEST_IDS.prices.compareButton}
            >
              Compare
            </Button>
            <Button
              mode="outlined"
              onPress={controller.loadPriceHistoryResult}
              disabled={controller.loading}
              icon="chart-timeline-variant"
              testID={TEST_IDS.prices.historyButton}
            >
              History
            </Button>
            <Button
              mode="text"
              onPress={controller.loadPriceSignalResult}
              disabled={controller.loading}
              icon="lightning-bolt-outline"
              testID={TEST_IDS.prices.signalButton}
            >
              Buy vs Wait
            </Button>
          </View>

          {controller.priceCompareResult ? (
            <>
              <Divider />
              <Text variant="titleSmall">Price comparison</Text>
              {controller.priceCompareResult.rows.length === 0 ? (
                <Text variant="bodySmall" style={styles.meta}>
                  No rows for selected filters.
                </Text>
              ) : (
                controller.priceCompareResult.rows.map((row, index) => (
                  <Card mode="outlined" style={styles.innerCard} key={`${row.storeName ?? row.areaText ?? 'row'}-${index}`}>
                    <Card.Content style={styles.listBlock}>
                      <Text variant="titleSmall">{row.storeName || row.areaText || 'Unknown area'}</Text>
                      <Text variant="bodySmall" style={styles.meta}>
                        Latest: {controller.formatCurrency(row.latestUnitPrice)} · Avg:{' '}
                        {controller.formatCurrency(row.averageUnitPrice)}
                      </Text>
                      <Text variant="bodySmall" style={styles.meta}>
                        Trust: {(row.averageTrustScore * 100).toFixed(1)}% · Samples: {row.sampleSize}
                      </Text>
                    </Card.Content>
                  </Card>
                ))
              )}
            </>
          ) : null}

          {controller.priceHistoryResult ? (
            <>
              <Divider />
              <Text variant="titleSmall">Price history</Text>
              {controller.priceHistoryResult.points.length === 0 ? (
                <Text variant="bodySmall" style={styles.meta}>
                  No historical observations yet.
                </Text>
              ) : (
                controller.priceHistoryResult.points.map((point) => (
                  <View style={styles.rowBetween} key={point.bucket}>
                    <Text variant="bodySmall">{point.bucket}</Text>
                    <Text variant="bodySmall">
                      Min {controller.formatCurrency(point.minUnitPrice)} / Avg{' '}
                      {controller.formatCurrency(point.avgUnitPrice)} / Max{' '}
                      {controller.formatCurrency(point.maxUnitPrice)}
                    </Text>
                  </View>
                ))
              )}
            </>
          ) : null}

          {controller.priceSignalResult ? (
            <>
              <Divider />
              <Text variant="titleSmall">Buy now vs wait signal</Text>
              <Card mode="outlined" style={styles.innerCard}>
                <Card.Content style={styles.listBlock}>
                  <View style={styles.rowBetween}>
                    <Chip
                      icon={
                        controller.priceSignalResult.decision === 'BUY_NOW'
                          ? 'cart-check'
                          : controller.priceSignalResult.decision === 'WAIT'
                            ? 'clock-outline'
                            : 'minus-circle-outline'
                      }
                    >
                      {controller.priceSignalResult.decision}
                    </Chip>
                    <Text variant="bodySmall" style={styles.meta}>
                      Confidence {(controller.priceSignalResult.confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <Text variant="bodySmall" style={styles.meta}>
                    Horizon {controller.priceSignalResult.horizonDays}d · Expected delta{' '}
                    {controller.priceSignalResult.expectedDeltaPct.toFixed(2)}%
                  </Text>
                  <Text variant="bodySmall" style={styles.meta}>
                    Latest {controller.formatCurrency(controller.priceSignalResult.diagnostics.latestUnitPrice)} · Avg
                    30d {controller.formatCurrency(controller.priceSignalResult.diagnostics.avg30d)}
                  </Text>
                  {controller.priceSignalResult.reasons.map((reason) => (
                    <Text key={reason.code} variant="bodySmall" style={styles.meta}>
                      • {reason.label}
                    </Text>
                  ))}
                  {controller.priceSignalResult.diagnostics.gatedNeutral &&
                  controller.priceSignalResult.diagnostics.gateReason ? (
                    <Text variant="bodySmall" style={styles.meta}>
                      Gate: {controller.priceSignalResult.diagnostics.gateReason}
                    </Text>
                  ) : null}
                </Card.Content>
              </Card>
            </>
          ) : null}

        </Card.Content>
      </Card>

      <Card mode="contained" style={styles.card}>
        <Card.Title title="Promo Ingestion" subtitle="Upload booklet/promo images for price signals" />
        <Card.Content style={styles.content}>
          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.pickPromoCamera}
              disabled={controller.loading}
              icon="camera"
              testID={TEST_IDS.prices.promoCameraButton}
            >
              Camera
            </Button>
            <Button
              mode="outlined"
              onPress={controller.pickPromoGallery}
              disabled={controller.loading}
              icon="image-multiple-outline"
              testID={TEST_IDS.prices.promoGalleryButton}
            >
              Gallery
            </Button>
          </View>

          <Text variant="bodySmall" style={styles.meta}>
            Promo image: {controller.promoReady ? 'Ready' : 'Not selected'}
          </Text>
          <Text variant="bodySmall" style={styles.meta}>
            File ref: {controller.promoFileRef || '-'}
          </Text>

          <TextInput
            label="Merchant hint"
            value={controller.promoMerchantHint}
            onChangeText={controller.setPromoMerchantHint}
            mode="outlined"
          />
          <TextInput
            label="Area hint"
            value={controller.promoAreaHint}
            onChangeText={controller.setPromoAreaHint}
            mode="outlined"
          />

          <View style={styles.row}>
            <Button
              mode="contained"
              onPress={controller.ingestPromoFile}
              disabled={controller.loading || !controller.promoFileRef}
              icon="upload"
              testID={TEST_IDS.prices.promoIngestButton}
            >
              Ingest promo
            </Button>
            <Button
              mode="outlined"
              onPress={controller.loadPromos}
              disabled={controller.loading}
              icon="refresh"
              testID={TEST_IDS.prices.promoListButton}
            >
              Load promos
            </Button>
          </View>

          {controller.promoIngestionResult ? (
            <Text variant="bodySmall" style={styles.meta}>
              Ingestion {controller.promoIngestionResult.status} · created {controller.promoIngestionResult.created}
              , skipped {controller.promoIngestionResult.skipped}
            </Text>
          ) : null}

          {controller.promoItems.length > 0 ? (
            <>
              <Divider />
              {controller.promoItems.map((item) => (
                <Card key={item.id} mode="outlined" style={styles.innerCard}>
                  <Card.Content style={styles.listBlock}>
                    <Text variant="titleSmall">{item.merchantText || 'Promo source'}</Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {item.status} · {item.areaText || 'No area'}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      Observations: {item.observations.length}
                    </Text>
                  </Card.Content>
                </Card>
              ))}
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
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flexInput: {
    flex: 1,
  },
  meta: {
    color: '#64748b',
  },
  innerCard: {
    borderRadius: 12,
  },
  listBlock: {
    gap: 4,
  },
});
