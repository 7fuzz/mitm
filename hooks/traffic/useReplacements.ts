import { useState, useEffect, useCallback } from 'react';

export interface ReplacementsData {
  URL_REPLACEMENTS: Record<string, string>;
  HEADER_REPLACEMENTS: Record<string, string>;
  BODY_KEY_REPLACEMENTS: Record<string, string>;
  URL_PARAM_REPLACEMENTS: Record<string, string>;
  TEXT_REPLACEMENTS: Record<string, string>;
}

export interface OrderedReplacement {
  id: string;
  type: string;
  pattern: string;
  replacement: string;
  order_index: number;
}

const DEFAULT_REPLACEMENTS: ReplacementsData = {
  URL_REPLACEMENTS: {},
  HEADER_REPLACEMENTS: {},
  BODY_KEY_REPLACEMENTS: {},
  URL_PARAM_REPLACEMENTS: {},
  TEXT_REPLACEMENTS: {}
};

// Helper function for nested JSON body transformation
function transformObjectHelper(obj: unknown, bodyReplacements: Record<string, string>): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => transformObjectHelper(item, bodyReplacements));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (bodyReplacements[lowerKey]) {
      result[key] = bodyReplacements[lowerKey];
    } else if (typeof value === 'object') {
      result[key] = transformObjectHelper(value, bodyReplacements);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function useReplacements() {
  const [replacements, setReplacements] = useState<ReplacementsData>(DEFAULT_REPLACEMENTS);
  const [orderedReplacements, setOrderedReplacements] = useState<OrderedReplacement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReplacements = useCallback(async () => {
    try {
      const res = await fetch('/api/replacements');
      setError(null);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Handle new format with grouped and ordered
      if (data.grouped) {
        const grouped = data.grouped as ReplacementsData & { HEADER_VALUE_REPLACEMENTS?: Record<string, string> };
        // Migration: Merge legacy header replacements if they exist
        const unifiedHeaders = {
          ...(grouped.HEADER_VALUE_REPLACEMENTS || {}),
          ...(grouped.HEADER_REPLACEMENTS || {})
        };
        
        setReplacements({
          ...grouped,
          HEADER_REPLACEMENTS: unifiedHeaders
        });
        setOrderedReplacements(data.ordered || []);
      } else {
        setReplacements(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveReplacements = useCallback(async (data: ReplacementsData | OrderedReplacement[], incremental = false) => {
    setError(null);
    try {
      const res = await fetch(`/api/replacements${incremental ? '?incremental=true' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      const result = await res.json();
      if (result.success) {
        if (incremental) {
          await fetchReplacements();
        } else {
          setReplacements(data as ReplacementsData);
        }
      }
      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  }, [fetchReplacements]);

  const updateOrder = useCallback(async (items: OrderedReplacement[]) => {
    setError(null);
    try {
      const res = await fetch('/api/replacements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error('Failed to update order');
      const result = await res.json();
      if (result.success) {
        setOrderedReplacements(items);
      }
      return result;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  }, []);

  const deleteReplacement = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch('/api/replacements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchReplacements();
      return { success: true };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  }, [fetchReplacements]);

  // Apply functions
  const applyUrlReplacements = useCallback((url: string): string => {
    try {
      let result = url;
      for (const [pattern, replacement] of Object.entries(replacements.TEXT_REPLACEMENTS)) {
        result = result.replaceAll(pattern, replacement);
      }

      const parsed = new URL(result);
      let hostname = parsed.hostname;
      for (const [pattern, replacement] of Object.entries(replacements.URL_REPLACEMENTS)) {
        if (hostname.includes(pattern)) {
          hostname = hostname.replace(pattern, replacement);
        }
      }
      parsed.hostname = hostname;

      const searchParams = parsed.search;
      let newSearch = searchParams;
      for (const [key, value] of Object.entries(replacements.URL_PARAM_REPLACEMENTS)) {
        const regex = new RegExp(`([?&]${key}=)([^&]*)`, 'g');
        newSearch = newSearch.replace(regex, `$1${value}`);
      }
      parsed.search = newSearch;

      return parsed.toString();
    } catch {
      let result = url;
      for (const [pattern, replacement] of Object.entries(replacements.TEXT_REPLACEMENTS)) {
        result = result.replaceAll(pattern, replacement);
      }
      for (const [pattern, replacement] of Object.entries(replacements.URL_REPLACEMENTS)) {
        if (result.includes(pattern)) {
          result = result.replace(pattern, replacement);
        }
      }
      return result;
    }
  }, [replacements]);

  const applyHeaderReplacements = useCallback((headers: Record<string, string>): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      let newValue = value;
      const lowerKey = key.toLowerCase();
      
      for (const [pattern, replacement] of Object.entries(replacements.HEADER_REPLACEMENTS)) {
        if (lowerKey === pattern.toLowerCase()) {
           newValue = replacement;
           break;
        }
      }

      for (const [pattern, replacement] of Object.entries(replacements.TEXT_REPLACEMENTS)) {
        newValue = newValue.replaceAll(pattern, replacement);
      }
      
      result[key] = newValue;
    }
    return result;
  }, [replacements]);

  const applyBodyReplacements = useCallback((body: string): string => {
    try {
      let transformedBody = body;
      for (const [pattern, replacement] of Object.entries(replacements.TEXT_REPLACEMENTS)) {
        transformedBody = transformedBody.replaceAll(pattern, replacement);
      }

      const parsed = JSON.parse(transformedBody);
      const transformed = transformObjectHelper(parsed, replacements.BODY_KEY_REPLACEMENTS);
      return JSON.stringify(transformed, null, 2);
    } catch {
      let result = body;
      for (const [pattern, replacement] of Object.entries(replacements.TEXT_REPLACEMENTS)) {
        result = result.replaceAll(pattern, replacement);
      }
      return result;
    }
  }, [replacements]);

  useEffect(() => {
    Promise.resolve().then(() => fetchReplacements());
  }, [fetchReplacements]);

  return {
    replacements,
    orderedReplacements,
    isLoading,
    error,
    fetchReplacements,
    saveReplacements,
    updateOrder,
    deleteReplacement,
    applyUrlReplacements,
    applyHeaderReplacements,
    applyBodyReplacements,
  };
}
