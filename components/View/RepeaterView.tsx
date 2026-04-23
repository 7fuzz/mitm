import { useState, useEffect } from 'react';
import { HeaderEditor } from '../Editor/HeaderEditor';
import { BodyEditor } from '../Editor/BodyEditor';
import { UrlEditor } from '../Editor/UrlEditor';
import { TrafficList } from '../Sidebar/TrafficList';
import { Traffic } from '@/types/traffic';
import HttpResponseViewer from '../ui/HttpResponseViewer';

export interface RepeaterRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
    time?: number;
  };
  timestamp: number;
}

interface Props {
  requests: RepeaterRequest[];
  variables: { id: string; k: string; v: string }[]; // <--- NEW PROP
  onAddRequest: (req: RepeaterRequest) => void;
  onUpdateVariables: (vars: { id: string; k: string; v: string }[]) => void; // <--- NEW PROP
  onUpdateRequest: (id: string, req: Partial<RepeaterRequest>) => void;
  onDeleteRequest: (id: string) => void;
}



export function RepeaterView({ requests, variables, onUpdateVariables, onAddRequest, onUpdateRequest, onDeleteRequest }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // === NEW: Variables State ===
  const [showVariables, setShowVariables] = useState(false);

  // Editable State
  const [editMethod, setEditMethod] = useState('GET');
  const [editUrl, setEditUrl] = useState('');
  const [editHeaders, setEditHeaders] = useState<Record<string, string>>({});
  const [editBody, setEditBody] = useState('');

  const currentReq = requests.find(r => r.id === selectedId) || requests[0];

  const trafficMapped: Traffic[] = requests.map(req => ({
    id: req.id,
    method: req.method,
    url: req.name,
    status_code: req.response?.status ?? 0,
    host: '',
    phase: 'history',
    request_headers: {}, response_headers: {}, request_body: '', response_body: '',
    is_intercepted: false
  }));

  useEffect(() => {
    if (currentReq) {
      setEditMethod(currentReq.method);
      setEditUrl(currentReq.url);
      setEditHeaders(currentReq.headers || {});
      setEditBody(currentReq.body || '');
    }
  }, [currentReq]);

  const handleAddEmpty = () => {
    const newId = crypto.randomUUID();
    onAddRequest({
      id: newId,
      name: "New Request",
      method: "GET",
      url: "{{base_url}}/api/", // <-- Template friendly!
      headers: {},
      body: "",
      timestamp: Date.now()
    });
    setSelectedId(newId);
  };

  const handleDuplicate = () => {
    if (!currentReq) return;
    const newId = crypto.randomUUID();
    onAddRequest({ ...currentReq, id: newId, name: `${currentReq.name} (Copy)`, timestamp: Date.now() });
    setSelectedId(newId);
  };

  const handleSend = async () => {
    if (!currentReq) return;
    setIsLoading(true);

    try {
      // 1. Convert variable array into a simple key-value dictionary
      // Convert variable array into a simple key-value dictionary
      const varDict: Record<string, string> = {};
      variables.forEach(v => { if (v.k.trim()) varDict[v.k.trim()] = v.v; });

      // Send the RAW data + the variables dictionary directly to Python
      const response = await fetch('/api/repeater', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: editMethod,
          url: editUrl,
          headers: editHeaders,
          body: editBody,
          variables: varDict
        }),
      });
      const data = await response.json();
      if (!data.success) return alert('Error: ' + (data.error || 'Unknown error'));

      // 3. Save the response
      onUpdateRequest(currentReq.id, {
        method: editMethod, url: editUrl, headers: editHeaders, body: editBody,
        response: { status: data.status ?? 0, headers: data.headers || {}, body: data.body || '', time: Date.now() },
      });
    } catch (error) {
      alert('Error sending request: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (currentReq) onUpdateRequest(currentReq.id, { response: undefined });
  };

  const handleSaveToVault = async () => {
    if (!currentReq) return;
    await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: currentReq.name, group: 'repeater',
        request: { method: editMethod, url: editUrl, headers: editHeaders, body: editBody },
        response: currentReq.response ? { status_code: currentReq.response.status, headers: currentReq.response.headers, body: currentReq.response.body } : null,
      }),
    });
    alert('Saved to Proxy Vault!');
  };

  const getRawResponseText = () => {
    if (!currentReq?.response) return '';
    const headerText = Object.entries(currentReq.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
    return `${headerText}\n\n${currentReq.response.body}`;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950">

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-1/3 border-r' : 'w-0 border-r-0'} border-zinc-800 transition-all duration-300 flex flex-col overflow-hidden bg-zinc-950`}>
        <div className="min-w-[300px] flex-1 flex flex-col h-full bg-zinc-950">
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/20 flex items-center justify-between shrink-0">
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] ml-1">Saved_Requests</span>
            <button onClick={handleAddEmpty} className="p-1.5 bg-zinc-800 hover:bg-purple-600 text-zinc-300 hover:text-white rounded transition-colors" title="New Blank Request">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
          <TrafficList items={trafficMapped} activeId={selectedId} onSelect={setSelectedId} onDelete={onDeleteRequest} activeColor="purple" />
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/20 shrink-0 relative z-20">
          <div className="flex items-center gap-4 p-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            </button>

            {/* Variables Toggle Button */}
            <button
              onClick={() => setShowVariables(!showVariables)}
              className={`px-3 py-1.5 border flex items-center gap-2 text-[10px] rounded transition-all uppercase font-black tracking-widest ${showVariables ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700'}`}
            >
              <span className="opacity-50">&#123;&#123;</span>
              Variables
              <span className="opacity-50">&#125;&#125;</span>
            </button>

            <div className="ml-auto flex gap-2">
              <button onClick={handleClear} disabled={!currentReq?.response} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 disabled:opacity-30 text-zinc-100 text-[10px] rounded transition-all uppercase font-black">Clear</button>
              <button onClick={handleDuplicate} disabled={!currentReq} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 disabled:opacity-30 text-zinc-100 text-[10px] rounded transition-all uppercase font-black">Duplicate</button>
              <button onClick={handleSaveToVault} disabled={!currentReq} className="px-4 py-1.5 bg-sky-900/30 hover:bg-sky-600 text-sky-400 hover:text-white border border-sky-800 disabled:opacity-30 text-[10px] rounded transition-all uppercase font-black">Save_to_Vault</button>
              <button onClick={handleSend} disabled={isLoading || !currentReq} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-zinc-950 text-[10px] rounded transition-all uppercase font-black">{isLoading ? 'Sending...' : 'Send'}</button>
            </div>
          </div>

          {/* Variables Dropdown Panel */}
          {showVariables && (
            <div className="absolute top-full left-0 right-0 bg-zinc-900 border-b border-zinc-800 p-4 shadow-xl shadow-black/50 z-30">
              <div className="flex items-center justify-between mb-3">
                <div className="text-amber-500 text-[10px] font-bold uppercase tracking-widest">Environment Variables</div>
                <button
                  onClick={() => onUpdateVariables([...variables, { id: crypto.randomUUID(), k: '', v: '' }])}
                  className="text-[10px] uppercase font-bold text-sky-400 hover:text-sky-300 tracking-widest"
                >
                  + Add Variable
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                {variables.map(v => (
                  <div key={v.id} className="flex gap-2 group">
                    <input
                      value={v.k}
                      onChange={(e) => onUpdateVariables(variables.map(item => item.id === v.id ? { ...item, k: e.target.value } : item))}
                      placeholder="key_name"
                      className="w-1/3 bg-zinc-950 border border-zinc-800 p-2 rounded text-amber-400 outline-none focus:border-amber-500 transition-colors text-[11px] font-mono"
                    />
                    <input
                      value={v.v}
                      onChange={(e) => onUpdateVariables(variables.map(item => item.id === v.id ? { ...item, v: e.target.value } : item))}
                      placeholder="value"
                      className="flex-1 bg-zinc-950 border border-zinc-800 p-2 rounded text-zinc-300 outline-none focus:border-amber-500 transition-colors text-[11px] font-mono"
                    />
                    <button
                      onClick={() => onUpdateVariables(variables.filter(item => item.id !== v.id))}
                      className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {variables.length === 0 && <div className="text-zinc-600 text-xs italic">No variables defined. Add one above.</div>}
              </div>
            </div>
          )}
        </div>

        {/* Editor Area */}
        {currentReq ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-8 animate-in fade-in pb-24 relative z-10">

            {/* 1. Request Line */}
            <div className="space-y-3">
              <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> 1. Request_Line</h3>
              <div className="flex gap-4 items-start">
                <select value={editMethod} onChange={(e) => setEditMethod(e.target.value)} className="w-24 bg-zinc-950 border border-zinc-800 p-3 rounded text-amber-500 font-black outline-none focus:border-purple-500 transition-colors text-sm text-center">
                  <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option><option value="PATCH">PATCH</option><option value="HEAD">HEAD</option><option value="OPTIONS">OPTIONS</option>
                </select>
                <div className="flex-1"><UrlEditor url={editUrl} onChange={setEditUrl} /></div>
              </div>
            </div>

            <div className="flex flex-col gap-8 h-[600px]">
              {/* 2. Headers Editor */}
              <div className="flex flex-col h-1/2 space-y-3">
                <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> 2. Request_Headers</h3>
                <div className="flex-1 bg-zinc-900/50 border border-zinc-800 p-4 rounded overflow-hidden"><HeaderEditor initialHeaders={editHeaders} onChange={setEditHeaders} /></div>
              </div>

              {/* 3. Body Editor */}
              <div className="flex flex-col h-1/2 space-y-3">
                <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> 3. Request_Body</h3>
                <div className="flex-1 min-h-0"><BodyEditor body={editBody} headers={editHeaders} onChange={setEditBody} /></div>
              </div>
            </div>

            {/* Response Section */}
            {currentReq.response && (
              <div className="mt-8 pt-8 border-t border-zinc-800 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-amber-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> Response_Received</h3>
                  <div className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest ${currentReq.response.status >= 400 ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500' : currentReq.response.status >= 300 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'}`}>
                    Status: {currentReq.response.status}
                  </div>
                </div>

                <div className="h-[600px] flex flex-col">
                  <HttpResponseViewer text={getRawResponseText()} />
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50 relative z-10">
            <div className="text-[60px] font-black tracking-tighter text-zinc-700 mb-6">REPEATER_EMPTY</div>
            <button onClick={handleAddEmpty} className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-zinc-950 font-black uppercase tracking-widest text-xs rounded transition-colors shadow-lg shadow-purple-500/20">
              + Create New Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
