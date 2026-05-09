import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClariFiController } from '../../../core/state/clariFi-controller';
import { DarkCard } from '../../../components/ui/dark-card';
import { PillBadge } from '../../../components/ui/pill-badge';
import { PriceLocationSelector } from '../components/price-location-selector';
import { useLocation } from '../hooks/use-location';
import { useLocationSearch } from '../hooks/use-location-search';
import { Colors } from '../../../theme';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { RootStackParamList } from '../../../core/navigation/AppNavigator';

const RADIUS_OPTIONS = [1, 2, 5, 10];

function parseCoordinateText(value: string): number | undefined {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PricesScreen() {
  const controller = useClariFiController();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const [compareItems, setCompareItems] = useState<string[]>([]);
  const [itemInput, setItemInput] = useState('');
  const [locationExpanded, setLocationExpanded] = useState(false);

  const { loading: locLoading, error: locError, requestLocation } = useLocation();
  const bootstrappedLocation = useRef(false);

  const selectedLat = parseCoordinateText(controller.priceQueryLocation.latText);
  const selectedLng = parseCoordinateText(controller.priceQueryLocation.lngText);
  const selectedRadius = parseCoordinateText(controller.priceQueryLocation.radiusKmText) ?? 5;

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

  const compareLimit = controller.subscription?.compare.itemsPerSearch ?? 1;
  const compareRemaining = controller.subscription?.compare.remainingThisMonth ?? 15;

  useEffect(() => {
    if (bootstrappedLocation.current || controller.priceQueryLocation.source !== 'unset') return;
    bootstrappedLocation.current = true;
    void (async () => {
      const detected = await requestLocation();
      if (detected) {
        controller.applyDetectedPriceQueryLocation(detected);
        setLocationSearchQuery(detected.labelText ?? detected.areaText ?? '');
      }
    })();
  }, [controller.applyDetectedPriceQueryLocation, controller.priceQueryLocation.source, requestLocation, setLocationSearchQuery]);

  const handleUseCurrentLocation = async () => {
    const detected = await requestLocation();
    if (detected) {
      controller.applyDetectedPriceQueryLocation(detected);
      setLocationSearchQuery(detected.labelText ?? detected.areaText ?? '');
      setLocationExpanded(false);
    }
  };

  const handleSelectLocation = (suggestion: { label: string; areaText: string; lat: number; lng: number }) => {
    controller.selectPriceQueryLocation({
      labelText: suggestion.label,
      areaText: suggestion.areaText,
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
    setLocationSearchQuery(suggestion.label);
    setLocationExpanded(false);
  };

  const addItem = () => {
    const trimmed = itemInput.trim();
    if (!trimmed || compareItems.length >= compareLimit) return;
    if (compareItems.some((i) => i.toLowerCase() === trimmed.toLowerCase())) return;
    setCompareItems([...compareItems, trimmed]);
    setItemInput('');
  };

  const removeItem = (index: number) => {
    setCompareItems(compareItems.filter((_, i) => i !== index));
  };

  const handleFindStores = async () => {
    if (compareItems.length === 0) return;
    const lat = selectedLat;
    const lng = selectedLng;
    const radiusKm = selectedRadius;
    const areaText = controller.priceQueryLocation.areaText.trim() || undefined;

    if (typeof lat === 'number' && typeof lng === 'number') {
      navigation.navigate('StoreMap', { items: compareItems, lat, lng, radiusKm, areaText });
    } else {
      const detected = await requestLocation();
      if (!detected) return;
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

  const locationLabel =
    controller.priceQueryLocation.labelText.trim() ||
    controller.priceQueryLocation.areaText.trim() ||
    'Set your location';

  const locationSub =
    controller.priceQueryLocation.source === 'gps'
      ? 'GPS · Tap to change area'
      : controller.priceQueryLocation.source === 'search'
      ? 'Tap to change area'
      : 'Tap to set location';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Prices</Text>
          <Text style={styles.headerSub}>Find the best deal nearby</Text>
        </View>
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => navigation.navigate('Subscription')}
          accessibilityRole="button"
          accessibilityLabel="Open plan limits and upgrade options"
        >
          <MaterialCommunityIcons name="crown-outline" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Location card */}
        <TouchableOpacity
          style={styles.locationCard}
          onPress={() => setLocationExpanded((v) => !v)}
          activeOpacity={0.8}
            testID={TEST_IDS.prices.locationAreaInput}
            accessibilityRole="button"
            accessibilityLabel={`Location: ${locationLabel}. ${locationSub}`}
            accessibilityState={{ expanded: locationExpanded, busy: locLoading }}
        >
          {locLoading ? (
            <ActivityIndicator size="small" color={Colors.green} />
          ) : (
            <MaterialCommunityIcons name="map-marker" size={20} color={Colors.green} />
          )}
          <View style={styles.locationText}>
            <Text style={styles.locationLabel} numberOfLines={1}>{locationLabel}</Text>
            <Text style={styles.locationSub}>{locationSub}</Text>
          </View>
          <MaterialCommunityIcons
            name={locationExpanded ? 'chevron-down' : 'chevron-right'}
            size={16}
            color={Colors.textMuted}
          />
        </TouchableOpacity>

        {/* Inline location picker */}
        {locationExpanded && (
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
            onRadiusChange={(r) => controller.updatePriceQueryLocation({ radiusKmText: String(r) })}
          />
        )}

        {/* Watchlist section */}
        <Text style={styles.sectionLabel}>WATCHLIST</Text>

        <View style={styles.searchRow}>
          <View style={styles.inputBox}>
            <MaterialCommunityIcons name="magnify" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Add item to watchlist…"
              placeholderTextColor={Colors.textMuted}
              value={itemInput}
              onChangeText={setItemInput}
              onSubmitEditing={addItem}
              returnKeyType="done"
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity
            style={[styles.addBtn, compareItems.length >= compareLimit && styles.addBtnDisabled]}
            onPress={addItem}
            disabled={compareItems.length >= compareLimit || !itemInput.trim()}
            accessibilityRole="button"
            accessibilityLabel={compareItems.length >= compareLimit ? 'Item limit reached' : 'Add item to price search'}
            accessibilityState={{ disabled: compareItems.length >= compareLimit || !itemInput.trim() }}
          >
            <MaterialCommunityIcons name="plus" size={20} color={Colors.bg} />
          </TouchableOpacity>
        </View>

        {compareItems.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {compareItems.map((item, idx) => (
              <View key={item} style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
                <TouchableOpacity
                  onPress={() => removeItem(idx)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item} from search`}
                >
                  <MaterialCommunityIcons name="close" size={14} color={Colors.green} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {compareItems.length === 0 && (
          <Text style={styles.limitHint}>
            {compareLimit === 1
              ? '1 item/search on Free · Upgrade for more'
              : `Up to ${compareLimit} items · ${compareRemaining} searches left`}
          </Text>
        )}

        {/* Search radius */}
        <Text style={styles.sectionLabel}>SEARCH RADIUS</Text>

        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((km) => {
            const active = selectedRadius === km;
            return (
              <TouchableOpacity
                key={km}
                style={[styles.radiusPill, active && styles.radiusPillActive]}
                onPress={() => controller.updatePriceQueryLocation({ radiusKmText: String(km) })}
                accessibilityRole="button"
                accessibilityLabel={`Search within ${km} kilometers`}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.radiusPillText, active && styles.radiusPillTextActive]}>
                  {km} km
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search button */}
        <TouchableOpacity
          style={[styles.searchBtn, compareItems.length === 0 && styles.searchBtnDisabled]}
          onPress={handleFindStores}
          disabled={compareItems.length === 0 || locLoading}
          accessibilityRole="button"
          accessibilityLabel={compareItems.length === 0 ? 'Add items before searching stores' : `Search nearby stores within ${selectedRadius} kilometers`}
          accessibilityState={{ disabled: compareItems.length === 0 || locLoading, busy: locLoading }}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={compareItems.length === 0 ? Colors.textSecondary : Colors.bg}
          />
          <Text style={[styles.searchBtnText, compareItems.length === 0 && styles.searchBtnTextDisabled]}>
            {compareItems.length === 0
              ? 'Add items to search'
              : `Search Nearby · ${compareItems.length} item${compareItems.length > 1 ? 's' : ''} · ${selectedRadius}km`}
          </Text>
        </TouchableOpacity>

        {/* Compare results */}
        {controller.priceCompareResult ? (
          <DarkCard radius={16}>
            <Text style={styles.cardTitle}>Price comparison</Text>
            {controller.priceCompareResult.rows.length === 0 ? (
              <Text style={styles.emptyText}>No price rows match these filters. Try a wider radius or another item.</Text>
            ) : (() => {
              const rows = controller.priceCompareResult!.rows;
              const firstCommunityIdx = rows.findIndex((r: any) => !r.isPartner);
              return rows.map((row: any, i: number) => (
                <View key={`${row.storeName ?? row.areaText ?? 'row'}-${i}`}>
                  {/* Section divider before first community row */}
                  {i === firstCommunityIdx && firstCommunityIdx > 0 && (
                    <View style={styles.sectionDivider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerLabel}>COMMUNITY DATA</Text>
                      <View style={styles.dividerLine} />
                    </View>
                  )}
                  <View style={[styles.resultRow, row.isPartner && styles.partnerRow]}>
                    {row.isPartner && <View style={styles.partnerAccent} />}
                    <View style={styles.resultInfo}>
                      <View style={styles.resultNameRow}>
                        <Text style={styles.resultName}>{row.storeName || row.areaText || 'Unknown'}</Text>
                        {row.isPartner && (
                          <View style={styles.officialBadge}>
                            <Text style={styles.officialBadgeText}>Official</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.resultMeta}>
                        {row.isPartner
                          ? 'Live price · Partner data'
                          : `Trust ${(row.averageTrustScore * 100).toFixed(1)}% · ${row.sampleSize} samples`}
                      </Text>
                    </View>
                    <View style={styles.resultPrices}>
                      <Text style={[styles.resultPrice, row.isPartner && styles.partnerPrice]}>
                        {controller.formatCurrency(row.latestUnitPrice)}
                      </Text>
                      {!row.isPartner && (
                        <Text style={styles.resultAvg}>avg {controller.formatCurrency(row.averageUnitPrice)}</Text>
                      )}
                    </View>
                  </View>
                </View>
              ));
            })()}
          </DarkCard>
        ) : null}

        {/* Signal result */}
        {controller.priceSignalResult ? (
          <DarkCard radius={16} glow={controller.priceSignalResult.decision === 'BUY_NOW' ? 'green' : 'coral'}>
            <Text style={styles.cardTitle}>Buy now vs wait</Text>
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
              <Text style={styles.resultMeta}>
                {(controller.priceSignalResult.confidence * 100).toFixed(1)}% confidence
              </Text>
            </View>
            {controller.priceSignalResult.reasons.map((reason) => (
              <Text key={reason.code} style={styles.resultMeta}>· {reason.label}</Text>
            ))}
          </DarkCard>
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
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: 'Georgia',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  historyBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 100,
    gap: 10,
  },

  // Location card
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationText: {
    flex: 1,
    gap: 2,
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  locationSub: {
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 4,
  },

  // Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    height: 44,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.greenDim,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${Colors.green}40`,
  },
  chipText: {
    color: Colors.green,
    fontSize: 12,
    fontWeight: '500',
  },

  limitHint: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Radius
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surfaceHigh,
  },
  radiusPillActive: {
    backgroundColor: Colors.green,
  },
  radiusPillText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  radiusPillTextActive: {
    color: Colors.bg,
    fontWeight: '700',
  },

  // Search button
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    borderRadius: 14,
    height: 52,
    marginTop: 4,
  },
  searchBtnDisabled: {
    backgroundColor: Colors.surface,
  },
  searchBtnText: {
    color: Colors.bg,
    fontSize: 15,
    fontWeight: '700',
  },
  searchBtnTextDisabled: {
    color: Colors.textSecondary,
  },

  // Results
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
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
    fontWeight: '500',
    color: Colors.textPrimary,
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
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Partner rows
  partnerRow: {
    paddingLeft: 10,
  },
  partnerAccent: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: Colors.indigo,
  },
  resultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  officialBadge: {
    backgroundColor: `${Colors.indigo}22`,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${Colors.indigo}55`,
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.indigo,
    letterSpacing: 0.3,
  },
  partnerPrice: {
    color: Colors.indigo,
  },

  // Community divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
});
