import { useState, useEffect } from 'react';

interface Props {
  url: string;
  onChange?: (newUrl: string) => void;
  readOnly?: boolean;
}

export function UrlEditor({ url, onChange, readOnly = false }: Props) {
  const [mode, setMode] = useState<'raw' | 'structured'>('raw');
  const [rawUrl, setRawUrl] = useState(url);

  const [domain, setDomain] = useState('');
  const [paths, setPaths] = useState<{ id: string; v: string }[]>([]);
  const [params, setParams] = useState<{ id: string; k: string; v: string }[]>([]);
  const [fragment, setFragment] = useState('');

  // Sync state if the parent passes a completely new URL
  useEffect(() => {
    if (url === rawUrl) return;
    setRawUrl(url);
    parseUrlToStructured(url);
  }, [url]);

  const parseUrlToStructured = (targetUrl: string) => {
    try {
      const parsed = new URL(targetUrl);
      setDomain(parsed.origin);

      // Split paths and ignore empty strings caused by leading/trailing slashes
      const pathSegments = parsed.pathname
        .split('/')
        .filter(p => p !== '')
        .map(v => ({ id: crypto.randomUUID(), v }));
      setPaths(pathSegments);

      const p: { id: string; k: string; v: string }[] = [];
      parsed.searchParams.forEach((v, k) => p.push({ id: crypto.randomUUID(), k, v }));
      setParams(p);

      setFragment(parsed.hash.replace('#', ''));
    } catch {
      // Fallback if the URL is malformed
      setDomain(targetUrl);
      setPaths([]);
      setParams([]);
      setFragment('');
    }
  };

  const handleModeSwitch = (newMode: 'raw' | 'structured') => {
    if (newMode === 'structured' && mode === 'raw') {
      parseUrlToStructured(rawUrl);
    }
    setMode(newMode);
  };

  const updateStructuredUrl = (newDomain: string, newPaths: typeof paths, newParams: typeof params, newFrag: string) => {
    setDomain(newDomain);
    setPaths(newPaths);
    setParams(newParams);
    setFragment(newFrag);

    let reconstructed = newDomain.replace(/\/$/, ''); // ensure no trailing slash on domain

    if (newPaths.length > 0) {
      reconstructed += '/' + newPaths.map(p => p.v).join('/');
    } else {
      reconstructed += '/';
    }

    const query = newParams
      .filter((p) => p.k.trim() !== '')
      .map((p) => `${encodeURIComponent(p.k)}=${encodeURIComponent(p.v)}`)
      .join('&');

    if (query) reconstructed += `?${query}`;
    if (newFrag) reconstructed += `#${newFrag}`;

    setRawUrl(reconstructed);
    if (onChange) onChange(reconstructed);
  };

  const addPath = () => updateStructuredUrl(domain, [...paths, { id: crypto.randomUUID(), v: '' }], params, fragment);
  const updatePath = (id: string, v: string) => updateStructuredUrl(domain, paths.map(p => p.id === id ? { ...p, v } : p), params, fragment);
  const deletePath = (id: string) => updateStructuredUrl(domain, paths.filter(p => p.id !== id), params, fragment);

  const addParam = () => updateStructuredUrl(domain, paths, [...params, { id: crypto.randomUUID(), k: '', v: '' }], fragment);
  const updateParam = (id: string, k: string, v: string) => updateStructuredUrl(domain, paths, params.map(p => p.id === id ? { ...p, k, v } : p), fragment);
  const deleteParam = (id: string) => updateStructuredUrl(domain, paths, params.filter(p => p.id !== id), fragment);

  return (
    <div className="flex flex-col bg-zinc-900/50 border border-zinc-800 rounded overflow-hidden">

      {/* Toggle Bar */}
      <div className="bg-zinc-800/50 px-3 py-1.5 flex justify-between items-center border-b border-zinc-800">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Target_URL</span>
        <div className="flex bg-zinc-950 p-0.5 rounded items-center">
          <button
            onClick={() => handleModeSwitch('raw')}
            className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all duration-200 ${mode === 'raw' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Raw
          </button>
          <button
            onClick={() => handleModeSwitch('structured')}
            className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-all duration-200 ${mode === 'structured' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Structured
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="p-3">
        {mode === 'raw' ? (
          <input
            value={rawUrl}
            readOnly={readOnly}
            onChange={(e) => {
              setRawUrl(e.target.value);
              if (onChange) onChange(e.target.value);
            }}
            className={`w-full bg-zinc-950 border border-zinc-700 p-2 rounded outline-none focus:border-emerald-500 transition-colors text-xs font-mono ${readOnly ? 'text-zinc-400 border-dashed focus:border-zinc-700' : 'text-emerald-100'}`}
          />
        ) : (
          <div className="space-y-6">

            {/* Domain */}
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Base Domain</label>
              <input
                value={domain}
                readOnly={readOnly}
                onChange={(e) => updateStructuredUrl(e.target.value, paths, params, fragment)}
                className={`w-full bg-zinc-950 border border-zinc-700 p-2 rounded outline-none focus:border-emerald-500 transition-colors text-xs font-mono ${readOnly ? 'text-zinc-400' : 'text-emerald-100'}`}
              />
            </div>

            {/* Path Segments */}
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Path Segments</label>
              {paths.length === 0 && <div className="text-xs text-zinc-600 italic font-mono p-2 bg-zinc-950/50 rounded border border-zinc-800 border-dashed">/ (Root)</div>}

              <div className="flex flex-wrap gap-2 items-center">
                {paths.map((p, idx) => (
                  <div key={p.id} className="flex gap-2 items-center group">
                    <span className="text-zinc-600 font-black text-sm">/</span>
                    <input
                      value={p.v}
                      readOnly={readOnly}
                      onChange={(e) => updatePath(p.id, e.target.value)}
                      className={`w-32 bg-zinc-950 border border-zinc-700 p-2 rounded outline-none focus:border-emerald-500 transition-colors text-[11px] font-mono ${readOnly ? 'text-zinc-400' : 'text-fuchsia-400'}`}
                      placeholder="path"
                    />
                    {!readOnly && (
                      <button onClick={() => deletePath(p.id)} className="text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <button onClick={addPath} className="mt-2 py-1.5 w-full border border-dashed border-zinc-700 text-zinc-500 hover:text-fuchsia-400 hover:border-fuchsia-500/50 rounded text-[9px] uppercase font-bold tracking-widest transition-colors">
                  + Add Path
                </button>
              )}
            </div>

            {/* Parameters */}
            <div className="space-y-1">
              <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Query Parameters</label>
              {params.length === 0 && <div className="text-xs text-zinc-600 italic font-mono p-2 bg-zinc-950/50 rounded border border-zinc-800 border-dashed">No parameters found.</div>}

              <div className="space-y-2">
                {params.map(p => (
                  <div key={p.id} className="flex gap-2 group">
                    <input
                      value={p.k}
                      readOnly={readOnly}
                      onChange={(e) => updateParam(p.id, e.target.value, p.v)}
                      className={`w-1/3 bg-zinc-950 border border-zinc-700 p-2 rounded outline-none focus:border-emerald-500 transition-colors text-[11px] font-mono ${readOnly ? 'text-zinc-500' : 'text-sky-400'}`}
                      placeholder="Key"
                    />
                    <input
                      value={p.v}
                      readOnly={readOnly}
                      onChange={(e) => updateParam(p.id, p.k, e.target.value)}
                      className={`flex-1 bg-zinc-950 border border-zinc-700 p-2 rounded outline-none focus:border-emerald-500 transition-colors text-[11px] font-mono break-all ${readOnly ? 'text-zinc-400' : 'text-emerald-100'}`}
                      placeholder="Value"
                    />
                    {!readOnly && (
                      <button onClick={() => deleteParam(p.id)} className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded">✕</button>
                    )}
                  </div>
                ))}
              </div>
              {!readOnly && (
                <button onClick={addParam} className="mt-2 py-1.5 w-full border border-dashed border-zinc-700 text-zinc-500 hover:text-sky-400 hover:border-sky-500/50 rounded text-[9px] uppercase font-bold tracking-widest transition-colors">
                  + Add Parameter
                </button>
              )}
            </div>

            {/* Fragment */}
            {(fragment || !readOnly) && (
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Fragment (Hash)</label>
                <div className="flex gap-2 items-center">
                  <span className="text-zinc-600 font-black">#</span>
                  <input
                    value={fragment}
                    readOnly={readOnly}
                    onChange={(e) => updateStructuredUrl(domain, paths, params, e.target.value)}
                    className={`flex-1 bg-zinc-950 border border-zinc-700 p-2 rounded outline-none focus:border-emerald-500 transition-colors text-xs font-mono ${readOnly ? 'text-zinc-400' : 'text-amber-400'}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
