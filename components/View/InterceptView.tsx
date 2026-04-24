import { useState, useEffect } from 'react';
import { TrafficList } from '../Sidebar/TrafficList';
import { HeaderEditor } from '../Editor/HeaderEditor';
import { BodyEditor } from '../Editor/BodyEditor';
import { UrlEditor } from '../Editor/UrlEditor';
import { InterceptTimer } from '../ui/InterceptTimer';
import { WorkspaceLayout } from '../Layout/WorkspaceLayout';
import { useTraffic } from '@/hooks/traffic'; // <--- Import Hook

// NO MORE PROPS!
export function InterceptView() {
  const {
    traffic, isIntercepting, interceptMode, ignoredMethods,
    updateConfig, resumeRequest, uiLayout, updateUILayout
  } = useTraffic(); // <--- Grab everything from context

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
        resumeRequest(currentReq.id, { status_code: editStatusCode, headers: editHeaders, body: editBody });
      } else {
        resumeRequest(currentReq.id, { method: editMethod, url: editUrl, headers: editHeaders, body: editBody });
      }
      setSelectedId(null);
    }
  };

  const handleDrop = () => {
    if (currentReq) {
      resumeRequest(currentReq.id, { drop: true });
      setSelectedId(null);
    }
  };

  const toggleIntercept = () => updateConfig(!isIntercepting, interceptMode, ignoredMethods);

  const toggleMethodIgnore = (method: string) => {
    const newMethods = ignoredMethods.includes(method)
      ? ignoredMethods.filter(m => m !== method)
      : [...ignoredMethods, method];
    updateConfig(isIntercepting, interceptMode, newMethods);
  };

  const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];

  return (
    <WorkspaceLayout
      uiLayout={uiLayout}
      onUpdateLayout={updateUILayout}
      listComponent={(layout) => (
        <TrafficList items={pendingQueue} activeId={currentReq?.id || null} onSelect={setSelectedId} layout={layout === 'sidebar' ? 'sidebar' : 'table'} />
      )}
      toolbarRight={
        <>
          <button onClick={toggleIntercept} className={`px-4 py-1.5 rounded font-black text-[10px] uppercase tracking-widest transition-all border ${isIntercepting ? 'bg-rose-500/20 border-rose-500 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}>
            {isIntercepting ? 'Intercept_On' : 'Intercept_Off'}
          </button>
          <select value={interceptMode} onChange={(e) => updateConfig(isIntercepting, e.target.value, ignoredMethods)} className="bg-zinc-950 border border-zinc-700 text-zinc-300 text-[10px] uppercase font-bold tracking-widest p-1.5 rounded outline-none focus:border-emerald-500">
            <option value="both">Req & Res</option><option value="request">Request Only</option><option value="response">Response Only</option>
          </select>
          <div className="w-px h-4 bg-zinc-800 mx-2"></div>
          <button onClick={handleDrop} disabled={!currentReq} className="px-6 py-1.5 bg-rose-900/50 hover:bg-rose-600 border border-rose-700 disabled:opacity-30 text-rose-100 text-[10px] rounded transition-all uppercase font-black">Drop</button>
          <button onClick={handleForward} disabled={!currentReq} className="px-6 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-zinc-950 text-[10px] rounded transition-all uppercase font-black">Forward</button>
        </>
      }
      extraHeader={
        <>
          <div className="flex items-center gap-4 p-3 bg-zinc-900/50">
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded border border-zinc-800 w-full">
              <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest px-2">Ignore:</span>
              {HTTP_METHODS.map(m => (
                <button
                  key={m} onClick={() => toggleMethodIgnore(m)}
                  className={`text-[9px] uppercase font-bold tracking-widest px-2 py-1 rounded transition-all ${ignoredMethods.includes(m) ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-transparent text-zinc-600 hover:text-zinc-400 border border-transparent'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {currentReq && (
            <div className="flex border-t border-zinc-800 shrink-0">
              <div className={`flex-1 px-4 py-1.5 text-[9px] uppercase font-black tracking-[0.3em] flex items-center ${isRes ? 'bg-amber-500/10 text-amber-500' : 'bg-sky-500/10 text-sky-500'}`}>
                Currently Modifying: {currentReq.phase} Phase
              </div>
              {currentReq.intercepted_at && (
                <div className="border-l border-zinc-800 bg-zinc-900/50">
                  <InterceptTimer startTime={currentReq.intercepted_at} />
                </div>
              )}
            </div>
          )}
        </>
      }
      mainContent={(splitMode) => (
        currentReq ? (
          <div className={`w-full mx-auto pb-24 space-y-10 ${splitMode === 'horizontal' ? 'max-w-[90rem]' : 'max-w-5xl'}`}>

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
                    type="number" value={editStatusCode} onChange={(e) => setEditStatusCode(Number(e.target.value))}
                    className="w-24 bg-zinc-950 border border-zinc-800 p-3 rounded text-emerald-400 font-black outline-none focus:border-amber-500 transition-colors text-sm text-center"
                  />
                </div>
              ) : (
                <div className="w-full">
                  <UrlEditor
                    method={editMethod} onMethodChange={setEditMethod}
                    url={editUrl} onChange={setEditUrl}
                  />
                </div>
              )}
            </div>

            {/* NATIVE GRID: Side-by-Side or Stacked */}
            <div className={`grid ${splitMode === 'horizontal' ? 'grid-cols-2 gap-8' : 'grid-cols-1 gap-10'}`}>
              <div className="flex flex-col space-y-3">
                <h3 className={`${isRes ? 'text-amber-500' : 'text-sky-500'} font-bold uppercase text-[10px] tracking-widest flex items-center gap-2`}>
                  <span className="opacity-50">#</span> 2. {isRes ? 'Response_Headers' : 'Request_Headers'}
                </h3>
                <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-[300px]">
                  <HeaderEditor initialHeaders={isRes ? (currentReq.response_headers || {}) : (currentReq.request_headers || {})} onChange={setEditHeaders} />
                </div>
              </div>

              <div className="flex flex-col space-y-3">
                <h3 className={`${isRes ? 'text-amber-500' : 'text-sky-500'} font-bold uppercase text-[10px] tracking-widest flex items-center gap-2`}>
                  <span className="opacity-50">#</span> 3. {isRes ? 'Response_Body' : 'Request_Body'}
                </h3>
                <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-[350px]">
                  <BodyEditor body={editBody} headers={editHeaders} onChange={setEditBody} />
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-30 grayscale pointer-events-none select-none min-h-[60vh]">
            <div className="text-[60px] font-black tracking-tighter text-zinc-700">MITM_QUEUE_EMPTY</div>
            <div className="text-[10px] uppercase tracking-[0.3em] mt-2">Listening for traffic...</div>
          </div>
        )
      )}
    />
  );
}
