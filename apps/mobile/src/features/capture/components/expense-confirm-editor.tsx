import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocation } from '../../prices/hooks/use-location';
import { useLocationSearch } from '../../prices/hooks/use-location-search';
import type { PriceLocationSuggestion } from '../../../shared/types';
import { Colors } from '../../../theme';

const inputTheme = {
  colors: {
    onSurface: Colors.textPrimary,
    onSurfaceVariant: Colors.textSecondary,
    primary: Colors.green,
    outline: Colors.border,
  },
};

export interface ExpenseConfirmLocation {
  labelText: string;
  areaText: string;
  lat?: number;
  lng?: number;
  source: 'unset' | 'gps' | 'search';
}

interface Props {
  apiBaseUrl: string;
  merchantValue: string;
  onMerchantChange: (value: string) => void;
  locationValue: ExpenseConfirmLocation;
  onLocationChange: (value: ExpenseConfirmLocation) => void;
}

function getStatusLabel(value: ExpenseConfirmLocation): string {
  if (value.source === 'gps') {
    return 'Current';
  }
  if (value.source === 'search') {
    return 'Selected';
  }
  return 'Optional';
}

function formatCoordinatePreview(value: ExpenseConfirmLocation): string {
  if (typeof value.lat !== 'number' || typeof value.lng !== 'number') {
    return 'No exact coordinates yet';
  }

  return `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`;
}

function normalizeSuggestionToLocation(suggestion: PriceLocationSuggestion): ExpenseConfirmLocation {
  return {
    labelText: suggestion.label,
    areaText: suggestion.areaText,
    lat: suggestion.lat,
    lng: suggestion.lng,
    source: 'search',
  };
}

export function ExpenseConfirmEditor({
  apiBaseUrl,
  merchantValue,
  onMerchantChange,
  locationValue,
  onLocationChange,
}: Props) {
  const title = useMemo(
    () => locationValue.labelText.trim() || locationValue.areaText.trim() || 'Add a location',
    [locationValue.areaText, locationValue.labelText],
  );
  const coordinatePreview = useMemo(() => formatCoordinatePreview(locationValue), [locationValue]);
  const statusLabel = useMemo(() => getStatusLabel(locationValue), [locationValue]);
  const [searchQuery, setSearchQuery] = useState(locationValue.labelText || locationValue.areaText || '');
  const { loading: gpsLoading, error: gpsError, requestLocation } = useLocation();
  const {
    suggestions,
    loading: searchLoading,
    error: searchError,
    setQuery,
    query,
  } = useLocationSearch({
    apiBaseUrl,
    lat: locationValue.lat,
    lng: locationValue.lng,
    limit: 5,
  });

  useEffect(() => {
    const next = locationValue.labelText || locationValue.areaText || '';
    setSearchQuery(next);
    setQuery(next);
  }, [locationValue.areaText, locationValue.labelText, setQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setQuery(value);
  };

  const handleUseCurrentLocation = async () => {
    const detected = await requestLocation();
    if (!detected) {
      return;
    }

    onLocationChange({
      labelText: detected.labelText ?? detected.areaText ?? '',
      areaText: detected.areaText ?? '',
      lat: detected.lat,
      lng: detected.lng,
      source: 'gps',
    });
  };

  const handleSelectSuggestion = (suggestion: PriceLocationSuggestion) => {
    onLocationChange(normalizeSuggestionToLocation(suggestion));
  };

  const showSuggestions = query.trim().length >= 2 && query.trim().toLowerCase() !== title.trim().toLowerCase();
  const statusError = searchError ?? gpsError ?? null;

  return (
    <View style={styles.container}>
      <TextInput
        mode="outlined"
        dense
        label="Shop / merchant"
        value={merchantValue}
        onChangeText={onMerchantChange}
        style={styles.input}
        theme={inputTheme}
      />

      <View style={styles.locationCard}>
        <View style={styles.locationHeader}>
          <View style={styles.summaryRow}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={16} color={Colors.green} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryLabel}>Location</Text>
              <Text style={styles.summaryTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.summaryMeta} numberOfLines={1}>
                {coordinatePreview}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.gpsButton, gpsLoading && styles.gpsButtonDisabled]}
            onPress={handleUseCurrentLocation}
            disabled={gpsLoading}
            accessibilityRole="button"
            accessibilityLabel="Use current location for this expense"
            accessibilityState={{ disabled: gpsLoading, busy: gpsLoading }}
          >
            {gpsLoading ? (
              <ActivityIndicator size="small" color={Colors.bg} />
            ) : (
              <MaterialCommunityIcons name="crosshairs-gps" size={16} color={Colors.bg} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{statusLabel}</Text>
          </View>
          <Text style={styles.metaHint}>Search and select a place</Text>
        </View>

        <TextInput
          mode="outlined"
          dense
          label="Search place or area"
          value={searchQuery}
          onChangeText={handleSearchChange}
          style={styles.input}
          theme={inputTheme}
          right={
            searchLoading ? (
              <TextInput.Icon icon={() => <ActivityIndicator size="small" color={Colors.textSecondary} />} />
            ) : (
              <TextInput.Icon icon="magnify" color={Colors.textSecondary} />
            )
          }
        />

        {statusError ? <Text style={styles.errorText}>{statusError}</Text> : null}

        {showSuggestions ? (
          <View style={styles.suggestionsWrap}>
            {suggestions.length === 0 && !searchLoading && !searchError ? (
              <Text style={styles.emptyText}>No places found yet.</Text>
            ) : (
              suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={`${suggestion.providerPlaceId ?? suggestion.address}-${suggestion.lat}-${suggestion.lng}`}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectSuggestion(suggestion)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${suggestion.label}`}
                >
                  <View style={styles.suggestionIconWrap}>
                    <MaterialCommunityIcons name="map-marker-outline" size={16} color={Colors.textSecondary} />
                  </View>
                  <View style={styles.suggestionCopy}>
                    <Text style={styles.suggestionTitle} numberOfLines={1}>
                      {suggestion.label}
                    </Text>
                    <Text style={styles.suggestionMeta} numberOfLines={2}>
                      {suggestion.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginTop: 6,
  },
  input: {
    backgroundColor: Colors.surfaceHigh,
  },
  locationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 12,
    gap: 10,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.greenDim,
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  gpsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.green,
  },
  gpsButtonDisabled: {
    opacity: 0.7,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  metaHint: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  errorText: {
    color: Colors.coral,
    fontSize: 12,
  },
  suggestionsWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceHigh,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 12,
    padding: 12,
  },
  suggestionRow: {
    minHeight: 44,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  suggestionIconWrap: {
    paddingTop: 2,
  },
  suggestionCopy: {
    flex: 1,
    gap: 2,
  },
  suggestionTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
});
