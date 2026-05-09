import { useState } from 'react';
import { Traffic } from '@/types/traffic';
import { MultiSelectFilter, FilterState } from '../ui/MultiSelectFilter';
import { TrafficItem } from './TrafficItem';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TrafficListProps {
  items: Traffic[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onReorder?: (newIds: string[]) => void;
  activeColor?: 'emerald' | 'purple' | 'sky';
  layout?: 'sidebar' | 'table';
}

function SortableTrafficItem({ req, activeId, activeColor, onSelect, onDelete }: { req: Traffic, activeId: string | null, activeColor: 'emerald' | 'purple' | 'sky', onSelect: (id: string) => void, onDelete?: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: req.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <TrafficItem id={req.id} method={req.method} status={req.status_code} title={req.url} group={req.group} isIntercepted={req.is_intercepted} isActive={activeId === req.id} activeColor={activeColor} onClick={onSelect} onDelete={onDelete} />
    </div>
  );
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

const getSafeHostname = (url: string, host: string) => {
  if (host) return host;
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const getMethodColor = (m: string) => {
  if (m === 'GET') return 'text-sky-400';
  if (m === 'POST') return 'text-emerald-400';
  if (m === 'DELETE') return 'text-rose-400';
  if (m === 'PUT' || m === 'PATCH') return 'text-amber-400';
  return 'text-purple-400';
};

const getStatusColor = (s: number) => {
  if (s === 0) return 'text-zinc-600';
  if (s < 300) return 'text-emerald-500';
  if (s < 400) return 'text-amber-500';
  return 'text-rose-500';
};

export function TrafficList({ items, activeId, onSelect, onDelete, onReorder, activeColor = 'emerald', layout = 'sidebar' }: TrafficListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<Record<string, FilterState>>({});
  const [statusFilter, setStatusFilter] = useState<Record<string, FilterState>>({});
  const [showFilters, setShowFilters] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && onReorder) {
      const oldIndex = filteredItems.findIndex(i => i.id === active.id);
      const newIndex = filteredItems.findIndex(i => i.id === over.id);
      const newItems = arrayMove(filteredItems, oldIndex, newIndex);
      onReorder(newItems.map(i => i.id));
    }
  };

  const toggleMethod = (method: string) => setMethodFilter(prev => ({ ...prev, [method]: prev[method] === undefined ? 'include' : prev[method] === 'include' ? 'exclude' : undefined }));
  const toggleStatus = (status: string) => setStatusFilter(prev => ({ ...prev, [status]: prev[status] === undefined ? 'include' : prev[status] === 'include' ? 'exclude' : undefined }));

  const filteredItems = items.filter(req => {
    const matchesSearch = req.url.toLowerCase().includes(searchTerm.toLowerCase());

    const methodIncludes = Object.entries(methodFilter).filter(([_, state]) => state === 'include').map(([method]) => method);
    const methodExcludes = Object.entries(methodFilter).filter(([_, state]) => state === 'exclude').map(([method]) => method);
    let matchesMethod = true;
    if (methodIncludes.length > 0) matchesMethod = methodIncludes.includes(req.method.toUpperCase());
    if (matchesMethod && methodExcludes.length > 0) matchesMethod = !methodExcludes.includes(req.method.toUpperCase());

    const statusCat = getStatusCategory(req.status_code);
    const statusIncludes = Object.entries(statusFilter).filter(([_, state]) => state === 'include').map(([status]) => status);
    const statusExcludes = Object.entries(statusFilter).filter(([_, state]) => state === 'exclude').map(([status]) => status);
    let matchesStatus = true;
    if (statusIncludes.length > 0) matchesStatus = statusIncludes.includes(statusCat);
    if (matchesStatus && statusExcludes.length > 0) matchesStatus = !statusExcludes.includes(statusCat);

    return matchesSearch && matchesMethod && matchesStatus;
  });

  const activeBorder = activeColor === 'purple' ? 'border-l-purple-500' : activeColor === 'sky' ? 'border-l-sky-500' : 'border-l-emerald-500';

  return (
    <div className="flex flex-col h-full bg-zinc-950">

      {/* Search & Filter Bar */}
      <div className="p-3 border-b border-zinc-800 space-y-3 bg-zinc-900/30 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <input
              type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 p-2 pl-8 rounded text-zinc-300 outline-none focus:border-emerald-500 transition-colors text-[11px] font-mono"
            />
            <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300">✕</button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="px-2 py-1.5 text-[9px] uppercase font-bold tracking-widest rounded bg-zinc-900 text-zinc-400 border border-zinc-700 hover:text-zinc-200 hover:border-zinc-600 transition-all whitespace-nowrap">
            {showFilters ? 'Hide' : 'Show'} Filter
          </button>
        </div>

        {showFilters && (
          <div className={`flex ${layout === 'sidebar' ? 'flex-col gap-4' : 'gap-6'}`}>
            <div className="flex-1 w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
              <div className="text-[8px] uppercase text-zinc-600 font-black tracking-widest mb-1.5">Methods</div>
              <MultiSelectFilter options={METHODS} filterStates={methodFilter} onToggle={toggleMethod} onClear={() => setMethodFilter({})} />
            </div>
            <div className="flex-1 w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800">
              <div className="text-[8px] uppercase text-zinc-600 font-black tracking-widest mb-1.5">Response Status</div>
              <MultiSelectFilter options={STATUS_FILTERS} filterStates={statusFilter} onToggle={toggleStatus} onClear={() => setStatusFilter({})} />
            </div>
          </div>
        )}
      </div>

      {/* List / Table Render */}
      <div className="flex-1 overflow-auto relative">
        {filteredItems.length === 0 ? (
          <div className="p-4 text-center text-zinc-600 text-[10px] uppercase tracking-widest mt-4">No requests</div>
        ) : layout === 'table' ? (
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-widest z-10 shadow-sm">
              <tr>
                <th className="p-2 pl-4 font-bold">#</th>
                <th className="p-2 font-bold">Method</th>
                <th className="p-2 font-bold">Host</th>
                <th className="p-2 font-bold">Path</th>
                <th className="p-2 font-bold">Status</th>
                <th className="p-2 pr-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-xs font-mono text-zinc-300">
              {filteredItems.map((req, idx) => (
                <tr
                  key={req.id}
                  onClick={() => onSelect(req.id)}
                  className={`cursor-pointer hover:bg-zinc-800/50 transition-colors border-l-2 ${activeId === req.id ? `bg-zinc-800/80 ${activeBorder}` : 'border-l-transparent'} ${req.is_intercepted ? 'bg-rose-500/5' : ''}`}
                >
                  <td className="p-2 pl-4 text-zinc-600">{filteredItems.length - idx}</td>
                  <td className={`p-2 font-bold ${getMethodColor(req.method)}`}>{req.method}</td>
                  <td className="p-2 text-zinc-400">{getSafeHostname(req.url, req.host)}</td>
                  <td className="p-2 truncate max-w-xl" title={req.url}>{req.url}</td>
                  <td className={`p-2 font-bold ${getStatusColor(req.status_code)}`}>{req.status_code === 0 ? 'PENDING' : req.status_code}</td>
                  <td className="p-2 pr-4 text-right">
                    {onDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(req.id); }}
                        className="text-zinc-600 hover:text-rose-500 px-2 font-sans"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="absolute inset-0 overflow-y-auto divide-y divide-zinc-800/50">
            {onReorder ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  {filteredItems.map(req => (
                    <SortableTrafficItem key={req.id} req={req} activeId={activeId} activeColor={activeColor} onSelect={onSelect} onDelete={onDelete} />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              filteredItems.map(req => (
                <TrafficItem
                  key={req.id} id={req.id} method={req.method} status={req.status_code} title={req.url} group={req.group} isIntercepted={req.is_intercepted} isActive={activeId === req.id} activeColor={activeColor} onClick={onSelect} onDelete={onDelete}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
