import { useState, useEffect, useRef } from 'react';
import { Traffic } from '@/types/traffic';
import { RepeaterRequest } from '@/components/Repeater/RepeaterView';

export function useTraffic() {
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const [repeaterRequests, setRepeaterRequests] = useState<RepeaterRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [prefs, setPrefs] = useState({
    history: true, repeater: true, bindings: true, limits: true, intercept: true
  });

  const [isIntercepting, setIsIntercepting] = useState(false);
  const [interceptMode, setInterceptMode] = useState<'both' | 'request' | 'response'>('both');
  const [ignoredMethods, setIgnoredMethods] = useState<string[]>(['OPTIONS']);

  const [isLimitEnabled, setIsLimitEnabled] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(100);

  // === NEW: Boot Sequence Lock ===
  const [isStateLoaded, setIsStateLoaded] = useState(false);

  const limitRef = useRef({ enabled: isLimitEnabled, value: historyLimit });
  const prefsRef = useRef(prefs);

  // 1. LIMITS AUTO-SAVE (Now protected by isStateLoaded)
  useEffect(() => {
    limitRef.current = { enabled: isLimitEnabled, value: historyLimit };
    prefsRef.current = prefs;

    // ABORT: Do not save if we haven't finished loading from the DB yet!
    if (!isStateLoaded) return;

    if (prefs.limits) {
      fetch('/api/state', { method: 'POST', body: JSON.stringify({ limits: { enabled: isLimitEnabled, value: historyLimit } }) });
    }
    if (isLimitEnabled) setTraffic(prev => prev.slice(0, historyLimit));
  }, [isLimitEnabled, historyLimit, isStateLoaded]); // Add isStateLoaded to dependencies

  // 2. MASTER DATA LOADER
  useEffect(() => {
    fetch('/api/state').then(r => r.json()).then(state => {
      if (state.preferences) setPrefs(state.preferences);

      if (state.limits && state.preferences?.limits !== false) {
        setIsLimitEnabled(state.limits.enabled);
        setHistoryLimit(state.limits.value);
      }
      if (state.intercept && state.preferences?.intercept !== false) {
        setIsIntercepting(state.intercept.enabled);
        setInterceptMode(state.intercept.mode);
        setIgnoredMethods(state.intercept.ignored);
      }
      if (state.queue && state.queue.length > 0) {
        setTraffic(prev => [...state.queue, ...prev]);
      }

      // UNLOCK: The DB has loaded, auto-saves are now permitted.
      setIsStateLoaded(true);
    });

    fetch('/api/history').then(r => r.json()).then(hist => {
      if (hist && hist.length > 0) setTraffic(prev => [...prev, ...hist.reverse()]);
    });

    fetch('/api/repeater-db').then(r => r.json()).then(rep => {
      if (rep && rep.length > 0) setRepeaterRequests(rep);
    });

    const eventSource = new EventSource('/api/traffic');
    eventSource.onmessage = (e) => {
      const data: Traffic = JSON.parse(e.data);
      setTraffic((prev) => {
        const filtered = prev.filter(t => t.id !== data.id);
        const next = [data, ...filtered];
        if (limitRef.current.enabled) return next.slice(0, limitRef.current.value);
        return next;
      });
    };
    return () => eventSource.close();
  }, []);

  const updateConfig = async (enabled: boolean, mode: string, ignored: string[]) => {
    setIsIntercepting(enabled);
    setInterceptMode(mode as any);
    setIgnoredMethods(ignored);
    if (prefsRef.current.intercept) {
      fetch('/api/state', { method: 'POST', body: JSON.stringify({ intercept: { enabled, mode, ignored } }) });
    }
  };

  const updatePrefs = async (newPrefs: typeof prefs) => {
    setPrefs(newPrefs);
    await fetch('/api/state', { method: 'POST', body: JSON.stringify({ preferences: newPrefs }) });
  };

  const updateRepeater = (requests: RepeaterRequest[]) => {
    setRepeaterRequests(requests);
    if (prefsRef.current.repeater) {
      fetch('/api/repeater-db', { method: 'POST', body: JSON.stringify(requests) });
    }
  };

  const resumeRequest = async (id: string, modifiedData: any) => {
    await fetch(`http://127.0.0.1:3001/resume/${id}`, { method: 'POST', body: JSON.stringify(modifiedData) });
    setTraffic(prev => prev.map((t) => (t.id === id ? { ...t, is_intercepted: false } : t)));
  };

  return {
    traffic, setTraffic,
    repeaterRequests, setRepeaterRequests: updateRepeater,
    selectedReq: traffic.find((r) => r.id === selectedId) || null,
    selectedId, setSelectedId,
    prefs, updatePrefs,
    isIntercepting, interceptMode, ignoredMethods, updateConfig, resumeRequest,
    isLimitEnabled, setIsLimitEnabled, historyLimit, setHistoryLimit
  };
}
