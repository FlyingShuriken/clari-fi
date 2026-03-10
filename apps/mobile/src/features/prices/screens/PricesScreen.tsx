import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { DarkCard } from '../../../components/ui/dark-card';
import { PillBadge } from '../../../components/ui/pill-badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { ItemSelector } from '../components/item-selector';
import { PriceLocationSelector } from '../components/price-location-selector';
import { useLocation } from '../hooks/use-location';
import { useLocationSearch } from '../hooks/use-location-search';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

type Segment = 'intelligence' | 'promos';

const inputTheme = {
  colors: { onSurface: Colors.textPrimary, onSurfaceVariant: Colors.textSecondary },
};

function parseCoordinateText(value: string): number | undefined {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PricesScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [segment, setSegment] = useState<Segment>('intelligence');
  const [compareItems, setCompareItems] = useState<string[]>([]);
  const { loading: locLoading, error: locError, requestLocation } = useLocation();
  const bootstrappedLocation = useRef(false);
  const selectedLat = parseCoordinateText(controller.priceQueryLocation.latText);
  const selectedLng = parseCoordinateText(controller.priceQueryLocation.lngText);
  const {
    query: locationSearchQuery,
    setQuery: setLocationSearchQuery,
    suggestions: locationSuggestions,
    loading: locationSearchLoading,
    error: locationSearchError,
  } = useLocationSearch({
    apiBaseUrl: controller.apiBaseUrl,
    lat: selectedLat,
    lng: selectedLng,
    limit: 5,
  });

  useEffect(() => {
    if (bootstrappedLocation.current || controller.priceQueryLocation.source !== 'unset') {
      return;
    }

    bootstrappedLocation.current = true;
    void (async () => {
      const detected = await requestLocation();
      if (detected) {
        controller.applyDetectedPriceQueryLocation(detected);
        setLocationSearchQuery(detected.labelText ?? detected.areaText ?? '');
      }
    })();
  }, [
    controller.applyDetectedPriceQueryLocation,
    controller.priceQueryLocation.source,
    requestLocation,
    setLocationSearchQuery,
  ]);

  const handleUseCurrentLocation = async () => {
    const detected = await requestLocation();
    if (detected) {
      controller.applyDetectedPriceQueryLocation(detected);
      setLocationSearchQuery(detected.labelText ?? detected.areaText ?? '');
    }
  };

  const handleSelectLocation = (suggestion: {
    label: string;
    areaText: string;
    lat: number;
    lng: number;
  }) => {
    controller.selectPriceQueryLocation({
      labelText: suggestion.label,
      areaText: suggestion.areaText,
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
    setLocationSearchQuery(suggestion.label);
  };

  const handleFindStores = async () => {
    if (compareItems.length === 0) return;
    const lat = selectedLat;
    const lng = selectedLng;
    const radiusKm = parseCoordinateText(controller.priceQueryLocation.radiusKmText) ?? 10;
    const areaText = controller.priceQueryLocation.areaText.trim() || undefined;

    if (typeof lat === 'number' && typeof lng === 'number') {
      navigation.navigate('StoreMap', {
        items: compareItems,
        lat,
        lng,
        radiusKm,
        areaText,
      });
    } else {
      const detected = await requestLocation();
      if (!detected) {
        return;
      }

      controller.applyDetectedPriceQueryLocation(detected);
      setLocationSearchQuery(detected.labelText ?? detected.areaText ?? '');
      navigation.navigate('StoreMap', {
        items: compareItems,
        lat: detected.lat,
        lng: detected.lng,
        radiusKm,
        areaText: detected.areaText?.trim() || areaText,
      });
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Segment toggle */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, segment === 'intelligence' && styles.segmentBtnActive]}
          onPress={() => setSegment('intelligence')}
        >
          <Text style={[styles.segmentText, segment === 'intelligence' && styles.segmentTextActive]}>
            Intelligence
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, segment === 'promos' && styles.segmentBtnActive]}
          onPress={() => setSegment('promos')}
        >
          <Text style={[styles.segmentText, segment === 'promos' && styles.segmentTextActive]}>
            Promos
          </Text>
        </TouchableOpacity>
      </View>

      {segment === 'intelligence' ? (
        <>
          <PriceLocationSelector
            value={controller.priceQueryLocation}
            gpsLoading={locLoading}
            gpsError={locError}
            searchQuery={locationSearchQuery}
            searchLoading={locationSearchLoading}
            searchError={locationSearchError}
            suggestions={locationSuggestions}
            onSearchQueryChange={setLocationSearchQuery}
            onSelectSuggestion={handleSelectLocation}
            onUseCurrentLocation={handleUseCurrentLocation}
            onRadiusChange={(radiusKm) =>
              controller.updatePriceQueryLocation({
                radiusKmText: String(radiusKm),
              })
            }
          />

          {/* Multi-item store comparison */}
          <DarkCard radius={16}>
            <Text style={styles.resultTitle}>Store comparison</Text>
            <Text style={styles.sectionCopy}>
              Build a basket, then compare nearby stores using the selected location above.
            </Text>
            <ItemSelector items={compareItems} onItemsChange={setCompareItems} />
            <TouchableOpacity
              style={[styles.findStoresBtn, compareItems.length === 0 && styles.findStoresBtnDisabled]}
              onPress={handleFindStores}
              disabled={compareItems.length === 0 || locLoading}
            >
              <MaterialCommunityIcons name="store-search-outline" size={18} color={Colors.bg} />
              <Text style={styles.findStoresBtnText}>Find Stores</Text>
            </TouchableOpacity>
          </DarkCard>

          {/* Single-item query */}
          <DarkCard radius={16}>
            <Text style={styles.resultTitle}>Single item intelligence</Text>
            <Text style={styles.sectionCopy}>
              Compare, inspect history, and generate buy/wait signals using the selected location.
            </Text>
            <TextInput
              label="Item"
              value={controller.priceQueryItem}
              onChangeText={controller.setPriceQueryItem}
              mode="outlined"
              autoCapitalize="none"
              testID={TEST_IDS.prices.itemInput}
              style={styles.input}
              theme={inputTheme}
            />

            <View style={styles.optionRow}>
              <TouchableOpacity
                style={styles.intervalChip}
                onPress={() =>
                  controller.setPriceHistoryInterval(
                    controller.priceHistoryInterval === 'day' ? 'week' : 'day',
                  )
                }
              >
                <MaterialCommunityIcons
                  name={controller.priceHistoryInterval === 'day' ? 'calendar-today' : 'calendar-week'}
                  size={14}
                  color={Colors.textSecondary}
                />
                <Text style={styles.intervalText}>
                  {controller.priceHistoryInterval}
                </Text>
              </TouchableOpacity>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Promos</Text>
                <Switch
                  value={controller.includePromo}
                  onValueChange={controller.setIncludePromo}
                  trackColor={{ true: Colors.green, false: Colors.border }}
                  thumbColor={Colors.textPrimary}
                  testID={TEST_IDS.prices.includePromoSwitch}
                />
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={controller.loadPriceCompareResult}
                disabled={controller.loading}
                testID={TEST_IDS.prices.compareButton}
              >
                <MaterialCommunityIcons name="swap-horizontal" size={16} color={Colors.green} />
                <Text style={styles.actionBtnText}>Compare</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={controller.loadPriceHistoryResult}
                disabled={controller.loading}
                testID={TEST_IDS.prices.historyButton}
              >
                <MaterialCommunityIcons name="chart-timeline-variant" size={16} color={Colors.indigo} />
                <Text style={styles.actionBtnText}>History</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={controller.loadPriceSignalResult}
                disabled={controller.loading}
                testID={TEST_IDS.prices.signalButton}
              >
                <MaterialCommunityIcons name="lightning-bolt-outline" size={16} color={Colors.amber} />
                <Text style={styles.actionBtnText}>Buy vs Wait</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={controller.createSignalAlertFromPriceQuery}
                disabled={controller.loading}
                testID={TEST_IDS.prices.signalNotifyButton}
              >
                <MaterialCommunityIcons name="bell-plus-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.actionBtnText}>Notify</Text>
              </TouchableOpacity>
            </View>
          </DarkCard>

          {/* Compare results */}
          {controller.priceCompareResult ? (
            <DarkCard radius={16}>
              <Text style={styles.resultTitle}>Price comparison</Text>
              {controller.priceCompareResult.rows.length === 0 ? (
                <Text style={styles.emptyText}>No rows for selected filters.</Text>
              ) : (
                controller.priceCompareResult.rows.map((row, i) => (
                  <View
                    key={`${row.storeName ?? row.areaText ?? 'row'}-${i}`}
                    style={styles.resultRow}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>
                        {row.storeName || row.areaText || 'Unknown area'}
                      </Text>
                      <Text style={styles.resultMeta}>
                        Trust {(row.averageTrustScore * 100).toFixed(1)}% · {row.sampleSize} samples
                      </Text>
                    </View>
                    <View style={styles.resultPrices}>
                      <Text style={styles.resultPrice}>
                        {controller.formatCurrency(row.latestUnitPrice)}
                      </Text>
                      <Text style={styles.resultAvg}>
                        avg {controller.formatCurrency(row.averageUnitPrice)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </DarkCard>
          ) : null}

          {/* History results */}
          {controller.priceHistoryResult ? (
            <DarkCard radius={16}>
              <Text style={styles.resultTitle}>Price history</Text>
              {controller.priceHistoryResult.points.length === 0 ? (
                <Text style={styles.emptyText}>No historical observations yet.</Text>
              ) : (
                controller.priceHistoryResult.points.map((point) => (
                  <View key={point.bucket} style={styles.historyRow}>
                    <Text style={styles.historyBucket}>{point.bucket}</Text>
                    <Text style={styles.historyValues}>
                      {controller.formatCurrency(point.minUnitPrice)} / {controller.formatCurrency(point.avgUnitPrice)} / {controller.formatCurrency(point.maxUnitPrice)}
                    </Text>
                  </View>
                ))
              )}
            </DarkCard>
          ) : null}

          {/* Signal result */}
          {controller.priceSignalResult ? (
            <DarkCard radius={16} glow={controller.priceSignalResult.decision === 'BUY_NOW' ? 'green' : 'coral'}>
              <Text style={styles.resultTitle}>Buy now vs wait</Text>
              <View style={styles.signalRow}>
                <PillBadge
                  label={controller.priceSignalResult.decision}
                  color={
                    controller.priceSignalResult.decision === 'BUY_NOW'
                      ? 'green'
                      : controller.priceSignalResult.decision === 'WAIT'
                      ? 'coral'
                      : 'amber'
                  }
                />
                <Text style={styles.signalConfidence}>
                  {(controller.priceSignalResult.confidence * 100).toFixed(1)}% confidence
                </Text>
              </View>
              <Text style={styles.resultMeta}>
                Horizon {controller.priceSignalResult.horizonDays}d · Expected delta{' '}
                {controller.priceSignalResult.expectedDeltaPct.toFixed(2)}%
              </Text>
              <Text style={styles.resultMeta}>
                Latest {controller.formatCurrency(controller.priceSignalResult.diagnostics.latestUnitPrice)} · Avg30d{' '}
                {controller.formatCurrency(controller.priceSignalResult.diagnostics.avg30d)}
              </Text>
              {controller.priceSignalResult.reasons.map((reason) => (
                <Text key={reason.code} style={styles.signalReason}>
                  · {reason.label}
                </Text>
              ))}
            </DarkCard>
          ) : null}
        </>
      ) : (
        <>
          <DarkCard radius={16}>
            <Text style={styles.resultTitle}>Promo ingestion</Text>
            <View style={styles.promoButtons}>
              <TouchableOpacity
                style={[styles.promoBtn, styles.promoBtnPrimary]}
                onPress={controller.pickPromoCamera}
                disabled={controller.loading}
                testID={TEST_IDS.prices.promoCameraButton}
              >
                <MaterialCommunityIcons name="camera" size={18} color={Colors.bg} />
                <Text style={styles.promoBtnPrimaryText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.promoBtn, styles.promoBtnOutline]}
                onPress={controller.pickPromoGallery}
                disabled={controller.loading}
                testID={TEST_IDS.prices.promoGalleryButton}
              >
                <MaterialCommunityIcons name="image-multiple-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.promoBtnOutlineText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.promoStatus}>
              {controller.promoReady ? 'Image ready' : 'No image selected'}
            </Text>

            <TextInput
              label="Merchant hint"
              value={controller.promoMerchantHint}
              onChangeText={controller.setPromoMerchantHint}
              mode="outlined"
              style={styles.input}
              theme={inputTheme}
            />
            <TextInput
              label="Area hint"
              value={controller.promoAreaHint}
              onChangeText={controller.setPromoAreaHint}
              mode="outlined"
              style={styles.input}
              theme={inputTheme}
            />

            <View style={styles.promoActions}>
              <TouchableOpacity
                style={[styles.promoBtn, styles.promoBtnPrimary, !controller.promoFileRef && styles.promoBtnDisabled]}
                onPress={controller.ingestPromoFile}
                disabled={controller.loading || !controller.promoFileRef}
                testID={TEST_IDS.prices.promoIngestButton}
              >
                <Text style={styles.promoBtnPrimaryText}>Ingest promo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.promoBtn, styles.promoBtnOutline]}
                onPress={controller.loadPromos}
                disabled={controller.loading}
                testID={TEST_IDS.prices.promoListButton}
              >
                <Text style={styles.promoBtnOutlineText}>Load promos</Text>
              </TouchableOpacity>
            </View>

            {controller.promoIngestionResult ? (
              <Text style={styles.ingestionResult}>
                {controller.promoIngestionResult.status} · created {controller.promoIngestionResult.created}, skipped{' '}
                {controller.promoIngestionResult.skipped}
              </Text>
            ) : null}
          </DarkCard>

          {controller.promoItems.length > 0 ? (
            controller.promoItems.map((item) => (
              <DarkCard key={item.id} radius={16}>
                <Text style={styles.promoItemName}>{item.merchantText || 'Promo source'}</Text>
                <Text style={styles.resultMeta}>
                  {item.status} · {item.areaText || 'No area'} · {item.observations.length} obs
                </Text>
              </DarkCard>
            ))
          ) : null}

          {controller.promoItems.length === 0 && !controller.promoIngestionResult ? (
            <EmptyState icon="tag-outline" message="No promos loaded yet." />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
    gap: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.surfaceHigh,
  },
  segmentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.surface,
    fontSize: 13,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  intervalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  intervalText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  sectionCopy: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  resultMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultPrices: {
    alignItems: 'flex-end',
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.green,
  },
  resultAvg: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  historyBucket: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  historyValues: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  signalConfidence: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  signalReason: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  promoButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  promoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  promoBtnPrimary: {
    backgroundColor: Colors.green,
  },
  promoBtnPrimaryText: {
    color: Colors.bg,
    fontWeight: '700',
    fontSize: 14,
  },
  promoBtnOutline: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promoBtnOutlineText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  promoBtnDisabled: {
    opacity: 0.4,
  },
  promoStatus: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  promoActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  ingestionResult: {
    fontSize: 12,
    color: Colors.green,
    marginTop: 10,
  },
  promoItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  findStoresBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  findStoresBtnDisabled: {
    opacity: 0.4,
  },
  findStoresBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.bg,
  },
});
