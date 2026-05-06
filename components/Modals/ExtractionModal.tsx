import { useState, useEffect } from 'react';
import { GlobalVariable } from '@/hooks/traffic';

interface ExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: Record<string, string>) => void;
  initialRules: Record<string, string>;
  availableVariables: GlobalVariable[];
}

export function ExtractionModal({ isOpen, onClose, onSave, initialRules, availableVariables }: ExtractionModalProps) {
  const [rules, setRules] = useState<{ id: string; varName: string; path: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      const initial = Object.entries(initialRules).map(([varName, path]) => ({
        id: crypto.randomUUID(),
        varName,
        path
      }));
      setRules(initial.length > 0 ? initial : []);
    }
  }, [isOpen, initialRules]);

  if (!isOpen) return null;

  const addRule = () => {
    setRules([...rules, { id: crypto.randomUUID(), varName: '', path: '' }]);
  };

  const updateRule = (id: string, field: 'varName' | 'path', value: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleSave = () => {
    const finalRules: Record<string, string> = {};
    rules.forEach(r => {
      if (r.varName.trim() && r.path.trim()) {
        finalRules[r.varName.trim()] = r.path.trim();
      }
    });
    onSave(finalRules);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl shadow-black w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
          <h3 className="text-amber-500 font-bold uppercase tracking-widest text-[11px]">Extraction Rules Configuration</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">✕</button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
            Define rules to automatically extract data from JSON responses into your environment variables. 
            Paths use dot notation (e.g., <span className="text-zinc-300 font-bold">data.user.id</span>).
          </p>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
            {rules.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-zinc-900 rounded-lg">
                <span className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">No rules defined yet</span>
              </div>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="flex items-center gap-2 group">
                  <div className="flex-1">
                    <select
                      value={rule.varName}
                      onChange={(e) => updateRule(rule.id, 'varName', e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-emerald-400 text-xs font-mono outline-none focus:border-amber-500/50 transition-colors"
                    >
                      <option value="">Select Variable...</option>
                      {availableVariables.map(v => (
                        <option key={v.id} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-zinc-700 text-xs">←</span>
                  <div className="flex-[1.5]">
                    <input
                      type="text"
                      value={rule.path}
                      onChange={(e) => updateRule(rule.id, 'path', e.target.value)}
                      placeholder="Response Path (e.g. result.token)"
                      className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded text-zinc-300 text-xs font-mono outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            onClick={addRule}
            className="w-full py-2 border border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 text-zinc-500 hover:text-zinc-300 text-[10px] font-bold uppercase tracking-widest rounded transition-all mt-2"
          >
            + Add New Extraction Rule
          </button>
        </div>

        <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-zinc-950 text-[10px] font-bold uppercase tracking-widest rounded shadow-lg shadow-amber-900/20 transition-all"
          >
            Apply Rules
          </button>
        </div>
      </div>
    </div>
  );
}
