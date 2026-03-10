import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkCard } from '../../../components/ui/dark-card';
import { TEST_IDS } from '../../../core/testing/test-ids';
import type { PriceQueryLocation } from '../../../core/state/clariFi-controller';
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

const RADIUS_OPTIONS = [5, 10, 15, 25];

interface Props {
  value: PriceQueryLocation;
  gpsLoading: boolean;
  gpsError?: string | null;
  searchQuery: string;
  searchLoading: boolean;
  searchError?: string | null;
  suggestions: PriceLocationSuggestion[];
  onSearchQueryChange: (value: string) => void;
  onSelectSuggestion: (value: PriceLocationSuggestion) => void;
  onUseCurrentLocation: () => Promise<void>;
  onRadiusChange: (radiusKm: number) => void;
}

function formatCoordinatePreview(value: PriceQueryLocation): string {
  if (!value.latText.trim() || !value.lngText.trim()) {
    return 'Coordinates pending';
  }

  return `${value.latText.trim()}, ${value.lngText.trim()}`;
}

function getStatusLabel(value: PriceQueryLocation): string {
  if (value.source === 'gps') {
    return 'Current';
  }
  if (value.source === 'search') {
    return 'Selected';
  }
  return 'Unset';
}

export function PriceLocationSelector({
  value,
  gpsLoading,
  gpsError,
  searchQuery,
  searchLoading,
  searchError,
  suggestions,
  onSearchQueryChange,
  onSelectSuggestion,
  onUseCurrentLocation,
  onRadiusChange,
}: Props) {
  const title = value.labelText.trim() || value.areaText.trim() || 'Choose a location';
  const coordinatePreview = formatCoordinatePreview(value);
  const statusLabel = getStatusLabel(value);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedSelected = title.trim().toLowerCase();
  const showSuggestions = normalizedQuery.length >= 2 && normalizedQuery !== normalizedSelected;
  const statusError = searchError ?? gpsError ?? null;

  return (
    <DarkCard radius={16} style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.summaryRow}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={Colors.green} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.title}>Search area</Text>
            <Text style={styles.selectedText} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.coordinateText} numberOfLines={1}>
              {coordinatePreview}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.gpsButton, gpsLoading && styles.gpsButtonDisabled]}
          onPress={onUseCurrentLocation}
          disabled={gpsLoading}
          testID={TEST_IDS.prices.locationRefreshButton}
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
        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((radiusKm) => {
            const active = value.radiusKmText.trim() === String(radiusKm);
            return (
              <TouchableOpacity
                key={radiusKm}
                style={[styles.radiusChip, active && styles.radiusChipActive]}
                onPress={() => onRadiusChange(radiusKm)}
              >
                <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>{radiusKm} km</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <TextInput
        label="Search place or area"
        value={searchQuery}
        onChangeText={onSearchQueryChange}
        mode="outlined"
        dense
        style={styles.searchInput}
        theme={inputTheme}
        testID={TEST_IDS.prices.locationAreaInput}
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
                onPress={() => onSelectSuggestion(suggestion)}
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
                {typeof suggestion.distanceKm === 'number' ? (
                  <Text style={styles.suggestionDistance}>{suggestion.distanceKm.toFixed(1)} km</Text>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}
    </DarkCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.greenDim,
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  coordinateText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  gpsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    gap: 10,
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
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    flex: 1,
  },
  radiusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radiusChipActive: {
    backgroundColor: Colors.indigoDim,
    borderColor: Colors.indigo,
  },
  radiusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  radiusChipTextActive: {
    color: Colors.textPrimary,
  },
  searchInput: {
    backgroundColor: 'transparent',
  },
  suggestionsWrap: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  suggestionIconWrap: {
    width: 28,
    alignItems: 'center',
  },
  suggestionCopy: {
    flex: 1,
    gap: 2,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  suggestionMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  suggestionDistance: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 12,
    color: Colors.coral,
  },
});
