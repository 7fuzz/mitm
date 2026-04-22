import { useState, useEffect, useRef } from 'react';
import { Traffic } from '@/types/traffic';

export function useTraffic() {
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Settings State
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [interceptMode, setInterceptMode] = useState<'both' | 'request' | 'response'>('both');
  const [ignoredMethods, setIgnoredMethods] = useState<string[]>(['OPTIONS']);

  // History Limit State
  const [isLimitEnabled, setIsLimitEnabled] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(100);

  // We use a ref so the SSE listener can access the latest limits without re-binding
  const limitRef = useRef({ enabled: isLimitEnabled, value: historyLimit });
  useEffect(() => {
    limitRef.current = { enabled: isLimitEnabled, value: historyLimit };

    // If the user turns the limit ON, instantly trim the existing array
    if (isLimitEnabled) {
      setTraffic(prev => prev.slice(0, historyLimit));
    }
  }, [isLimitEnabled, historyLimit]);

  useEffect(() => {
    const syncInitialConfig = async () => {
      try {
        const res = await fetch('/api/intercept');
        const config = await res.json();

        setIsIntercepting(config.enabled);
        setInterceptMode(config.mode);
        setIgnoredMethods(config.ignored_methods);

        if (config.queue && config.queue.length > 0) {
          setTraffic((prev) => [...config.queue, ...prev]);
        }
      } catch (e) {
        console.error("Failed to sync intercept config", e);
      }
    };

    syncInitialConfig();

    const eventSource = new EventSource('/api/traffic');
    eventSource.onmessage = (e) => {
      const data: Traffic = JSON.parse(e.data);

      setTraffic((prev) => {
        const filtered = prev.filter(t => t.id !== data.id);
        const next = [data, ...filtered];

        // NEW: Apply the Memory Limit logic
        if (limitRef.current.enabled) {
          return next.slice(0, limitRef.current.value);
        }
        return next;
      });
    };

    return () => eventSource.close();
  }, []);

  const updateConfig = async (enabled: boolean, mode: string, methods: string[]) => {
    setIsIntercepting(enabled);
    setInterceptMode(mode as any);
    setIgnoredMethods(methods);

    await fetch('/api/intercept', {
      method: 'POST',
      body: JSON.stringify({ action: 'config', data: { enabled, mode, ignored_methods: methods } }),
    });
  };

  const resumeRequest = async (id: string, modifiedData: any) => {
    await fetch('/api/intercept', {
      method: 'POST',
      body: JSON.stringify({ action: 'resume', id, data: modifiedData }),
    });
    setTraffic((prev) => prev.map((t) => (t.id === id ? { ...t, is_intercepted: false } : t)));
  };

  return {
    traffic,
    setTraffic,
    selectedReq: traffic.find((r) => r.id === selectedId) || null,
    selectedId,
    setSelectedId,
    isIntercepting,
    interceptMode,
    ignoredMethods,
    updateConfig,
    resumeRequest,
    isLimitEnabled,
    setIsLimitEnabled,
    historyLimit,
    setHistoryLimit
  };
}
