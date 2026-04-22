import { useState, useEffect } from 'react';
import { HeaderEditor } from '../Editor/HeaderEditor';
import { BodyEditor } from '../Editor/BodyEditor';
import { UrlEditor } from '../Editor/UrlEditor';
import { TrafficList } from '../Sidebar/TrafficList';
import { Traffic } from '@/types/traffic';
import HttpResponseViewer from '../Inspector/HttpResponseViewer';

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
  onUpdateRequest: (id: string, req: Partial<RepeaterRequest>) => void;
  onDeleteRequest: (id: string) => void;
}

export function RepeaterView({ requests, onUpdateRequest, onDeleteRequest }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSend = async () => {
    if (!currentReq) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/repeater', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: editMethod, url: editUrl, headers: editHeaders, body: editBody }),
      });
      const data = await response.json();
      if (!data.success) return alert('Error: ' + (data.error || 'Unknown error'));

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

  // 2. Helper to stitch the response back together for your Viewer
  const getRawResponseText = () => {
    if (!currentReq?.response) return '';
    const headerText = Object.entries(currentReq.response.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    return `${headerText}\n\n${currentReq.response.body}`;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950">

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-1/3 border-r' : 'w-0 border-r-0'} border-zinc-800 transition-all duration-300 flex flex-col overflow-hidden bg-zinc-950`}>
        <div className="min-w-[300px] flex-1 flex flex-col h-full bg-zinc-950">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] shrink-0">
            Saved_Requests
          </div>

          <TrafficList
            items={trafficMapped}
            activeId={selectedId}
            onSelect={setSelectedId}
            onDelete={onDeleteRequest}
            activeColor="purple"
          />
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/20 shrink-0">
          <div className="flex items-center gap-4 p-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            </button>

            <div className="ml-auto flex gap-2">
              <button onClick={handleClear} disabled={!currentReq?.response} className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 disabled:opacity-30 text-zinc-100 text-[10px] rounded transition-all uppercase font-black">
                Clear
              </button>
              <button onClick={handleSaveToVault} disabled={!currentReq} className="px-4 py-1.5 bg-sky-900/30 hover:bg-sky-600 text-sky-400 hover:text-white border border-sky-800 disabled:opacity-30 text-[10px] rounded transition-all uppercase font-black">
                Save_to_Vault
              </button>
              <button onClick={handleSend} disabled={isLoading || !currentReq} className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-zinc-950 text-[10px] rounded transition-all uppercase font-black">
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Editor Area */}
        {currentReq ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-8 animate-in fade-in pb-24">

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

            {/* 3. Replaced the Response Section with your new Viewer! */}
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
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 grayscale pointer-events-none select-none">
            <div className="text-[60px] font-black tracking-tighter text-zinc-700">REPEATER_EMPTY</div>
            <div className="text-[10px] uppercase tracking-[0.3em] mt-2">Add a request to get started...</div>
          </div>
        )}
      </div>
    </div>
  );
}
