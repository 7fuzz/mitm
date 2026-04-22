import { useEffect, useState } from 'react';
import { Traffic } from '@/types/traffic';
import { TrafficList } from '../Sidebar/TrafficList';
import HttpResponseViewer from '../ui/HttpResponseViewer';
import { SaveModal } from '../ui/SaveModal';
import { UrlEditor } from '../Editor/UrlEditor';

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

// --- Helper: Stitches Headers and Body for the Viewer ---
const buildRawHttpMessage = (headers: Record<string, string>, body: string) => {
  const headerText = Object.entries(headers || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return `${headerText}\n\n${body || ''}`;
};

export function HistoryView({
  traffic, selectedReq, selectedId, setSelectedId,
  isLimitEnabled, setIsLimitEnabled, historyLimit, setHistoryLimit,
  onSendToRepeater, onDeleteRequest, onClearHistory
}: Props) {
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);

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

  // === Detail View Handlers ===
  const handleSaveToVault = async (data: any) => {
    await fetch('/api/saved', { method: 'POST', body: JSON.stringify(data) });
    setShowSaveModal(false);
  };

  const copyAsCurl = () => {
    if (!selectedReq) return;
    const curl = `curl -X ${selectedReq.method} '${selectedReq.url}' ${Object.entries(selectedReq.request_headers)
      .map(([k, v]) => `-H '${k}: ${v}'`)
      .join(' ')}`;
    navigator.clipboard.writeText(curl);
  };

  return (
    <>
      {/* Sidebar */}
      <div className={`${isHistorySidebarOpen ? 'w-1/3 border-r' : 'w-0 border-r-0'} border-zinc-800 transition-all duration-300 flex flex-col overflow-hidden bg-zinc-950`}>
        <div className="min-w-[300px] flex-1 flex flex-col h-full">
          <TrafficList items={traffic} activeId={selectedId} onSelect={setSelectedId} onDelete={onDeleteRequest} />
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
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

        {/* Content Area (Merged TrafficDetail) */}
        {selectedReq ? (
          <div className="flex-1 overflow-y-auto bg-zinc-950 p-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="max-w-5xl mx-auto space-y-8">

              <header className="flex flex-col items-start border-b border-zinc-800 pb-4">
                <div className="ml-auto flex gap-3">
                  <button onClick={() => setShowSaveModal(true)} className="px-4 py-2 bg-sky-900/30 hover:bg-sky-600 text-sky-400 hover:text-white text-[10px] rounded border border-sky-800 transition-all uppercase font-bold">
                    Save_to_Vault
                  </button>
                  <button
                    onClick={() => onSendToRepeater(selectedReq)}
                    className="px-4 py-2 bg-purple-900/30 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] rounded border border-purple-800 transition-all uppercase font-bold"
                  >
                    Send_to_Repeater
                  </button>
                  <button
                    onClick={copyAsCurl}
                    className="px-3 py-1 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white text-[10px] rounded border border-zinc-700 transition-all uppercase font-bold"
                  >
                    Copy_as_cURL
                  </button>
                </div>
                <div className="w-full mt-2">
                  <UrlEditor url={selectedReq.url} readOnly={true} />
                </div>
              </header>

              <div className="flex flex-col gap-10 pb-12">
                <div className="space-y-4">
                  <h3 className="text-sky-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="opacity-50">#</span> Request_Payload
                  </h3>
                  <HttpResponseViewer text={buildRawHttpMessage(selectedReq.request_headers, selectedReq.request_body)} />
                </div>

                <div className="space-y-4">
                  <h3 className="text-amber-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="opacity-50">#</span> Response_Payload
                  </h3>
                  {selectedReq.status_code === 0 ? (
                    <div className="h-[200px] flex items-center justify-center border border-zinc-800 border-dashed rounded bg-zinc-900/20 text-zinc-600 text-[10px] uppercase tracking-widest">
                      Awaiting Response...
                    </div>
                  ) : (
                    <HttpResponseViewer text={buildRawHttpMessage(selectedReq.response_headers, selectedReq.response_body)} />
                  )}
                </div>
              </div>

            </div>

            {showSaveModal && (
              <SaveModal
                req={selectedReq}
                onClose={() => setShowSaveModal(false)}
                onSave={handleSaveToVault}
              />
            )}

          </div>
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
