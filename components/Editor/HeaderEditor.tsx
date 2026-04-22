import { useState, useEffect } from 'react';

interface Props {
  initialHeaders: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
}

export function HeaderEditor({ initialHeaders, onChange }: Props) {
  // Store headers as an array of objects to handle rendering and unique keys easily
  const [entries, setEntries] = useState<{ id: string; k: string; v: string }[]>([]);

  // Sync when a new request is selected
  useEffect(() => {
    const arr = Object.entries(initialHeaders || {}).map(([k, v]) => ({
      id: crypto.randomUUID(),
      k,
      v,
    }));
    setEntries(arr);
  }, [initialHeaders]);

  // Helper to trigger the parent's onChange with the reconstructed object
  const notifyParent = (newEntries: typeof entries) => {
    const obj: Record<string, string> = {};
    newEntries.forEach((e) => {
      if (e.k.trim() !== '') obj[e.k] = e.v;
    });
    onChange(obj);
  };

  const updateKey = (id: string, newK: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, k: newK } : e));
    setEntries(updated);
    notifyParent(updated);
  };

  const updateVal = (id: string, newV: string) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, v: newV } : e));
    setEntries(updated);
    notifyParent(updated);
  };

  const addRow = () => {
    setEntries([...entries, { id: crypto.randomUUID(), k: '', v: '' }]);
  };

  const deleteRow = (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    notifyParent(updated);
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
        {entries.map((entry) => (
          <div key={entry.id} className="flex gap-2 items-start group">
            <input
              placeholder="Header-Name"
              value={entry.k}
              onChange={(e) => updateKey(entry.id, e.target.value)}
              className="w-1/3 bg-zinc-950 border border-zinc-800 p-2 rounded text-sky-400 outline-none focus:border-sky-500 transition-colors text-[11px] font-mono"
            />
            <input
              placeholder="value..."
              value={entry.v}
              onChange={(e) => updateVal(entry.id, e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 p-2 rounded text-zinc-300 outline-none focus:border-sky-500 transition-colors text-[11px] font-mono break-all"
            />
            <button
              onClick={() => deleteRow(entry.id)}
              className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
              title="Delete Header"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addRow}
        className="mt-2 py-2 border border-dashed border-zinc-700 text-zinc-500 hover:text-sky-400 hover:border-sky-500/50 rounded text-[10px] uppercase font-bold tracking-widest transition-colors"
      >
        + Add Header
      </button>
    </div>
  );
}
