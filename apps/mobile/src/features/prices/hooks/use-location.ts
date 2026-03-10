import { useState, useCallback } from 'react';
import * as Location from 'expo-location';

export interface SelectedGpsLocation {
  lat: number;
  lng: number;
  labelText?: string;
  areaText?: string;
}

interface LocationState {
  location: SelectedGpsLocation | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<SelectedGpsLocation | null>;
}

function buildAreaText(value: Location.LocationGeocodedAddress | null | undefined): string {
  if (!value) {
    return '';
  }

  const preferred = [
    value.city,
    value.subregion,
    value.region,
    value.district,
    value.country,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);

  return preferred[0] ?? '';
}

function buildLabelText(value: Location.LocationGeocodedAddress | null | undefined): string {
  if (!value) {
    return '';
  }

  const parts = [value.name, value.street, value.district, value.city]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);

  return Array.from(new Set(parts)).slice(0, 2).join(', ');
}

export function useLocation(): LocationState {
  const [location, setLocation] = useState<SelectedGpsLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation(null);
        setError('Location permission denied. Enter location manually.');
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextLocation: SelectedGpsLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };

      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const labelText = buildLabelText(address);
        const areaText = buildAreaText(address);
        if (labelText) {
          nextLocation.labelText = labelText;
        }
        if (areaText) {
          nextLocation.areaText = areaText;
        }
      } catch {
        // Reverse geocoding is best-effort; coordinates are still useful without it.
      }

      setLocation(nextLocation);
      return nextLocation;
    } catch (e) {
      setLocation(null);
      setError('Could not get current location. Enter location manually.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, loading, error, requestLocation };
}
