import { useState, useCallback } from 'react';
import * as Location from 'expo-location';

const DEFAULT_LAT = 5.9804;
const DEFAULT_LNG = 116.0735;

interface LocationState {
  location: { lat: number; lng: number } | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<void>;
}

export function useLocation(): LocationState {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
        setError('Location permission denied. Using default location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e) {
      setLocation({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
      setError('Could not get location. Using default.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, loading, error, requestLocation };
}
