import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Traffic } from '@/types/traffic';

// Import our segmented hooks
import { useSelection } from './useSelection';
import { useVariables } from './useVariables';
import { useConfig } from './useConfig';
import { useRepeater } from './useRepeater';
import { useTrafficLog } from './useTrafficLog';

// Re-export types so other components can still import them from '@/hooks/useTraffic'
export * from './types';

// ============================================================================
// MAIN ROOT HOOK
// ============================================================================
function useTrafficState() {
  const selections = useSelection();
  const variables = useVariables();
  const config = useConfig();
  const repeater = useRepeater(config.prefsRef);
  const trafficData = useTrafficLog();

  const [isStateLoaded, setIsStateLoaded] = useState(false);

  useEffect(() => {
    config.limitRef.current = { enabled: config.isLimitEnabled, value: config.historyLimit };
    config.prefsRef.current = config.prefs;

    if (!isStateLoaded) return;

    if (config.prefs.limits) {
      fetch('/api/state', {
        method: 'POST',
        body: JSON.stringify({ limits: { enabled: config.isLimitEnabled, value: config.historyLimit } })
      }).catch(() => { }); // Fail silently if network drops
    }

    if (config.isLimitEnabled) {
      trafficData.setTraffic(prev => {
        if (prev.length > config.historyLimit) {
          return prev.slice(0, config.historyLimit);
        }
        return prev;
      });
    }
  }, [config.isLimitEnabled, config.historyLimit, isStateLoaded]);

  useEffect(() => {
    fetch('/api/state').then(r => r.json()).then(state => {
      if (state.preferences) config.initConfig.setPrefs(state.preferences);
      if (state.limits && state.preferences?.limits !== false) {
        config.initConfig.setIsLimitEnabled(state.limits.enabled);
        config.initConfig.setHistoryLimit(state.limits.value);
      }
      if (state.intercept && state.preferences?.intercept !== false) {
        config.initConfig.setIsIntercepting(state.intercept.enabled);
        config.initConfig.setInterceptMode(state.intercept.mode);
        config.initConfig.setIgnoredMethods(state.intercept.ignored);
      }
      if (state.ui_layout) config.initConfig.setUiLayout(state.ui_layout);
      if (state.queue && state.queue.length > 0) trafficData.setTraffic(prev => [...state.queue, ...prev]);
      setIsStateLoaded(true);
    });

    fetch('/api/history').then(r => r.json()).then(hist => {
      if (hist && hist.length > 0) trafficData.setTraffic(prev => [...prev, ...hist.reverse()]);
    });

    fetch('/api/repeater-db').then(r => r.json()).then(rep => {
      if (rep && rep.length > 0) repeater._setRawRepeater(rep);
    });

    fetch('/api/variables').then(r => r.json()).then(data => {
      if (data.variables) variables.setVariables(data.variables, data.activeProject);
    });

    const eventSource = new EventSource('/api/traffic');
    eventSource.onmessage = (e) => {
      const data: Traffic = JSON.parse(e.data);
      trafficData.setTraffic((prev) => {
        const filtered = prev.filter(t => t.id !== data.id);
        const next = [data, ...filtered];
        if (config.limitRef.current.enabled) return next.slice(0, config.limitRef.current.value);
        return next;
      });
    };

    return () => eventSource.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...selections,
    ...variables,
    ...(({ initConfig, prefsRef, limitRef, ...rest }) => rest)(config),
    ...(({ _setRawRepeater, ...rest }) => rest)(repeater),
    ...trafficData,
    selectedReq: trafficData.traffic.find((r) => r.id === selections.selectedId) || null,
  };
}

// ============================================================================
// CONTEXT & PROVIDERS
// ============================================================================
type TrafficContextType = ReturnType<typeof useTrafficState>;
const TrafficContext = createContext<TrafficContextType | null>(null);

export function TrafficProvider({ children }: { children: ReactNode }) {
  const state = useTrafficState();
  return (
    <TrafficContext.Provider value={state} >
      {children}
    </TrafficContext.Provider>
  );
}

export function useTraffic() {
  const context = useContext(TrafficContext);
  if (!context) {
    throw new Error("useTraffic must be used within a TrafficProvider");
  }
  return context;
}
