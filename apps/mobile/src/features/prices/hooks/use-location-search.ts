import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, searchPriceLocations } from '../../../shared/api';
import type { PriceLocationSuggestion } from '../../../shared/types';

interface UseLocationSearchOptions {
  apiBaseUrl: string;
  lat?: number;
  lng?: number;
  limit?: number;
}

interface UseLocationSearchResult {
  query: string;
  setQuery: (value: string) => void;
  suggestions: PriceLocationSuggestion[];
  loading: boolean;
  error: string | null;
  clear: () => void;
}

function normalizeError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Could not load location suggestions.';
}

export function useLocationSearch({
  apiBaseUrl,
  lat,
  lng,
  limit = 5,
}: UseLocationSearchOptions): UseLocationSearchResult {
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PriceLocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSuggestions((current) => (current.length === 0 ? current : []));
      setLoading((current) => (current ? false : current));
      setError((current) => (current === null ? current : null));
      return;
    }

    const currentVersion = requestVersion.current + 1;
    requestVersion.current = currentVersion;
    setLoading(true);
    setError(null);

    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const token = await getTokenRef.current();
          if (!token) {
            throw new Error('Sign in again to search locations.');
          }

          const result = await searchPriceLocations(apiBaseUrl, token, {
            q: trimmedQuery,
            lat,
            lng,
            limit,
          });

          if (requestVersion.current !== currentVersion) {
            return;
          }

          setSuggestions(result.items);
        } catch (nextError) {
          if (requestVersion.current !== currentVersion) {
            return;
          }
          setSuggestions([]);
          setError(normalizeError(nextError));
        } finally {
          if (requestVersion.current === currentVersion) {
            setLoading(false);
          }
        }
      })();
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [apiBaseUrl, lat, limit, lng, query]);

  const clear = useCallback(() => {
    requestVersion.current += 1;
    setQuery('');
    setSuggestions((current) => (current.length === 0 ? current : []));
    setLoading((current) => (current ? false : current));
    setError((current) => (current === null ? current : null));
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    loading,
    error,
    clear,
  };
}
