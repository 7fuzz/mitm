import { useState } from 'react';
import { Traffic } from '@/types/traffic';
import { MultiSelectFilter, FilterState } from '../ui/MultiSelectFilter';
import { TrafficItem } from './TrafficItem';

interface Props {
  items: Traffic[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const STATUS_FILTERS = ['1XX', '2XX', '3XX', '4XX', '5XX', 'PENDING'];

function getStatusCategory(status: number): string {
  if (status === 0) return 'PENDING';
  if (status < 200) return '1XX';
  if (status < 300) return '2XX';
  if (status < 400) return '3XX';
  if (status < 500) return '4XX';
  return '5XX';
}

export function TrafficList({ items, activeId, onSelect, onDelete }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<Record<string, FilterState>>({});
  const [statusFilter, setStatusFilter] = useState<Record<string, FilterState>>({});
  const [showFilters, setShowFilters] = useState(true);

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


  // Filter the items dynamically based on search and filters
  const filteredItems = items.filter(t => {
    const matchesSearch = t.url.toLowerCase().includes(searchTerm.toLowerCase());

    // Method filtering logic
    const methodIncludes = Object.entries(methodFilter)
      .filter(([_, state]) => state === 'include')
      .map(([method, _]) => method);
    const methodExcludes = Object.entries(methodFilter)
      .filter(([_, state]) => state === 'exclude')
      .map(([method, _]) => method);

    let matchesMethod = true;
    if (methodIncludes.length > 0) {
      matchesMethod = methodIncludes.includes(t.method.toUpperCase());
    }
    if (matchesMethod && methodExcludes.length > 0) {
      matchesMethod = !methodExcludes.includes(t.method.toUpperCase());
    }

    // Status filtering logic
    const statusCat = getStatusCategory(t.status_code);
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

  return (
    <div className="flex flex-col h-full bg-zinc-950">

      {/* Search & Filter Header */}
      <div className="p-3 border-b border-zinc-800 space-y-3 bg-zinc-900/30 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
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

      {/* The List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-4 text-center text-zinc-600 text-[10px] uppercase tracking-widest mt-4">
            No requests found
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filteredItems.map((req) => (
              <TrafficItem
                key={req.id}
                id={req.id}
                method={req.method}
                status={req.status_code}
                title={req.url}
                isIntercepted={req.is_intercepted}
                isActive={activeId === req.id}
                activeColor="emerald"
                onClick={onSelect}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
