import { useState } from 'react';
import { Traffic } from '@/types/traffic';

interface Props {
  items: Traffic[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function TrafficList({ items, activeId, onSelect }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');

  // Filter the items dynamically based on search and method selection
  const filteredItems = items.filter(t => {
    const matchesSearch = t.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = methodFilter === 'ALL' || t.method.toUpperCase() === methodFilter;
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950">

      {/* Search & Filter Header */}
      <div className="p-3 border-b border-zinc-800 space-y-3 bg-zinc-900/30 shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Search URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 p-2 pl-8 rounded text-zinc-300 outline-none focus:border-emerald-500 transition-colors text-[11px] font-mono"
          />
          <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>

          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300">✕</button>
          )}
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].map((method) => (
            <button
              key={method}
              onClick={() => setMethodFilter(method)}
              className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest rounded transition-all whitespace-nowrap ${methodFilter === method
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* The List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-4 text-center text-zinc-600 text-[10px] uppercase tracking-widest mt-4">
            No requests found
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filteredItems.map((req) => (
              <div
                key={req.id}
                onClick={() => onSelect(req.id)}
                className={`cursor-pointer hover:bg-zinc-800/50 transition-colors border-l-2 ${activeId === req.id ? 'bg-zinc-800/50 border-emerald-500' : 'border-transparent'
                  } ${req.is_intercepted ? 'border-rose-500 bg-rose-500/5' : ''}`}
              >
                <div className="p-3 space-y-1.5 flex flex-col min-w-0">
                  <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-wider shrink-0">
                    <span className={req.method === 'GET' ? 'text-sky-400' : req.method === 'POST' ? 'text-emerald-400' : 'text-amber-400'}>
                      {req.method}
                    </span>
                    <span className={`${req.status_code >= 400 ? 'text-rose-400' : req.status_code >= 300 ? 'text-amber-400' : req.status_code === 0 ? 'text-zinc-600' : 'text-zinc-400'}`}>
                      {req.status_code === 0 ? 'PENDING' : req.status_code}
                    </span>
                    {req.is_intercepted && (
                      <span className="ml-auto text-[8px] bg-rose-500/20 text-rose-500 px-1 rounded animate-pulse">Paused</span>
                    )}
                  </div>
                  <div className="text-zinc-300 text-xs truncate w-full" title={req.url}>
                    {req.url}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
