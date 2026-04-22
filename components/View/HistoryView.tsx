import { useEffect, useState } from 'react';
import { Traffic } from '@/types/traffic';
import { TrafficList } from '../Sidebar/TrafficList';
import { TrafficDetail } from '../Inspector/TrafficDetail';

interface Props {
  traffic: Traffic[];
  selectedReq: Traffic | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  isLimitEnabled: boolean;
  setIsLimitEnabled: (enabled: boolean) => void;
  historyLimit: number;
  setHistoryLimit: (limit: number) => void;
  onSendToRepeater: (req: any) => void;
  onDeleteRequest: (id: string) => void;
  onClearHistory: () => void;
}

export function HistoryView({
  traffic, selectedReq, selectedId, setSelectedId,
  isLimitEnabled, setIsLimitEnabled, historyLimit, setHistoryLimit,
  onSendToRepeater, onDeleteRequest, onClearHistory
}: Props) {
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(true);

  // === Local Input State ===
  const [localLimit, setLocalLimit] = useState(historyLimit.toString());

  // Keep local state synced if the DB changes the limit in the background
  useEffect(() => {
    setLocalLimit(historyLimit.toString());
  }, [historyLimit]);

  // Only apply the limit when the user is done typing
  const handleLimitCommit = () => {
    const val = Number(localLimit);
    if (!isNaN(val) && val > 0) {
      setHistoryLimit(val);
    } else {
      setLocalLimit(historyLimit.toString()); // Revert to safe value if they typed garbage
    }
  };

  return (
    <>
      <div className={`${isHistorySidebarOpen ? 'w-1/3 border-r' : 'w-0 border-r-0'} border-zinc-800 transition-all duration-300 flex flex-col overflow-hidden bg-zinc-950`}>
        <div className="min-w-[300px] flex-1 flex flex-col h-full">
          <TrafficList items={traffic} activeId={selectedId} onSelect={setSelectedId} onDelete={onDeleteRequest} />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/20 shrink-0">
          <button onClick={() => setIsHistorySidebarOpen(!isHistorySidebarOpen)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            {isHistorySidebarOpen ? 'Hide_List' : 'Show_List'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLimitEnabled(!isLimitEnabled)}
              className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1.5 rounded transition-all border ${isLimitEnabled ? 'bg-zinc-800 border-zinc-600 text-zinc-300' : 'bg-transparent border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400'}`}
            >
              {isLimitEnabled ? 'Limit: ON' : 'Limit: OFF'}
            </button>

            {isLimitEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Max:</span>

                {/* === UPGRADED: Isolated Input with Commit Triggers === */}
                <input
                  type="number"
                  value={localLimit}
                  onChange={(e) => setLocalLimit(e.target.value)}
                  onBlur={handleLimitCommit}
                  onKeyDown={(e) => e.key === 'Enter' && handleLimitCommit()}
                  className="w-16 bg-zinc-950 border border-zinc-700 text-emerald-400 text-[10px] font-bold tracking-widest p-1.5 rounded outline-none focus:border-emerald-500 text-center"
                />
              </div>
            )}

            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest ml-4">
              Total: {traffic.length}
            </span>

            <button
              onClick={() => {
                if (confirm('Clear all history? This cannot be undone.')) {
                  onClearHistory();
                }
              }}
              className="text-[10px] uppercase font-bold tracking-widest px-2 py-1.5 rounded transition-all border bg-rose-900/30 border-rose-800 text-rose-400 hover:bg-rose-600 hover:text-white ml-2"
            >
              Clear_History
            </button>
          </div>
        </div>

        {selectedReq ? (
          <TrafficDetail req={selectedReq} onSendToRepeater={onSendToRepeater} />
        ) : (
          <div className="flex-1 flex items-center justify-center opacity-20 grayscale pointer-events-none select-none">
            <div className="text-center space-y-4">
              <div className="text-[40px] font-black tracking-tighter">HISTORY_IDLE</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
