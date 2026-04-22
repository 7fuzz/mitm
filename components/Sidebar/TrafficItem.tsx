import { memo } from 'react';
import { Traffic } from '@/types/traffic';

interface Props {
  item: Traffic;
  isActive: boolean;
  onClick: (id: string) => void;
}

export const TrafficItem = memo(({ item, isActive, onClick }: Props) => {
  const methodColor = item.method === 'POST' ? 'text-amber-500' : 'text-sky-500';
  const statusColor = item.status_code < 400 ? 'text-emerald-500' : 'text-rose-500';

  return (
    <div
      onClick={() => onClick(item.id)}
      className={`group p-3 border-b border-zinc-900 cursor-pointer transition-colors hover:bg-zinc-900/80 ${isActive ? 'bg-zinc-900 border-l-2 border-l-emerald-500' : 'border-l-2 border-l-transparent'
        }`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className={`font-black text-[10px] tracking-tighter uppercase ${methodColor}`}>
          {item.method}
        </span>
        <span className={`font-mono text-[10px] font-bold ${statusColor}`}>
          {item.status_code}
        </span>
      </div>
      <div className="text-[11px] font-medium text-zinc-400 truncate group-hover:text-zinc-200">
        {item.host}
      </div>
      <div className="text-[9px] text-zinc-600 truncate italic">
        {item.url.split(item.host)[1] || '/'}
      </div>
    </div>
  );
});

TrafficItem.displayName = 'TrafficItem';
