import { useState, useEffect, useRef } from 'react';

interface Props {
  initialBody: string;
  contentType: string;
  onChange: (newBody: string) => void;
}

export function FormEditor({ initialBody, contentType, onChange }: Props) {
  const [entries, setEntries] = useState<{ id: string; k: string; v: string }[]>([]);

  // Track the last string we pushed to the parent
  const lastEmitted = useRef<string | null>(null);

  useEffect(() => {
    // ABORT: If the incoming body is identical to what we just typed, do not recreate the UUIDs!
    if (initialBody === lastEmitted.current) return;

    const parsed: typeof entries = [];

    // Parse URL Encoded
    if (contentType.includes('x-www-form-urlencoded')) {
      const params = new URLSearchParams(initialBody);
      params.forEach((v, k) => parsed.push({ id: crypto.randomUUID(), k, v }));
    }
    // Basic Multipart parsing (Extracting text fields)
    else if (contentType.includes('multipart/form-data') && initialBody) {
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : '';

      if (boundary) {
        const parts = initialBody.split(`--${boundary}`);
        parts.forEach(part => {
          if (part.includes('name=')) {
            const nameMatch = part.match(/name="([^"]+)"/);
            const valueMatch = part.split('\r\n\r\n')[1]; // Body of the part
            if (nameMatch && valueMatch) {
              parsed.push({
                id: crypto.randomUUID(),
                k: nameMatch[1],
                v: valueMatch.replace(/\r\n$/, '') // remove trailing newline
              });
            }
          }
        });
      }
    }

    setEntries(parsed.length > 0 ? parsed : [{ id: crypto.randomUUID(), k: '', v: '' }]);
  }, [initialBody, contentType]);

  const updateBody = (newEntries: typeof entries) => {
    let newBodyString = "";

    if (contentType.includes('x-www-form-urlencoded')) {
      const params = new URLSearchParams();
      newEntries.forEach(e => { if (e.k) params.append(e.k, e.v); });
      newBodyString = params.toString();
    } else {
      newBodyString = "Form Editor modified. (Complex multipart reconstruction requires raw mode).";
    }

    // Save the string to our ref BEFORE sending it to the parent
    lastEmitted.current = newBodyString;
    onChange(newBodyString);
  };

  const updateEntry = (id: string, k: string, v: string) => {
    const updated = entries.map(e => e.id === id ? { ...e, k, v } : e);
    setEntries(updated);
    updateBody(updated);
  };

  const addRow = () => setEntries([...entries, { id: crypto.randomUUID(), k: '', v: '' }]);
  const deleteRow = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    updateBody(updated);
  };

  return (
    <div className="space-y-2">
      {entries.map(e => (
        <div key={e.id} className="flex gap-2 group items-start">
          <input
            value={e.k}
            onChange={(ev) => updateEntry(e.id, ev.target.value, e.v)}
            placeholder="Key"
            className="w-1/3 bg-zinc-950 border border-zinc-800 p-2 rounded text-sky-400 outline-none focus:border-sky-500 text-xs font-mono"
          />
          <input
            value={e.v}
            onChange={(ev) => updateEntry(e.id, e.k, ev.target.value)}
            placeholder="Value"
            className="flex-1 bg-zinc-950 border border-zinc-800 p-2 rounded text-zinc-300 outline-none focus:border-sky-500 text-xs font-mono break-all"
          />
          <button onClick={() => deleteRow(e.id)} className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded">✕</button>
        </div>
      ))}
      <button onClick={addRow} className="w-full py-2 border border-dashed border-zinc-700 text-zinc-500 hover:text-sky-400 hover:border-sky-500/50 rounded text-[10px] uppercase font-bold tracking-widest transition-colors">
        + Add Form Data
      </button>
    </div>
  );
}
