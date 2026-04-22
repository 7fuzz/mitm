import { useState, useEffect } from 'react';
import { Traffic } from '@/types/traffic';
import { TrafficList } from '../Sidebar/TrafficList';
import { HeaderEditor } from './HeaderEditor';
import { BodyEditor } from './BodyEditor';
import { UrlEditor } from '../ui/UrlEditor';
import { InterceptTimer } from '../ui/InterceptTimer';

interface Props {
  traffic: Traffic[];
  isIntercepting: boolean;
  interceptMode: string;
  ignoredMethods: string[];
  updateConfig: (enabled: boolean, mode: string, methods: string[]) => void;
  onResume: (id: string, modifiedData: any) => void;
}

export function InterceptView({ traffic, isIntercepting, interceptMode, ignoredMethods, updateConfig, onResume }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Editable State
  const [editMethod, setEditMethod] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editStatusCode, setEditStatusCode] = useState(200);
  const [editHeaders, setEditHeaders] = useState<Record<string, string>>({});
  const [editBody, setEditBody] = useState('');

  const pendingQueue = traffic.filter((t) => t.is_intercepted);
  const currentReq = pendingQueue.find((t) => t.id === selectedId) || pendingQueue[0];
  const isRes = currentReq?.phase === 'response';

  useEffect(() => {
    if (currentReq) {
      if (currentReq.phase === 'response') {
        setEditStatusCode(currentReq.status_code || 200);
        setEditHeaders(currentReq.response_headers || {});
      } else {
        setEditMethod(currentReq.method);
        setEditUrl(currentReq.url);
        setEditHeaders(currentReq.request_headers || {});
      }

      const targetBody = currentReq.phase === 'response' ? currentReq.response_body : currentReq.request_body;
      let formattedBody = targetBody || '';
      try {
        if (formattedBody.trim()) {
          const parsed = JSON.parse(formattedBody);
          formattedBody = JSON.stringify(parsed, null, 2);
        }
      } catch (e) {
        // Fallback to raw
      }
      setEditBody(formattedBody);
    }
  }, [currentReq]);

  const handleForward = () => {
    if (currentReq) {
      if (currentReq.phase === 'response') {
        onResume(currentReq.id, { status_code: editStatusCode, headers: editHeaders, body: editBody });
      } else {
        onResume(currentReq.id, { method: editMethod, url: editUrl, headers: editHeaders, body: editBody });
      }
      setSelectedId(null);
    }
  };

  const handleDrop = () => {
    if (currentReq) {
      onResume(currentReq.id, { drop: true });
      setSelectedId(null);
    }
  };

  const toggleIntercept = () => updateConfig(!isIntercepting, interceptMode, ignoredMethods);

  // === UPGRADED: Toggle specific methods ===
  const toggleMethodIgnore = (method: string) => {
    const newMethods = ignoredMethods.includes(method)
      ? ignoredMethods.filter(m => m !== method)
      : [...ignoredMethods, method];
    updateConfig(isIntercepting, interceptMode, newMethods);
  };

  // The common HTTP methods to display as toggles
  const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950">

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-1/3 border-r' : 'w-0 border-r-0'} border-zinc-800 transition-all duration-300 flex flex-col overflow-hidden bg-zinc-950`}>
        <div className="min-w-[300px] flex-1 flex flex-col h-full">
          <TrafficList items={pendingQueue} activeId={currentReq?.id || null} onSelect={setSelectedId} />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/20 shrink-0">
          <div className="flex items-center gap-4 p-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            </button>

            <button onClick={toggleIntercept} className={`px-4 py-1.5 rounded font-black text-[10px] uppercase tracking-widest transition-all border ${isIntercepting ? 'bg-rose-500/20 border-rose-500 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>
              {isIntercepting ? 'Intercept_On' : 'Intercept_Off'}
            </button>

            <div className="flex items-center gap-3 border-l border-zinc-800 pl-4 ml-2">
              <select
                value={interceptMode}
                onChange={(e) => updateConfig(isIntercepting, e.target.value, ignoredMethods)}
                className="bg-zinc-950 border border-zinc-700 text-zinc-300 text-[10px] uppercase font-bold tracking-widest p-1.5 rounded outline-none focus:border-emerald-500"
              >
                <option value="both">Req & Res</option>
                <option value="request">Request Only</option>
                <option value="response">Response Only</option>
              </select>

              {/* === UPGRADED IGNORE MULTI-SELECT === */}
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded border border-zinc-800">
                <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest px-2">Ignore:</span>
                {HTTP_METHODS.map(m => (
                  <button
                    key={m}
                    onClick={() => toggleMethodIgnore(m)}
                    className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 rounded transition-all ${ignoredMethods.includes(m)
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-transparent text-zinc-600 hover:text-zinc-400 border border-transparent'
                      }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="ml-auto flex gap-3">
              <button onClick={handleDrop} disabled={!currentReq} className="px-6 py-1.5 bg-rose-900/50 hover:bg-rose-600 border border-rose-700 disabled:opacity-30 text-rose-100 text-[10px] rounded transition-all uppercase font-black">
                Drop
              </button>
              <button onClick={handleForward} disabled={!currentReq} className="px-6 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-zinc-950 text-[10px] rounded transition-all uppercase font-black">
                Forward
              </button>
            </div>
          </div>

          {/* Phase Indicator & Live Timer */}
          {currentReq && (
            <div className="flex border-t border-zinc-800">
              <div className={`flex-1 px-4 py-1.5 text-[9px] uppercase font-black tracking-[0.3em] flex items-center ${isRes ? 'bg-amber-500/10 text-amber-500' : 'bg-sky-500/10 text-sky-500'}`}>
                Currently Modifying: {currentReq.phase} Phase
              </div>
              {currentReq.intercepted_at && (
                <div className="border-l border-zinc-800">
                  <InterceptTimer startTime={currentReq.intercepted_at} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Editor Area */}
        {currentReq ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-8 animate-in fade-in">
            {isRes && (
              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded flex gap-3 items-center">
                <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Target Endpoint:</span>
                <span className="text-sky-500 text-xs font-black">{currentReq.method}</span>
                <span className="text-zinc-300 text-xs font-mono break-all">{currentReq.url}</span>
              </div>
            )}

            <div className="space-y-3">
              <h3 className={`${isRes ? 'text-amber-500' : 'text-emerald-500'} font-bold uppercase text-[10px] tracking-widest flex items-center gap-2`}>
                <span className="opacity-50">#</span> 1. {isRes ? 'Response_Status' : 'Request_Line'}
              </h3>

              {isRes ? (
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-xs font-mono">HTTP/2.0</span>
                  <input
                    type="number"
                    value={editStatusCode}
                    onChange={(e) => setEditStatusCode(Number(e.target.value))}
                    className="w-24 bg-zinc-950 border border-zinc-800 p-3 rounded text-emerald-400 font-black outline-none focus:border-amber-500 transition-colors text-sm text-center"
                  />
                </div>
              ) : (
                <div className="flex gap-4 items-start">
                  <input
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    className="w-24 bg-zinc-950 border border-zinc-800 p-3 rounded text-amber-500 font-black outline-none focus:border-emerald-500 transition-colors text-sm text-center"
                  />
                  <div className="flex-1">
                    <UrlEditor url={editUrl} onChange={setEditUrl} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-8 h-[800px]">
              <div className="flex flex-col h-1/2 space-y-3">
                <h3 className={`${isRes ? 'text-amber-500' : 'text-sky-500'} font-bold uppercase text-[10px] tracking-widest flex items-center gap-2`}>
                  <span className="opacity-50">#</span> 2. {isRes ? 'Response_Headers' : 'Request_Headers'}
                </h3>
                <div className="flex-1 bg-zinc-900/50 border border-zinc-800 p-4 rounded overflow-hidden">
                  <HeaderEditor initialHeaders={isRes ? (currentReq.response_headers || {}) : (currentReq.request_headers || {})} onChange={setEditHeaders} />
                </div>
              </div>

              <div className="flex flex-col h-1/2 space-y-3">
                <h3 className={`${isRes ? 'text-amber-500' : 'text-sky-500'} font-bold uppercase text-[10px] tracking-widest flex items-center gap-2`}>
                  <span className="opacity-50">#</span> 3. {isRes ? 'Response_Body' : 'Request_Body'}
                </h3>
                <div className="flex-1 min-h-0">
                  <BodyEditor body={editBody} headers={editHeaders} onChange={setEditBody} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 grayscale pointer-events-none select-none">
            <div className="text-[60px] font-black tracking-tighter text-zinc-700">MITM_QUEUE_EMPTY</div>
            <div className="text-[10px] uppercase tracking-[0.3em] mt-2">Listening for traffic...</div>
          </div>
        )}
      </div>
    </div>
  );
}
