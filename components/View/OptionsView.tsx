import { useState, useEffect, useRef, useCallback } from 'react';
import { useTraffic } from '@/hooks/traffic';

type ReplacementCategory = 'URL_REPLACEMENTS' | 'HEADER_VALUE_REPLACEMENTS' | 'HEADER_HOST_REPLACEMENTS' | 'BODY_KEY_REPLACEMENTS' | 'URL_PARAM_REPLACEMENTS';

interface ReplacementEntry {
  pattern: string;
  replacement: string;
}

const CATEGORY_INFO: Record<ReplacementCategory, { label: string; description: string; color: string }> = {
  URL_REPLACEMENTS: { label: 'URL Patterns', description: 'Domain prefix replacements for environment switching', color: 'sky' },
  HEADER_VALUE_REPLACEMENTS: { label: 'Header Values', description: 'Replace header values (e.g., Bearer tokens)', color: 'emerald' },
  HEADER_HOST_REPLACEMENTS: { label: 'Host Headers', description: 'Replace Host header values', color: 'cyan' },
  BODY_KEY_REPLACEMENTS: { label: 'Body Keys', description: 'Replace JSON keys in request body', color: 'amber' },
  URL_PARAM_REPLACEMENTS: { label: 'URL Params', description: 'Replace URL query parameter values', color: 'rose' },
};

