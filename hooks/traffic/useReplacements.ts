import { useState, useEffect, useCallback } from 'react';

export interface ReplacementsData {
  URL_REPLACEMENTS: Record<string, string>;
  HEADER_VALUE_REPLACEMENTS: Record<string, string>;
  HEADER_HOST_REPLACEMENTS: Record<string, string>;
  BODY_KEY_REPLACEMENTS: Record<string, string>;
  URL_PARAM_REPLACEMENTS: Record<string, string>;
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
  HEADER_VALUE_REPLACEMENTS: {},
  HEADER_HOST_REPLACEMENTS: {},
  BODY_KEY_REPLACEMENTS: {},
  URL_PARAM_REPLACEMENTS: {}
};

export function useReplacements() {
  const [replacements, setReplacements] = useState<ReplacementsData>(DEFAULT_REPLACEMENTS);
  const [orderedReplacements, setOrderedReplacements] = useState<OrderedReplacement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReplacements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/replacements');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Handle new format with grouped and ordered
      if (data.grouped) {
        setReplacements(data.grouped);
        setOrderedReplacements(data.ordered || []);
      } else {
        setReplacements(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveReplacements = useCallback(async (data: ReplacementsData) => {
    setError(null);
    try {
      const res = await fetch('/api/replacements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      const result = await res.json();
      if (result.success) {
        setReplacements(data);
      }
      return result;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      setError(errMsg);
      return { success: false, error: errMsg };
    }
  }, []);

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

  useEffect(() => {
    fetchReplacements();
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
  };
}