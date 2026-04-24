import { useState, useEffect } from 'react';
import { JsonEditor } from './JsonEditor';
import { FormEditor } from './FormEditor';

interface Props {
  body: string;
  headers: Record<string, string>;
  onChange: (newBody: string) => void;
}

export function BodyEditor({ body, headers, onChange }: Props) {
  const [mode, setMode] = useState<'raw' | 'json' | 'form'>('raw');

  const contentTypeKey = Object.keys(headers).find(k => k.toLowerCase() === 'content-type');
  const contentType = contentTypeKey ? headers[contentTypeKey].toLowerCase() : '';

  useEffect(() => {
    if (contentType.includes('application/json')) setMode('json');
    else if (contentType.includes('form-urlencoded') || contentType.includes('multipart/form-data')) setMode('form');
    else setMode('raw');
  }, [contentType]);

  return (
    // UPGRADED: Added resize-y to root container
    <div className="flex flex-col h-full bg-zinc-900/50 border border-zinc-800 rounded resize-y overflow-hidden min-h-[150px]">

      <div className="bg-zinc-800/50 px-3 py-1.5 flex justify-between items-center border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Body Format:</span>
          <div className="flex bg-zinc-950 p-0.5 rounded items-center">
            {['raw', 'json', 'form'].map((m) => (
              <button key={m} onClick={() => setMode(m as any)} className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all duration-200 ${mode === m ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {contentType && <span className="text-[9px] text-emerald-500/70 font-mono italic truncate max-w-[200px]">Detected: {contentType.split(';')[0]}</span>}
      </div>

      {/* UPGRADED: Added min-h-0 to trap flex scrolling */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {mode === 'raw' && (
          <textarea
            value={body}
            onChange={(e) => onChange(e.target.value)}
            spellCheck="false"
            // UPGRADED: Removed resize-none, added resize-y and lower min-h
            className="w-full h-full min-h-[100px] bg-transparent text-zinc-300 outline-none focus:border-amber-500 transition-colors text-[11px] font-mono leading-relaxed resize-y"
          />
        )}
        {mode === 'json' && <JsonEditor initialBody={body} onChange={onChange} />}
        {mode === 'form' && <FormEditor initialBody={body} contentType={contentType} onChange={onChange} />}
      </div>
    </div>
  );
}



// ... [Keep EditableKey, JsonNode, and JsonEditor exactly the same] ...
