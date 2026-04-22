import { useState, useEffect } from 'react';
import { HeaderEditor } from '../Intercept/HeaderEditor';
import { BodyEditor } from '../Intercept/BodyEditor';
import { UrlEditor } from '../ui/UrlEditor';
import { MultiSelectFilter, FilterState } from '../ui/MultiSelectFilter';
import { TrafficItem } from '../Sidebar/TrafficItem';

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

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
const STATUS_FILTERS = ['2XX', '3XX', '4XX', '5XX', 'UNSENT'];

function getStatusCategory(status?: number): string {
  if (!status) return 'UNSENT';
  if (status < 300) return '2XX';
  if (status < 400) return '3XX';
  if (status < 500) return '4XX';
  return '5XX';
}

export function RepeaterView({ requests, onUpdateRequest, onDeleteRequest }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<Record<string, FilterState>>({});
  const [statusFilter, setStatusFilter] = useState<Record<string, FilterState>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Editable State
  const [editMethod, setEditMethod] = useState('GET');
  const [editUrl, setEditUrl] = useState('');
  const [editHeaders, setEditHeaders] = useState<Record<string, string>>({});
  const [editBody, setEditBody] = useState('');

  const currentReq = requests.find(r => r.id === selectedId) || requests[0];

  const toggleMethod = (method: string) => {
    setMethodFilter(prev => {
      const current = prev[method];
      const next = current === undefined ? 'include' : current === 'include' ? 'exclude' : undefined;
      return { ...prev, [method]: next };
    });
  };

  const toggleStatus = (status: string) => {
    setStatusFilter(prev => {
      const current = prev[status];
      const next = current === undefined ? 'include' : current === 'include' ? 'exclude' : undefined;
      return { ...prev, [status]: next };
    });
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.name.toLowerCase().includes(searchTerm.toLowerCase()) || req.url.toLowerCase().includes(searchTerm.toLowerCase());

    // Method filtering logic
    const methodIncludes = Object.entries(methodFilter)
      .filter(([_, state]) => state === 'include')
      .map(([method, _]) => method);
    const methodExcludes = Object.entries(methodFilter)
      .filter(([_, state]) => state === 'exclude')
      .map(([method, _]) => method);

    let matchesMethod = true;
    if (methodIncludes.length > 0) {
      matchesMethod = methodIncludes.includes(req.method.toUpperCase());
    }
    if (matchesMethod && methodExcludes.length > 0) {
      matchesMethod = !methodExcludes.includes(req.method.toUpperCase());
    }

    // Status filtering logic
    const statusCat = getStatusCategory(req.response?.status);
    const statusIncludes = Object.entries(statusFilter)
      .filter(([_, state]) => state === 'include')
      .map(([status, _]) => status);
    const statusExcludes = Object.entries(statusFilter)
      .filter(([_, state]) => state === 'exclude')
      .map(([status, _]) => status);

    let matchesStatus = true;
    if (statusIncludes.length > 0) {
      matchesStatus = statusIncludes.includes(statusCat);
    }
    if (matchesStatus && statusExcludes.length > 0) {
      matchesStatus = !statusExcludes.includes(statusCat);
    }

    return matchesSearch && matchesMethod && matchesStatus;
  });

  // Sync state when request changes
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
        body: JSON.stringify({
          method: editMethod,
          url: editUrl,
          headers: editHeaders,
          body: editBody,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        alert('Error: ' + (data.error || 'Unknown error'));
        return;
      }

      const time = Date.now();
      onUpdateRequest(currentReq.id, {
        method: editMethod,
        url: editUrl,
        headers: editHeaders,
        body: editBody,
        response: {
          status: data.status ?? 0,
          headers: data.headers || {},
          body: data.body || '',
          time,
        },
      });
    } catch (error) {
      alert('Error sending request: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (currentReq) {
      onUpdateRequest(currentReq.id, { response: undefined });
    }
  };

  const handleSaveToVault = async () => {
    if (!currentReq) return;
    await fetch('/api/saved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: currentReq.name,
        group: 'repeater',
        request: {
          method: editMethod,
          url: editUrl,
          headers: editHeaders,
          body: editBody,
        },
        response: currentReq.response ? {
          status_code: currentReq.response.status,
          headers: currentReq.response.headers,
          body: currentReq.response.body,
        } : null,
      }),
    });
    alert('Saved to Proxy Vault!');
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-1/3 border-r' : 'w-0 border-r-0'} border-zinc-800 transition-all duration-300 flex flex-col overflow-hidden bg-zinc-950`}>
        <div className="min-w-[300px] flex-1 flex flex-col h-full">
          <div className="flex flex-col h-full bg-zinc-950">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] shrink-0">
              Saved_Requests
            </div>

            {/* Search */}
            <div className="p-3 border-b border-zinc-800 space-y-3 bg-zinc-900/30 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 p-2 pl-8 rounded text-zinc-300 outline-none focus:border-purple-500 transition-colors text-[11px] font-mono"
                  />
                  <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300">✕</button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-2 py-1.5 text-[9px] uppercase font-bold tracking-widest rounded bg-zinc-900 text-zinc-400 border border-zinc-700 hover:text-zinc-200 hover:border-zinc-600 transition-all whitespace-nowrap"
                >
                  {showFilters ? 'Hide' : 'Show'} Filter
                </button>
              </div>

              {showFilters && (
                <>
                  {/* Method Filter */}
                  <div>
                    <div className="text-[8px] uppercase text-zinc-600 font-black tracking-widest mb-1.5">Methods</div>
                    <MultiSelectFilter
                      options={METHODS}
                      filterStates={methodFilter}
                      onToggle={toggleMethod}
                      onClear={() => setMethodFilter({})}
                    />
                  </div>

                  {/* Status Filter */}
                  <div>
                    <div className="text-[8px] uppercase text-zinc-600 font-black tracking-widest mb-1.5">Response Status</div>
                    <MultiSelectFilter
                      options={STATUS_FILTERS}
                      filterStates={statusFilter}
                      onToggle={toggleStatus}
                      onClear={() => setStatusFilter({})}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {filteredRequests.length === 0 ? (
                <div className="p-4 text-center text-zinc-600 text-[10px] uppercase tracking-widest mt-4">
                  No requests
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {filteredRequests.map(req => (
                    <TrafficItem
                      key={req.id}
                      id={req.id}
                      method={req.method}
                      status={req.response?.status ?? 0}
                      title={req.name}
                      isActive={selectedId === req.id}
                      activeColor="purple" // <--- Gives Repeater its unique flavor!
                      onClick={setSelectedId}
                      onDelete={onDeleteRequest}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/20 shrink-0">
          <div className="flex items-center gap-4 p-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>

            <div className="ml-auto flex gap-2">
              <button
                onClick={handleClear}
                disabled={!currentReq?.response}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 disabled:opacity-30 text-zinc-100 text-[10px] rounded transition-all uppercase font-black"
              >
                Clear
              </button>
              <button
                onClick={handleSaveToVault}
                disabled={!currentReq}
                className="px-4 py-1.5 bg-sky-900/30 hover:bg-sky-600 text-sky-400 hover:text-white border border-sky-800 disabled:opacity-30 text-[10px] rounded transition-all uppercase font-black"
              >
                Save_to_Vault
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading || !currentReq}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-zinc-950 text-[10px] rounded transition-all uppercase font-black"
              >
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
              <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                <span className="opacity-50">#</span> 1. Request_Line
              </h3>

              <div className="flex gap-4 items-start">
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  className="w-24 bg-zinc-950 border border-zinc-800 p-3 rounded text-amber-500 font-black outline-none focus:border-purple-500 transition-colors text-sm text-center"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                  <option value="HEAD">HEAD</option>
                  <option value="OPTIONS">OPTIONS</option>
                </select>
                <div className="flex-1">
                  <UrlEditor url={editUrl} onChange={setEditUrl} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-8 h-[600px]">
              {/* 2. Headers Editor */}
              <div className="flex flex-col h-1/2 space-y-3">
                <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                  <span className="opacity-50">#</span> 2. Request_Headers
                </h3>
                <div className="flex-1 bg-zinc-900/50 border border-zinc-800 p-4 rounded overflow-hidden">
                  <HeaderEditor initialHeaders={editHeaders} onChange={setEditHeaders} />
                </div>
              </div>

              {/* 3. Body Editor */}
              <div className="flex flex-col h-1/2 space-y-3">
                <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                  <span className="opacity-50">#</span> 3. Request_Body
                </h3>
                <div className="flex-1 min-h-0">
                  <BodyEditor
                    body={editBody}
                    headers={editHeaders}
                    onChange={setEditBody}
                  />
                </div>
              </div>
            </div>

            {/* Response Section */}
            {currentReq.response && (
              <div className="mt-8 pt-8 border-t border-zinc-800 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-amber-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                    <span className="opacity-50">#</span> Response_Received
                  </h3>
                  <div className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest ${currentReq.response.status >= 400 ? 'bg-rose-500/10 border border-rose-500/30 text-rose-500' :
                    currentReq.response.status >= 300 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500' :
                      'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
                    }`}>
                    Status: {currentReq.response.status}
                  </div>
                </div>

                <div className="flex flex-col gap-8 h-[600px]">
                  {/* 4. Response Headers */}
                  <div className="flex flex-col h-1/2 space-y-3">
                    <h3 className="text-amber-500/70 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                      <span className="opacity-50">#</span> 4. Response_Headers
                    </h3>
                    <div className="flex-1 bg-zinc-900/30 border border-zinc-800/50 p-4 rounded overflow-hidden">
                      <HeaderEditor
                        initialHeaders={currentReq.response.headers}
                        onChange={() => { }} // Dummy function to prevent errors while keeping it read-only for state
                      />
                    </div>
                  </div>

                  {/* 5. Response Body */}
                  <div className="flex flex-col h-1/2 space-y-3">
                    <h3 className="text-amber-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                      <span className="opacity-50">#</span> 5. Response_Body
                    </h3>
                    <div className="flex-1 min-h-0 relative">
                      <BodyEditor
                        body={currentReq.response.body}
                        headers={currentReq.response.headers}
                        onChange={() => { }} // Dummy function
                      />
                      {/* Transparent overlay to subtly indicate it shouldn't be edited */}
                      <div className="absolute inset-0 pointer-events-none border border-transparent peer-focus-within:border-amber-500/30 rounded transition-colors" />
                    </div>
                  </div>
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
