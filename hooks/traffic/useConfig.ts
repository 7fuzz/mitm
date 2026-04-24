import { useState, useRef } from 'react';
import { UILayout } from './types';

export function useConfig() {
  const [prefs, setPrefs] = useState({ history: true, repeater: true, bindings: true, limits: true, intercept: true });
  const [isIntercepting, setIsIntercepting] = useState(false);
  const [interceptMode, setInterceptMode] = useState<'both' | 'request' | 'response'>('both');
  const [ignoredMethods, setIgnoredMethods] = useState<string[]>(['OPTIONS']);
  const [isLimitEnabled, setIsLimitEnabled] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(100);
  const [uiLayout, setUiLayout] = useState<UILayout>({ isListOpen: true, listLayout: 'sidebar', splitMode: 'vertical' });

  const limitRef = useRef({ enabled: isLimitEnabled, value: historyLimit });
  const prefsRef = useRef(prefs);

  const updateConfig = async (enabled: boolean, mode: string, ignored: string[]) => {
    setIsIntercepting(enabled); setInterceptMode(mode as any); setIgnoredMethods(ignored);
    if (prefsRef.current.intercept) fetch('/api/state', { method: 'POST', body: JSON.stringify({ intercept: { enabled, mode, ignored } }) });
  };

  const updatePrefs = async (newPrefs: typeof prefs) => {
    setPrefs(newPrefs);
    await fetch('/api/state', { method: 'POST', body: JSON.stringify({ preferences: newPrefs }) });
  };

  const updateUILayout = (updates: Partial<UILayout>) => {
    const next = { ...uiLayout, ...updates };
    setUiLayout(next);
    fetch('/api/state', { method: 'POST', body: JSON.stringify({ ui_layout: next }) });
  };

  const initConfig = { setPrefs, setIsLimitEnabled, setHistoryLimit, setIsIntercepting, setInterceptMode, setIgnoredMethods, setUiLayout };

  return {
    prefs, updatePrefs, prefsRef,
    isIntercepting, interceptMode, ignoredMethods, updateConfig,
    isLimitEnabled, setIsLimitEnabled, historyLimit, setHistoryLimit, limitRef,
    uiLayout, updateUILayout, initConfig
  };
}
