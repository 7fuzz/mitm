import { useState, useEffect, useRef } from 'react';
import { Traffic } from '@/types/traffic';
import { RepeaterRequest } from '@/components/View/RepeaterView';

export interface EnvVariant {
  name: string;
  value: string;
}

export interface EnvVariable {
  id: string;
  project: string;
  key: string;
  values: EnvVariant[];
  activeIndex: number;
}

export function useTraffic() {
  const [traffic, setTraffic] = useState<Traffic[]>([]);
  const [repeaterRequests, setRepeaterRequests] = useState<RepeaterRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // === UPGRADED: Variables State ===
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [activeProject, setActiveProject] = useState('Default');

  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [prefs, setPrefs] = useState({ history: true, repeater: true, bindings: true, limits: true, intercept: true });
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [interceptMode, setInterceptMode] = useState<'both' | 'request' | 'response'>('both');
  const [ignoredMethods, setIgnoredMethods] = useState<string[]>(['OPTIONS']);
  const [isLimitEnabled, setIsLimitEnabled] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(100);

  const limitRef = useRef({ enabled: isLimitEnabled, value: historyLimit });
  const prefsRef = useRef(prefs);

  useEffect(() => {
    limitRef.current = { enabled: isLimitEnabled, value: historyLimit };
    prefsRef.current = prefs;
    if (!isStateLoaded) return;
    if (prefs.limits) fetch('/api/state', { method: 'POST', body: JSON.stringify({ limits: { enabled: isLimitEnabled, value: historyLimit } }) });
    if (isLimitEnabled) setTraffic(prev => prev.slice(0, historyLimit));
  }, [isLimitEnabled, historyLimit, isStateLoaded]);

  useEffect(() => {
    fetch('/api/state').then(r => r.json()).then(state => {
      if (state.preferences) setPrefs(state.preferences);
      if (state.limits && state.preferences?.limits !== false) { setIsLimitEnabled(state.limits.enabled); setHistoryLimit(state.limits.value); }
      if (state.intercept && state.preferences?.intercept !== false) { setIsIntercepting(state.intercept.enabled); setInterceptMode(state.intercept.mode); setIgnoredMethods(state.intercept.ignored); }
      if (state.queue && state.queue.length > 0) setTraffic(prev => [...state.queue, ...prev]);
      setIsStateLoaded(true);
    });

    fetch('/api/history').then(r => r.json()).then(hist => { if (hist && hist.length > 0) setTraffic(prev => [...prev, ...hist.reverse()]); });
    fetch('/api/repeater-db').then(r => r.json()).then(rep => { if (rep && rep.length > 0) setRepeaterRequests(rep); });

    // === NEW: Load Variables DB ===
    fetch('/api/variables').then(r => r.json()).then(v => { if (v && v.length > 0) setEnvVars(v); });

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
    setIsIntercepting(enabled); setInterceptMode(mode as any); setIgnoredMethods(ignored);
    if (prefsRef.current.intercept) fetch('/api/state', { method: 'POST', body: JSON.stringify({ intercept: { enabled, mode, ignored } }) });
  };

  const updatePrefs = async (newPrefs: typeof prefs) => {
    setPrefs(newPrefs);
    await fetch('/api/state', { method: 'POST', body: JSON.stringify({ preferences: newPrefs }) });
  };

  const updateRepeater = (requests: RepeaterRequest[]) => {
    setRepeaterRequests(requests);
    if (prefsRef.current.repeater) fetch('/api/repeater-db', { method: 'POST', body: JSON.stringify(requests) });
  };

  // === NEW: Sync Variables independent of preferences ===
  const updateEnvVars = (newVars: EnvVariable[]) => {
    setEnvVars(newVars);
    fetch('/api/variables', { method: 'POST', body: JSON.stringify(newVars) });
  };

  const resumeRequest = async (id: string, modifiedData: any) => {
    await fetch(`http://127.0.0.1:3001/resume/${id}`, { method: 'POST', body: JSON.stringify(modifiedData) });
    setTraffic(prev => prev.map((t) => (t.id === id ? { ...t, is_intercepted: false } : t)));
  };

  return {
    traffic, setTraffic,
    repeaterRequests, setRepeaterRequests: updateRepeater,
    envVars, setEnvVars: updateEnvVars, activeProject, setActiveProject, // <--- EXPORTED
    selectedReq: traffic.find((r) => r.id === selectedId) || null,
    selectedId, setSelectedId,
    prefs, updatePrefs, isIntercepting, interceptMode, ignoredMethods, updateConfig, resumeRequest,
    isLimitEnabled, setIsLimitEnabled, historyLimit, setHistoryLimit
  };
}
