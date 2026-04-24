import { useState, useEffect } from 'react';
import { HeaderEditor } from '../Editor/HeaderEditor';
import { BodyEditor } from '../Editor/BodyEditor';
import { UrlEditor } from '../Editor/UrlEditor';
import { TrafficList } from '../Sidebar/TrafficList';
import { Traffic } from '@/types/traffic';
import HttpResponseViewer from '../ui/HttpResponseViewer';
import { WorkspaceLayout } from '../Layout/WorkspaceLayout';
import { useTraffic } from '@/hooks/traffic';

export interface RepeaterRequest {
  id: string; name: string; method: string; url: string; headers: Record<string, string>; body: string; timestamp: number;
  response?: { status: number; headers: Record<string, string>; body: string; time?: number; };
}

export function RepeaterView() {
  const {
    repeaterRequests, setRepeaterRequests,
    variables,
    activeProject,
    uiLayout, updateUILayout,
    repeaterSelectedId: selectedId,
    setRepeaterSelectedId: setSelectedId
  } = useTraffic();

  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false); // <--- NEW: Toggle State

  const [editMethod, setEditMethod] = useState('GET');
  const [editUrl, setEditUrl] = useState('');
  const [editHeaders, setEditHeaders] = useState<Record<string, string>>({});
  const [editBody, setEditBody] = useState('');

  const currentReq = repeaterRequests.find(r => r.id === selectedId) || repeaterRequests[0];

  const trafficMapped: Traffic[] = repeaterRequests.map(req => ({
    id: req.id, method: req.method, url: req.name, status_code: req.response?.status ?? 0, host: '', phase: 'history', request_headers: {}, response_headers: {}, request_body: '', response_body: '', is_intercepted: false
  }));

  useEffect(() => {
    if (currentReq) { setEditMethod(currentReq.method); setEditUrl(currentReq.url); setEditHeaders(currentReq.headers || {}); setEditBody(currentReq.body || ''); }
  }, [currentReq]);

  const handleAddEmpty = () => {
    const newId = crypto.randomUUID();
    const newReq: RepeaterRequest = { id: newId, name: "New Request", method: "GET", url: "{{base_url}}/api/", headers: {}, body: "", timestamp: Date.now() };
    setRepeaterRequests([...repeaterRequests, newReq]);
    setSelectedId(newId);
  };

  const handleDuplicate = () => {
    if (!currentReq) return;
    const newId = crypto.randomUUID();
    setRepeaterRequests([...repeaterRequests, { ...currentReq, id: newId, name: `${currentReq.name} (Copy)`, timestamp: Date.now() }]);
    setSelectedId(newId);
  };

  const handleDeleteRequest = (id: string) => setRepeaterRequests(repeaterRequests.filter(r => r.id !== id));
  const handleUpdateRequest = (id: string, updates: Partial<RepeaterRequest>) => setRepeaterRequests(repeaterRequests.map(r => r.id === id ? { ...r, ...updates } : r));

  const handleSend = async () => {
    if (!currentReq) return;
    setIsLoading(true);
    try {
      const varDict: Record<string, string> = {};
      variables.filter(v => v.project === activeProject).forEach(v => {
        if (v.name.trim()) {
          const activeVal = v.values[v.activeIndex] || v.values[0];
          varDict[v.name.trim()] = activeVal ? activeVal.value : '';
        }
      });

      const response = await fetch('/api/repeater', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: editMethod, url: editUrl, headers: editHeaders, body: editBody, variables: varDict }),
      });
      const data = await response.json();
      if (!data.success) return alert('Error: ' + (data.error || 'Unknown error'));

      handleUpdateRequest(currentReq.id, {
        method: editMethod, url: editUrl, headers: editHeaders, body: editBody,
        response: { status: data.status ?? 0, headers: data.headers || {}, body: data.body || '', time: Date.now() },
      });
    } catch (error) { alert('Error: ' + error); } finally { setIsLoading(false); }
  };

  // --- NEW: Interpolation Logic for the Preview ---
  const getPreviewRequestText = () => {
    const varDict: Record<string, string> = {};
    variables.filter(v => v.project === activeProject).forEach(v => {
      if (v.name.trim()) {
        const activeVal = v.values[v.activeIndex] || v.values[0];
        varDict[v.name.trim()] = activeVal ? activeVal.value : '';
      }
    });

    const interpolate = (text: string) => {
      if (!text) return '';
      let result = text.replace(/\{\{([^}]+)\}\}/g, (match, key) => varDict[key.trim()] ?? match);
      result = result.replace(/%7B%7B(.*?)%7D%7D/gi, (match, key) => varDict[decodeURIComponent(key).trim()] ?? match);
      return result;
    };

    const reqUrl = interpolate(editUrl);
    let path = reqUrl;
    let host = '';
    try {
      const parsed = new URL(reqUrl);
      path = parsed.pathname + parsed.search + parsed.hash;
      host = parsed.host;
    } catch { /* Ignore malformed URLs */ }

    let headerStr = `${editMethod} ${path} HTTP/1.1\n`;
    let hasHost = false;

    Object.entries(editHeaders).forEach(([k, v]) => {
      if (k.toLowerCase() === 'host') hasHost = true;
      headerStr += `${interpolate(k)}: ${interpolate(v)}\n`;
    });

    if (host && !hasHost) headerStr += `Host: ${host}\n`;

    const reqBody = interpolate(editBody);
    return `${headerStr}\n${reqBody}`;
  };

  const getRawResponseText = () => {
    if (!currentReq?.response) return '';
    const headerText = Object.entries(currentReq.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
    return `${headerText}\n\n${currentReq.response.body}`;
  };

  return (
    <WorkspaceLayout
      uiLayout={uiLayout}
      onUpdateLayout={updateUILayout}
      listComponent={(layout) => (
        <TrafficList items={trafficMapped} activeId={selectedId} onSelect={setSelectedId} onDelete={handleDeleteRequest} activeColor="purple" layout={layout === 'sidebar' ? 'sidebar' : 'table'} />
      )}
      toolbarRight={
        <>
          <button onClick={handleAddEmpty} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-emerald-400 text-[10px] rounded transition-all uppercase font-black">+ New</button>
          <button onClick={handleDuplicate} disabled={!currentReq} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 disabled:opacity-30 text-zinc-100 text-[10px] rounded transition-all uppercase font-black">Duplicate</button>
          <button onClick={() => currentReq && handleUpdateRequest(currentReq.id, { response: undefined })} disabled={!currentReq?.response} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 disabled:opacity-30 text-zinc-100 text-[10px] rounded transition-all uppercase font-black">Clear</button>
          <button onClick={handleSend} disabled={isLoading || !currentReq} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-zinc-950 text-[10px] rounded transition-all uppercase font-black">{isLoading ? 'Sending...' : 'Send'}</button>
        </>
      }
      mainContent={(splitMode) => (
        currentReq ? (
          <div className={`w-full mx-auto pb-24 space-y-10 ${splitMode === 'horizontal' ? 'max-w-[90rem]' : 'max-w-5xl'}`}>

            <div className="space-y-3">
              <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> 1. Request_Line</h3>
              <div className="flex gap-4 items-start">
                <div className="w-full">
                  <UrlEditor method={editMethod} onMethodChange={setEditMethod} url={editUrl} onChange={setEditUrl} />
                </div>
              </div>
            </div>

            <div className={`grid ${splitMode === 'horizontal' ? 'grid-cols-2 gap-8' : 'grid-cols-1 gap-10'}`}>

              {/* Left Column: Editor vs Preview Toggle */}
              <div className="flex flex-col gap-4">

                {/* NEW: Toolbar Toggle */}
                <div className="flex items-center justify-between">
                  <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                    <span className="opacity-50">#</span> Outbound_Payload
                  </h3>
                  <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
                    <button onClick={() => setShowPreview(false)} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${!showPreview ? 'bg-purple-600/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}>Builder</button>
                    <button onClick={() => setShowPreview(true)} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${showPreview ? 'bg-purple-600/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}>Interpolated Preview</button>
                  </div>
                </div>

                {!showPreview ? (
                  <div className="flex flex-col gap-8 flex-1">
                    <div className="flex flex-col space-y-3">
                      <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> 2. Request_Headers</h3>
                      <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-[300px]">
                        <HeaderEditor initialHeaders={editHeaders} onChange={setEditHeaders} />
                      </div>
                    </div>

                    <div className="flex flex-col space-y-3">
                      <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> 3. Request_Body</h3>
                      <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-[350px]">
                        <BodyEditor body={editBody} headers={editHeaders} onChange={setEditBody} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-[600px] flex flex-col shadow-inner shadow-black/50">
                    <HttpResponseViewer text={getPreviewRequestText()} />
                  </div>
                )}
              </div>

              {/* Right Column: Response */}
              <div className="flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-amber-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> Response_Received</h3>
                  {currentReq.response && (
                    <div className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest ${currentReq.response.status >= 400 ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500' : currentReq.response.status >= 300 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'}`}>
                      Status: {currentReq.response.status}
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-[400px]">
                  {currentReq.response ? (
                    <HttpResponseViewer text={getRawResponseText()} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-zinc-600 text-[10px] uppercase tracking-widest border border-zinc-800 border-dashed rounded">
                      Hit Send to get a response...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-50 relative z-10 min-h-[60vh]">
            <div className="text-[60px] font-black tracking-tighter text-zinc-700 mb-6">REPEATER_EMPTY</div>
            <button onClick={handleAddEmpty} className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-zinc-950 font-black uppercase tracking-widest text-xs rounded transition-colors shadow-lg shadow-purple-500/20">+ Create New Request</button>
          </div>
        )
      )}
    />
  );
}
