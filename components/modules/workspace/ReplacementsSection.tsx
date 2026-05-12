import { useState, useEffect, useRef, useCallback } from 'react';
import { useTraffic, ReplacementCategory, ReplacementEntry } from '@/hooks/traffic';

const CATEGORY_INFO: Record<ReplacementCategory, { label: string; description: string; color: string }> = {
  URL_REPLACEMENTS: { label: 'URL Patterns', description: 'Domain prefix replacements for environment switching', color: 'sky' },
  HEADER_REPLACEMENTS: { label: 'Header Replacements', description: 'Replace whole header values based on their KEY (e.g., Authorization)', color: 'emerald' },
  BODY_KEY_REPLACEMENTS: { label: 'Body Keys', description: 'Replace JSON keys in request body', color: 'amber' },
  URL_PARAM_REPLACEMENTS: { label: 'URL Params', description: 'Replace URL query parameter values', color: 'rose' },
  TEXT_REPLACEMENTS: { label: 'Global Text', description: 'Global string replacement across URL, Headers, and Body (e.g., xyz -> {{var}})', color: 'indigo' },
};

export function ReplacementsSection() {
  const {
    orderedReplacements, saveReplacements, deleteReplacement, isLoading: replacementsLoading,
  } = useTraffic();

  const [expandedCategory, setExpandedCategory] = useState<ReplacementCategory | null>('URL_REPLACEMENTS');
  const [localReplacements, setLocalReplacements] = useState<Record<ReplacementCategory, ReplacementEntry[]>>({
    URL_REPLACEMENTS: [],
    HEADER_REPLACEMENTS: [],
    BODY_KEY_REPLACEMENTS: [],
    URL_PARAM_REPLACEMENTS: [],
    TEXT_REPLACEMENTS: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const lastSavedRef = useRef<string>('');

  const [prevOrdered, setPrevOrdered] = useState(orderedReplacements);

  if (orderedReplacements !== prevOrdered) {
    setPrevOrdered(orderedReplacements);
    if (orderedReplacements && orderedReplacements.length > 0) {
      const converted: Record<ReplacementCategory, ReplacementEntry[]> = {
        URL_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'URL_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
        HEADER_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'HEADER_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
        BODY_KEY_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'BODY_KEY_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
        URL_PARAM_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'URL_PARAM_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
        TEXT_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'TEXT_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
      };
      setLocalReplacements(converted);
    }
  }

  useEffect(() => {
    if (orderedReplacements && orderedReplacements.length > 0) {
      const payloadString = JSON.stringify(orderedReplacements.map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })));
      lastSavedRef.current = payloadString;
      isInitialLoad.current = false;
    }
  }, [orderedReplacements]);

  const saveRef = useRef(saveReplacements);
  useEffect(() => {
    saveRef.current = saveReplacements;
  }, [saveReplacements]);

  const debouncedSave = useCallback((data: Record<ReplacementCategory, ReplacementEntry[]>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const currentItems = (Object.entries(data) as [ReplacementCategory, ReplacementEntry[]][]).flatMap(([type, entries]) => 
      entries.filter(e => e.pattern).map((e, index) => ({ ...e, type, order_index: index }))
    );
    
    const currentPayloadString = JSON.stringify(currentItems.map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })));
    if (lastSavedRef.current === currentPayloadString) return;

    const lastItems: { id: string; pattern: string; replacement: string }[] = JSON.parse(lastSavedRef.current || '[]');
    const modifiedItems = currentItems.filter(curr => {
      const prev = lastItems.find(l => l.id === curr.id);
      return !prev || prev.pattern !== curr.pattern || prev.replacement !== curr.replacement;
    });

    if (modifiedItems.length === 0) return;

    setSaveMessage('Saving...');
    debounceRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const result = await saveRef.current(modifiedItems, true);
        if (result.success) {
          lastSavedRef.current = currentPayloadString;
          setSaveMessage('Auto-saved ✓');
        } else {
          setSaveMessage('Save failed');
        }
      } catch (_e) {
        setSaveMessage('Save failed');
      }
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 2000);
    }, 800);
  }, []);

  useEffect(() => {
    if (!isInitialLoad.current) {
      debouncedSave(localReplacements);
    }
  }, [localReplacements, debouncedSave]);

  const updateEntry = (category: ReplacementCategory, index: number, field: 'pattern' | 'replacement', value: string) => {
    setLocalReplacements(prev => ({
      ...prev,
      [category]: prev[category].map((entry, i) => i === index ? { ...entry, [field]: value } : entry)
    }));
  };

  const addEntry = (category: ReplacementCategory) => {
    setLocalReplacements(prev => ({
      ...prev,
      [category]: [...prev[category], { id: crypto.randomUUID(), pattern: '', replacement: '' }]
    }));
  };

  const removeEntry = (category: ReplacementCategory, index: number) => {
    const entry = localReplacements[category][index];
    if (entry && entry.id) {
       deleteReplacement(entry.id);
    }
    setLocalReplacements(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const handleManualSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const allItems = (Object.entries(localReplacements) as [ReplacementCategory, ReplacementEntry[]][]).flatMap(([type, entries]) => 
        entries.filter(e => e.pattern).map((e, index) => ({ ...e, type, order_index: index }))
      );

      const result = await saveReplacements(allItems, true);
      if (result.success) {
        setSaveMessage('Replacements updated successfully!');
        lastSavedRef.current = JSON.stringify(allItems.map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })));
      } else {
        setSaveMessage('Error: Failed to save replacements');
      }
    } catch (_e) {
      setSaveMessage('Error: Failed to save replacements');
    }
    setIsSaving(false);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  if (replacementsLoading) {
    return <div className="text-center py-12 border border-zinc-800 border-dashed rounded bg-zinc-900/20 text-zinc-600 font-mono text-[10px] uppercase tracking-widest">Loading replacements...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-rose-500 font-bold uppercase text-[10px] tracking-widest">Workbench Replacements</h3>
            <p className="text-zinc-500 text-[10px] font-mono mt-1">Configure variable placeholders applied when sending requests from History to Workbench.</p>
          </div>
        </div>

        <div className="space-y-3">
          {(Object.keys(CATEGORY_INFO) as ReplacementCategory[]).map(category => {
            const info = CATEGORY_INFO[category];
            const isExpanded = expandedCategory === category;
            const entries = localReplacements[category] || [];

            return (
              <div key={category} className="border border-zinc-800 rounded overflow-hidden bg-zinc-900/30">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : category)}
                  className="w-full flex items-center justify-between p-4 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
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
                  <div className="p-4 border-t border-zinc-800 space-y-3 bg-zinc-950/30">
                    <p className="text-[10px] text-zinc-500 font-mono italic">{info.description}</p>
                    
                    {entries.length === 0 ? (
                      <div className="text-center py-6 border border-zinc-800 border-dashed rounded text-zinc-700 text-[10px] font-mono uppercase tracking-widest">No replacements configured</div>
                    ) : (
                      <div className="space-y-2">
                        {entries.map((entry, idx) => (
                          <div key={idx} className="flex items-center gap-2 group">
                            <input
                              type="text"
                              value={entry.pattern}
                              onChange={(e) => updateEntry(category, idx, 'pattern', e.target.value)}
                              placeholder={category === 'HEADER_REPLACEMENTS' ? "Header Key (e.g. Authorization)" : category === 'BODY_KEY_REPLACEMENTS' ? "JSON Key (e.g. user_id)" : category === 'TEXT_REPLACEMENTS' ? "Any Text (e.g. xyz)" : "Pattern (e.g. api.)"}
                              className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 rounded text-zinc-300 font-mono text-xs outline-none focus:border-rose-500/50 transition-all"
                            />
                            <span className="text-zinc-600 text-xs">→</span>
                            <input
                              type="text"
                              value={entry.replacement}
                              onChange={(e) => updateEntry(category, idx, 'replacement', e.target.value)}
                              placeholder={category === 'HEADER_REPLACEMENTS' ? "Value (e.g. Bearer {{token}})" : category === 'TEXT_REPLACEMENTS' ? "Replacement (e.g. {{something}})" : "Replacement (e.g. {{env}})"}
                              className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 rounded text-amber-400 font-mono text-xs outline-none focus:border-rose-500/50 transition-all"
                            />
                            <button
                              onClick={() => removeEntry(category, idx)}
                              className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => addEntry(category)}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-widest flex items-center gap-1 mt-2"
                    >
                      + Add Rule
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50">
          <span className={`text-[10px] font-mono uppercase tracking-widest ${saveMessage.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
            {saveMessage}
          </span>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] rounded uppercase font-black tracking-widest transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </section>
    </div>
  );
}
