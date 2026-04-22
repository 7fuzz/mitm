import { memo } from 'react';

interface Props {
  id: string;
  method: string;
  status: number; // 0 for pending/unsent
  title: string;
  isIntercepted?: boolean;
  isActive: boolean;
  activeColor?: 'emerald' | 'purple' | 'sky';
  onClick: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const TrafficItem = memo(({
  id, method, status, title, isIntercepted, isActive, activeColor = 'emerald', onClick, onDelete
}: Props) => {

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

  const activeBorder =
    activeColor === 'purple' ? 'border-purple-500' :
      activeColor === 'sky' ? 'border-sky-500' :
        'border-emerald-500';

  return (
    <div
      onClick={() => onClick(id)}
      className={`cursor-pointer hover:bg-zinc-800/50 transition-colors border-l-2 group ${isActive ? `bg-zinc-800/50 ${activeBorder}` : 'border-transparent'
        } ${isIntercepted ? 'border-rose-500 bg-rose-500/5' : ''}`}
    >
      <div className="p-3 space-y-1.5 flex flex-col min-w-0">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-wider shrink-0">
            <span className={getMethodColor(method)}>{method}</span>
            <span className={getStatusColor(status)}>
              {status === 0 ? (isIntercepted ? 'PAUSED' : 'PENDING') : status}
            </span>
          </div>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="p-1 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded opacity-0 group-hover:opacity-100 transition-all"
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
        <div className="text-zinc-300 text-xs truncate w-full" title={title}>
          {title}
        </div>
      </div>
    </div>
  );
});

TrafficItem.displayName = 'TrafficItem';