export function OptionsView() {
  const { prefs, updatePrefs, replacements, saveReplacements, isLoading: replacementsLoading } = useTraffic();

  const [bindings, setBindings] = useState<string[]>(['8080']);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Replacements UI State
  const [expandedCategory, setExpandedCategory] = useState<ReplacementCategory | null>('URL_REPLACEMENTS');
  const [localReplacements, setLocalReplacements] = useState<Record<ReplacementCategory, ReplacementEntry[]>>({
    URL_REPLACEMENTS: [],
    HEADER_VALUE_REPLACEMENTS: [],
    HEADER_HOST_REPLACEMENTS: [],
    BODY_KEY_REPLACEMENTS: [],
    URL_PARAM_REPLACEMENTS: [],
  });
  const [isSavingReplacements, setIsSavingReplacements] = useState(false);
  const [saveReplacementsMessage, setSaveReplacementsMessage] = useState('');
  
  // Debounce ref for auto-save
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const lastSavedRef = useRef<string>('');

  // Fetch from the Master DB endpoint
  useEffect(() => {
    fetch('/api/state')
      .then(res => res.json())
      .then(state => {
        if (state.network && state.network.bindings && state.network.bindings.length > 0) {
          setBindings(state.network.bindings);
        }
      })
      .catch(e => console.error("Failed to load settings", e));
  }, []);

  // Sync local replacements when loaded from DB (skip on initial load to prevent auto-save)
  useEffect(() => {
    if (replacements && Object.keys(replacements).length > 0) {
      const converted: Record<ReplacementCategory, ReplacementEntry[]> = {
        URL_REPLACEMENTS: Object.entries(replacements.URL_REPLACEMENTS || {}).map(([pattern, replacement]) => ({ pattern, replacement: replacement as string })),
        HEADER_VALUE_REPLACEMENTS: Object.entries(replacements.HEADER_VALUE_REPLACEMENTS || {}).map(([pattern, replacement]) => ({ pattern, replacement: replacement as string })),
        HEADER_HOST_REPLACEMENTS: Object.entries(replacements.HEADER_HOST_REPLACEMENTS || {}).map(([pattern, replacement]) => ({ pattern, replacement: replacement as string })),
        BODY_KEY_REPLACEMENTS: Object.entries(replacements.BODY_KEY_REPLACEMENTS || {}).map(([pattern, replacement]) => ({ pattern, replacement: replacement as string })),
        URL_PARAM_REPLACEMENTS: Object.entries(replacements.URL_PARAM_REPLACEMENTS || {}).map(([pattern, replacement]) => ({ pattern, replacement: replacement as string })),
      };
      setLocalReplacements(converted);
      
      // Store the initial payload string to prevent unnecessary saves
      const payloadString = JSON.stringify({
        URL_REPLACEMENTS: replacements.URL_REPLACEMENTS || {},
        HEADER_VALUE_REPLACEMENTS: replacements.HEADER_VALUE_REPLACEMENTS || {},
        HEADER_HOST_REPLACEMENTS: replacements.HEADER_HOST_REPLACEMENTS || {},
        BODY_KEY_REPLACEMENTS: replacements.BODY_KEY_REPLACEMENTS || {},
        URL_PARAM_REPLACEMENTS: replacements.URL_PARAM_REPLACEMENTS || {},
      });
      lastSavedRef.current = payloadString;
      isInitialLoad.current = false;
    }
  }, [replacements]);

  // Auto-save function with debounce - using ref to avoid circular deps
  const saveReplacementsRef = useRef(saveReplacements);
  saveReplacementsRef.current = saveReplacements;

  const debouncedSave = useCallback((data: Record<ReplacementCategory, ReplacementEntry[]>) => {
    // Clear any pending save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Create payload and stringify for comparison
    const payload = {
      URL_REPLACEMENTS: Object.fromEntries(data.URL_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
      HEADER_VALUE_REPLACEMENTS: Object.fromEntries(data.HEADER_VALUE_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
      HEADER_HOST_REPLACEMENTS: Object.fromEntries(data.HEADER_HOST_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
      BODY_KEY_REPLACEMENTS: Object.fromEntries(data.BODY_KEY_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
      URL_PARAM_REPLACEMENTS: Object.fromEntries(data.URL_PARAM_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
    };
    
    const payloadString = JSON.stringify(payload);
    
    // Skip if already saved
    if (lastSavedRef.current === payloadString) {
      return;
    }

    setSaveReplacementsMessage('Saving...');

    // Debounce: wait 800ms after user stops typing
    debounceRef.current = setTimeout(async () => {
      setIsSavingReplacements(true);
      try {
        const result = await saveReplacementsRef.current(payload);
        if (result.success) {
          lastSavedRef.current = payloadString;
          setSaveReplacementsMessage('Auto-saved ✓');
        } else {
          setSaveReplacementsMessage('Save failed');
        }
      } catch (e) {
        setSaveReplacementsMessage('Save failed');
      }
      setIsSavingReplacements(false);
      
      // Clear message after 2 seconds
      setTimeout(() => setSaveReplacementsMessage(''), 2000);
    }, 800);
  }, []);

  // Trigger auto-save when localReplacements changes (but not on initial load)
  useEffect(() => {
    if (!isInitialLoad.current) {
      debouncedSave(localReplacements);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localReplacements]);

  const handleBindingChange = (index: number, value: string) => {
    const newBindings = [...bindings];
    newBindings[index] = value;
    setBindings(newBindings);
  };

  const addBinding = () => setBindings([...bindings, '']);

  const removeBinding = (index: number) => {
    if (bindings.length > 1) {
      setBindings(bindings.filter((_, i) => i !== index));
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const cleanBindings = bindings.filter(b => b.trim() !== '');

      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network: { bindings: cleanBindings } }),
      });

      const data = await res.json();
      if (data.success) {
        setSaveMessage('Network listeners updated successfully!');
        setBindings(cleanBindings.length > 0 ? cleanBindings : ['8080']);
      } else {
        setSaveMessage(`Error: Failed to save to database`);
      }
    } catch (e) {
      setSaveMessage('Failed to connect to proxy engine.');
    }
    setIsSaving(false);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const updateReplacementEntry = (category: ReplacementCategory, index: number, field: 'pattern' | 'replacement', value: string) => {
    setLocalReplacements(prev => ({
      ...prev,
      [category]: prev[category].map((entry, i) => i === index ? { ...entry, [field]: value } : entry)
    }));
  };

  const addReplacement = (category: ReplacementCategory) => {
    setLocalReplacements(prev => ({
      ...prev,
      [category]: [...prev[category], { pattern: '', replacement: '' }]
    }));
  };

  const removeReplacement = (category: ReplacementCategory, index: number) => {
    setLocalReplacements(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const handleSaveReplacements = async () => {
    setIsSavingReplacements(true);
    setSaveReplacementsMessage('');
    try {
      const data = {
        URL_REPLACEMENTS: Object.fromEntries(localReplacements.URL_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
        HEADER_VALUE_REPLACEMENTS: Object.fromEntries(localReplacements.HEADER_VALUE_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
        HEADER_HOST_REPLACEMENTS: Object.fromEntries(localReplacements.HEADER_HOST_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
        BODY_KEY_REPLACEMENTS: Object.fromEntries(localReplacements.BODY_KEY_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
        URL_PARAM_REPLACEMENTS: Object.fromEntries(localReplacements.URL_PARAM_REPLACEMENTS.filter(e => e.pattern).map(e => [e.pattern, e.replacement])),
      };

      const result = await saveReplacements(data);
      if (result.success) {
        setSaveReplacementsMessage('Replacements updated successfully!');
      } else {
        setSaveReplacementsMessage('Error: Failed to save replacements');
      }
    } catch (e) {
      setSaveReplacementsMessage('Error: Failed to save replacements');
    }
    setIsSavingReplacements(false);
    setTimeout(() => setSaveReplacementsMessage(''), 3000);
  };

  const togglePref = (key: keyof typeof prefs) => {
    updatePrefs({ ...prefs, [key]: !prefs[key] });
  };

  return (
    <div className="flex-1 flex overflow-y-auto bg-zinc-950 p-8 justify-center">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in pb-24">

        <div className="flex items-center justify-between border-b border-zinc-800 pb-6 mb-8">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">Proxy_Options</h1>
            <p className="text-zinc-500 text-xs font-mono">Configure local network bindings and install SSL certificates for HTTPS interception.</p>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <label className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-700 rounded-lg cursor-pointer hover:border-emerald-500/50 transition-all shadow-lg">
              <div className="flex flex-col items-end mr-2">
                <span className="text-[10px] text-zinc-300 font-black uppercase tracking-widest">Simple_Mode</span>
                <span className="text-[8px] text-zinc-500 font-mono">Lightweight UI</span>
              </div>
              <div className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-zinc-700">
                <input 
                  type="checkbox" 
                  checked={prefs.simpleMode} 
                  onChange={() => togglePref('simpleMode')} 
                  className="sr-only peer"
                />
                <div className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${prefs.simpleMode ? 'translate-x-5 bg-emerald-500' : 'translate-x-0 bg-zinc-400'}`}></div>
              </div>
            </label>
          </div>
        </div>

        {/* Listen Settings */}
        <div className="p-6 border border-zinc-800 rounded bg-zinc-900/30 space-y-6">
          <h2 className="text-sky-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
            <span className="opacity-50">#</span> 1. Network_Binding
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
              <span>Listen Addresses (IP:PORT)</span>
              <button onClick={addBinding} className="text-sky-400 hover:text-sky-300 transition-colors">+ Add Binding</button>
            </div>

            <div className="space-y-2">
              {bindings.map((bindStr, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <input
                    type="text"
                    value={bindStr}
                    onChange={(e) => handleBindingChange(idx, e.target.value)}
                    placeholder="e.g. 8080 (All Interfaces) OR 127.0.0.1:8080 (Localhost)"
                    className="w-full bg-zinc-950 border border-zinc-700 p-3 rounded text-amber-400 font-black outline-none focus:border-sky-500 transition-colors text-xs font-mono"
                  />
                  {bindings.length > 1 && (
                    <button
                      onClick={() => removeBinding(idx)}
                      className="p-3 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-zinc-500 text-[10px] font-mono leading-relaxed bg-zinc-950 p-3 border border-zinc-800 rounded">
              <span className="text-sky-400 font-bold">Pro-tip:</span> Type just a port (e.g. <strong className="text-zinc-300">8080</strong>) to listen on all interfaces. Type an IP and port (e.g. <strong className="text-zinc-300">127.0.0.1:8888</strong>) to restrict access to a specific network.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
            <span className={`text-xs font-mono ${saveMessage.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {saveMessage}
            </span>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white text-[10px] rounded uppercase font-black tracking-widest transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Rebinding...' : 'Apply & Restart'}
            </button>
          </div>
        </div>

        {/* Certificate Settings */}
        <div className="p-6 border border-zinc-800 rounded bg-zinc-900/30 space-y-6">
          <h2 className="text-emerald-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
            <span className="opacity-50">#</span> 2. SSL_Certificates
          </h2>

          <div className="space-y-4">
            <p className="text-zinc-400 text-xs font-mono leading-relaxed">
              To intercept HTTPS traffic on your physical devices (iOS/Android) or external browsers, you must install and trust the root Certificate Authority (CA) generated by this proxy.
            </p>

            <div className="flex flex-col gap-3 bg-zinc-950 p-4 border border-zinc-800 border-dashed rounded">
              <h4 className="text-zinc-300 text-[10px] font-bold uppercase tracking-widest">Setup Instructions:</h4>
              <ol className="list-decimal list-inside text-xs text-zinc-500 font-mono space-y-2">
                <li>Connect your device to the same Wi-Fi network.</li>
                <li>Configure your device's proxy to point to your <strong className="text-sky-400">IP address</strong>.</li>
                <li>Download the certificate below and transfer it to the device.</li>
                <li>Go to device settings and explicitly <strong className="text-emerald-400">Trust the Root Certificate</strong>.</li>
              </ol>
            </div>

            <a
              href="/api/cert"
              download="mitmproxy-ca-cert.pem"
              className="inline-flex items-center justify-center w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs rounded uppercase font-black tracking-widest transition-colors"
            >
              Download Root CA (.pem)
            </a>
          </div>
        </div>

        {/* Data Persistence */}
        <div className="p-6 border border-zinc-800 rounded bg-zinc-900/30 space-y-6">
          <h2 className="text-purple-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
            <span className="opacity-50">#</span> 3. Master_Database
          </h2>

          <p className="text-zinc-400 text-xs font-mono leading-relaxed mb-4">
            Select which configuration elements are permanently saved to the local SQLite database. Disabling a toggle will stop future saves, but will not erase existing data.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded cursor-pointer hover:border-purple-500/50 transition-colors">
              <input type="checkbox" checked={prefs.history} onChange={() => togglePref('history')} className="accent-purple-500 w-4 h-4" />
              <div className="flex flex-col">
                <span className="text-xs text-zinc-300 font-bold uppercase tracking-widest">HTTP History</span>
                <span className="text-[10px] text-zinc-600 font-mono">Logs traffic to DB</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded cursor-pointer hover:border-purple-500/50 transition-colors">
              <input type="checkbox" checked={prefs.repeater} onChange={() => togglePref('repeater')} className="accent-purple-500 w-4 h-4" />
              <div className="flex flex-col">
                <span className="text-xs text-zinc-300 font-bold uppercase tracking-widest">Workbench Workspace</span>
                <span className="text-[10px] text-zinc-600 font-mono">Saves tabs & payloads</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded cursor-pointer hover:border-purple-500/50 transition-colors">
              <input type="checkbox" checked={prefs.bindings} onChange={() => togglePref('bindings')} className="accent-purple-500 w-4 h-4" />
              <div className="flex flex-col">
                <span className="text-xs text-zinc-300 font-bold uppercase tracking-widest">Network Bindings</span>
                <span className="text-[10px] text-zinc-600 font-mono">Saves IP & Ports</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded cursor-pointer hover:border-purple-500/50 transition-colors">
              <input type="checkbox" checked={prefs.intercept} onChange={() => togglePref('intercept')} className="accent-purple-500 w-4 h-4" />
              <div className="flex flex-col">
                <span className="text-xs text-zinc-300 font-bold uppercase tracking-widest">Intercept Config</span>
                <span className="text-[10px] text-zinc-600 font-mono">Saves rules & state</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded cursor-pointer hover:border-purple-500/50 transition-colors">
              <input type="checkbox" checked={prefs.limits} onChange={() => togglePref('limits')} className="accent-purple-500 w-4 h-4" />
              <div className="flex flex-col">
                <span className="text-xs text-zinc-300 font-bold uppercase tracking-widest">Memory Limits</span>
                <span className="text-[10px] text-zinc-600 font-mono">Saves max history size</span>
              </div>
            </label>
          </div>
        </div>

        {/* Replacements Editor - New UI */}
        <div className="p-6 border border-zinc-800 rounded bg-zinc-900/30 space-y-6">
          <h2 className="text-amber-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2">
            <span className="opacity-50">#</span> 4. Repeater_Replacements
          </h2>

          <p className="text-zinc-400 text-xs font-mono leading-relaxed mb-4">
            Configure variable placeholders applied when sending requests from History to Repeater. Expand categories to manage replacements.
          </p>

          {replacementsLoading ? (
            <div className="text-center py-8 text-zinc-500 text-xs font-mono">Loading replacements...</div>
          ) : (
            <div className="space-y-3">
              {(Object.keys(CATEGORY_INFO) as ReplacementCategory[]).map(category => {
                const info = CATEGORY_INFO[category];
                const isExpanded = expandedCategory === category;
                const entries = localReplacements[category] || [];

                return (
                  <div key={category} className="border border-zinc-800 rounded overflow-hidden">
                    <button
                      onClick={() => setExpandedCategory(isExpanded ? null : category)}
                      className="w-full flex items-center justify-between p-4 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full bg-${info.color}-500`} />
                        <div className="text-left">
                          <div className="text-xs text-zinc-300 font-bold uppercase tracking-widest">{info.label}</div>
                          <div className="text-[10px] text-zinc-600 font-mono">{entries.length} rule{entries.length !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <span className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {isExpanded && (
                      <div className="p-4 border-t border-zinc-800 space-y-3">
                        <p className="text-[10px] text-zinc-500 font-mono">{info.description}</p>
                        
                        {entries.length === 0 ? (
                          <div className="text-center py-4 text-zinc-600 text-[10px] font-mono">No replacements configured</div>
                        ) : (
                          <div className="space-y-2">
                            {entries.map((entry, idx) => (
                              <div key={idx} className="flex items-center gap-2 group">
                                <input
                                  type="text"
                                  value={entry.pattern}
                                  onChange={(e) => updateReplacementEntry(category, idx, 'pattern', e.target.value)}
                                  placeholder="Pattern (e.g., api.)"
                                  className="flex-1 bg-zinc-950 border border-zinc-700 px-3 py-2 rounded text-zinc-300 font-mono text-xs outline-none focus:border-amber-500/50"
                                />
                                <span className="text-zinc-600 text-xs">→</span>
                                <input
                                  type="text"
                                  value={entry.replacement}
                                  onChange={(e) => updateReplacementEntry(category, idx, 'replacement', e.target.value)}
                                  placeholder="Replacement (e.g., api{{env}}.)"
                                  className="flex-1 bg-zinc-950 border border-zinc-700 px-3 py-2 rounded text-amber-400 font-mono text-xs outline-none focus:border-amber-500/50"
                                />
                                <button
                                  onClick={() => removeReplacement(category, idx)}
                                  className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => addReplacement(category)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-mono flex items-center gap-1"
                        >
                          + Add Rule
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
            <span className={`text-xs font-mono ${saveReplacementsMessage.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {saveReplacementsMessage}
            </span>
            <button
              onClick={handleSaveReplacements}
              disabled={isSavingReplacements}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 text-[10px] rounded uppercase font-black tracking-widest transition-colors disabled:opacity-50"
            >
              {isSavingReplacements ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
