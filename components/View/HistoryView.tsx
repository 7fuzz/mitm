import { useEffect, useState } from 'react';
import { Traffic } from '@/types/traffic';
import { TrafficList } from '../Sidebar/TrafficList';
import HttpResponseViewer from '../ui/HttpResponseViewer';
import { SaveModal } from '../ui/SaveModal';
import { UrlEditor } from '../Editor/UrlEditor';
import { WorkspaceLayout } from '../Layout/WorkspaceLayout';
import { useTraffic } from '@/hooks/useTraffic';

const buildRawHttpMessage = (headers: Record<string, string>, body: string) => {
  const headerText = Object.entries(headers || {}).map(([key, value]) => `${key}: ${value}`).join('\n');
  return `${headerText}\n\n${body || ''}`;
};

export function HistoryView() {
  const {
    traffic, setTraffic, selectedReq, selectedId, setSelectedId,
    historyLimit, setHistoryLimit, isLimitEnabled, setIsLimitEnabled,
    uiLayout, updateUILayout,
    repeaterRequests, setRepeaterRequests, setRepeaterSelectedId
  } = useTraffic();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [localLimit, setLocalLimit] = useState(historyLimit.toString());

  useEffect(() => setLocalLimit(historyLimit.toString()), [historyLimit]);

  const handleLimitCommit = () => {
    const val = Number(localLimit);
    if (!isNaN(val) && val > 0) setHistoryLimit(val);
    else setLocalLimit(historyLimit.toString());
  };

  const handleSaveToVault = async (data: any) => {
    await fetch('/api/saved', { method: 'POST', body: JSON.stringify(data) });
    setShowSaveModal(false);
  };

  const handleDeleteHistoryRequest = (id: string) => {
    setTraffic(traffic.filter(t => t.id !== id));
    if (selectedId === id) setSelectedId(null);
    fetch(`/api/history/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const handleClearHistory = () => {
    setTraffic([]); setSelectedId(null);
    fetch('/api/history', { method: 'DELETE' }).catch(console.error);
  };

  const handleAddToRepeater = (req: Traffic) => {
    const newId = crypto.randomUUID();
    const newReq = {
      id: newId,
      name: `${req.method} ${new URL(req.url).pathname}`,
      method: req.method,
      url: req.url,
      headers: req.request_headers || {},
      body: req.request_body || '',
      timestamp: Date.now(),
    };
    setRepeaterRequests([...repeaterRequests, newReq]);
    if (setRepeaterSelectedId) setRepeaterSelectedId(newId);
    alert('Sent to Repeater!');
  };

  const copyAsCurl = () => {
    if (!selectedReq) return;
    const curl = `curl -X ${selectedReq.method} '${selectedReq.url}' ${Object.entries(selectedReq.request_headers).map(([k, v]) => `-H '${k}: ${v}'`).join(' ')}`;
    navigator.clipboard.writeText(curl);
  };

  return (
    <>
      <WorkspaceLayout
        uiLayout={uiLayout}
        onUpdateLayout={updateUILayout}
        listComponent={(layout) => (
          <TrafficList items={traffic} activeId={selectedId} onSelect={setSelectedId} onDelete={handleDeleteHistoryRequest} layout={layout === 'sidebar' ? 'sidebar' : 'table'} />
        )}

        toolbarRight={
          <>
            {/* RESTORED: Your preferred Limiter UI */}
            <button
              onClick={() => setIsLimitEnabled(!isLimitEnabled)}
              className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded transition-all border ${isLimitEnabled ? 'bg-zinc-800 border-zinc-600 text-zinc-300' : 'bg-transparent border-dashed border-zinc-700 text-zinc-600 hover:text-zinc-400'}`}
            >
              {isLimitEnabled ? 'Limit: ON' : 'Limit: OFF'}
            </button>

            {isLimitEnabled && (
              <div className="flex items-center gap-2 mr-2">
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

            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest ml-2 mr-2">
              Total: {traffic.length}
            </span>

            <button
              onClick={() => {
                if (confirm('Clear all history? This cannot be undone.')) {
                  handleClearHistory();
                }
              }}
              className="text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded transition-all border bg-rose-900/30 border-rose-800 text-rose-400 hover:bg-rose-600 hover:text-white"
            >
              Clear_History
            </button>
          </>
        }

        mainContent={(splitMode) => (
          selectedReq ? (
            <div className={`w-full mx-auto pb-24 space-y-10 ${splitMode === 'horizontal' ? 'max-w-[90rem]' : 'max-w-5xl'}`}>
              <header className="flex flex-col items-start border-b border-zinc-800 pb-6">
                <div className="ml-auto flex gap-3 mb-4">
                  <button onClick={() => setShowSaveModal(true)} className="px-4 py-2 bg-sky-900/30 hover:bg-sky-600 text-sky-400 hover:text-white text-[10px] rounded border border-sky-800 transition-all uppercase font-bold">Save_to_Vault</button>
                  <button onClick={() => handleAddToRepeater(selectedReq)} className="px-4 py-2 bg-purple-900/30 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] rounded border border-purple-800 transition-all uppercase font-bold">Send_to_Repeater</button>
                  <button onClick={copyAsCurl} className="px-3 py-1 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white text-[10px] rounded border border-zinc-700 transition-all uppercase font-bold">Copy_as_cURL</button>
                </div>
                <div className="w-full">
                  <UrlEditor method={selectedReq.method} url={selectedReq.url} readOnly={true} />
                </div>
              </header>

              <div className={`grid ${splitMode === 'horizontal' ? 'grid-cols-2 gap-8' : 'grid-cols-1 gap-10'}`}>
                <div className="flex flex-col space-y-3">
                  <h3 className="text-sky-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> Request_Payload</h3>
                  <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-[400px]">
                    <HttpResponseViewer text={buildRawHttpMessage(selectedReq.request_headers, selectedReq.request_body)} />
                  </div>
                </div>

                <div className="flex flex-col space-y-3">
                  <h3 className="text-amber-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> Response_Payload</h3>
                  <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-[400px]">
                    {selectedReq.status_code === 0 ? (
                      <div className="h-full flex items-center justify-center text-zinc-600 text-[10px] uppercase tracking-widest">Awaiting Response...</div>
                    ) : (
                      <HttpResponseViewer text={buildRawHttpMessage(selectedReq.response_headers, selectedReq.response_body)} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[60vh] opacity-20 grayscale pointer-events-none select-none">
              <div className="text-[40px] font-black tracking-tighter">HISTORY_IDLE</div>
            </div>
          )
        )}
      />
      {showSaveModal && <SaveModal req={selectedReq} onClose={() => setShowSaveModal(false)} onSave={handleSaveToVault} />}
    </>
  );
}
