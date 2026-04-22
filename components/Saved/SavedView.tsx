import { useState, useEffect } from 'react';
import HttpResponseViewer from '../Inspector/HttpResponseViewer';

interface SavedItem {
  id: string;
  name: string;
  group: string;
  request: any;
  response: any;
  timestamp: number;
}

export function SavedView({ onSendToRepeater }: { onSendToRepeater?: (item: SavedItem) => void }) {
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [responseFilter, setResponseFilter] = useState<'all' | 'success' | 'redirect' | 'error'>('all');

  useEffect(() => {
    fetch('/api/saved').then(r => r.json()).then(setSavedItems);
  }, []);

  const handleDelete = async (id: string) => {
    await fetch(`/api/saved/${id}`, { method: 'DELETE' });
    setSavedItems(savedItems.filter(i => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const getStatusCategory = (status?: number): 'success' | 'redirect' | 'error' => {
    if (!status) return 'error';
    if (status < 300) return 'success';
    if (status < 400) return 'redirect';
    return 'error';
  };

  const selected = savedItems.find(i => i.id === selectedId);

  const filteredItems = savedItems.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.request?.url?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      responseFilter === 'all' ||
      getStatusCategory(item.response?.status_code) === responseFilter;
    return matchesSearch && matchesFilter;
  });

  const buildRawHttpMessage = (headers: Record<string, string>, body: string) => {
    const headerText = Object.entries(headers || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    return `${headerText}\n\n${body || ''}`;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <div className="w-1/3 border-r border-zinc-800 overflow-y-auto bg-zinc-950 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em] shrink-0">
          Proxy_Vault
        </div>

        {/* Search & Filter */}
        <div className="p-3 border-b border-zinc-800 space-y-3 bg-zinc-900/30 shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 p-2 pl-8 rounded text-zinc-300 outline-none focus:border-sky-500 transition-colors text-[11px] font-mono"
            />
            <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300">✕</button>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(['all', 'success', 'redirect', 'error'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setResponseFilter(filter)}
                className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest rounded transition-all whitespace-nowrap ${responseFilter === filter ? 'bg-sky-600 text-white' : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-zinc-300'}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-zinc-600 text-[10px] uppercase tracking-widest mt-4">No items</div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`cursor-pointer hover:bg-zinc-800/50 transition-colors border-l-2 ${selectedId === item.id ? 'bg-zinc-800/50 border-sky-500' : 'border-transparent'}`}
                >
                  <div className="p-3 space-y-1.5 flex flex-col min-w-0">
                    <div className="text-zinc-300 font-bold truncate w-full" title={item.name}>
                      {item.name}
                    </div>
                    <div className="text-zinc-500 text-xs truncate w-full" title={item.request?.url}>
                      {item.request?.url}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] uppercase font-black tracking-wider">
                      <span className={item.request?.method === 'GET' ? 'text-sky-400' : item.request?.method === 'POST' ? 'text-emerald-400' : 'text-amber-400'}>
                        {item.request?.method || 'GET'}
                      </span>
                      <span className={`${(item.response?.status_code ?? 0) >= 400 ? 'text-rose-400' : (item.response?.status_code ?? 0) >= 300 ? 'text-amber-400' : item.response ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {item.response?.status_code ?? 'NO_RES'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <div className="flex-1 overflow-y-auto bg-zinc-950 p-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="max-w-5xl mx-auto space-y-8">

              <header className="flex justify-between items-start border-b border-zinc-800 pb-4">
                <div className="space-y-1">
                  <h3 className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest">// TARGET_URL</h3>
                  <div className="text-emerald-100 break-all bg-zinc-900/50 p-2 rounded border border-zinc-800/50">{selected.request?.url || 'N/A'}</div>
                </div>
                <div className="flex gap-2 items-start">
                  <button 
                    onClick={() => onSendToRepeater?.(selected)} 
                    className="px-3 py-1.5 bg-purple-900/30 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] rounded border border-purple-800 transition-all uppercase font-black whitespace-nowrap"
                  >
                    Send_to_Repeater
                  </button>
                  <button 
                    onClick={() => handleDelete(selected.id)} 
                    className="px-3 py-1.5 bg-rose-900/30 hover:bg-rose-600 text-rose-400 hover:text-white text-[10px] rounded border border-rose-800 transition-all uppercase font-black whitespace-nowrap"
                  >
                    Delete
                  </button>
                </div>
              </header>

              <div className="flex flex-col gap-10 pb-12">
                <div className="space-y-4">
                  <h3 className="text-sky-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="opacity-50">#</span> Request_Payload
                  </h3>
                  {selected.request ? (
                    <HttpResponseViewer text={buildRawHttpMessage(selected.request.headers || {}, selected.request.body || '')} />
                  ) : (
                    <div className="h-[200px] flex items-center justify-center border border-zinc-800 border-dashed rounded bg-zinc-900/20 text-zinc-600 text-[10px] uppercase tracking-widest">
                      Not Saved
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-amber-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="opacity-50">#</span> Response_Payload
                  </h3>
                  {selected.response ? (
                    <HttpResponseViewer text={buildRawHttpMessage(selected.response.headers || {}, selected.response.body || '')} />
                  ) : (
                    <div className="h-[200px] flex items-center justify-center border border-zinc-800 border-dashed rounded bg-zinc-900/20 text-zinc-600 text-[10px] uppercase tracking-widest">
                      Not Saved
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center opacity-30 select-none">
            <div className="text-[60px] font-black tracking-tighter text-zinc-700">VAULT_LOCKED</div>
            <div className="text-[10px] uppercase tracking-[0.3em] mt-2">Select an entry to view</div>
          </div>
        )}
      </div>
    </div>
  );
}
