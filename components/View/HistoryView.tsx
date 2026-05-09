import { useState } from 'react';
import { Traffic } from '@/types/traffic';
import { TrafficList } from '../Sidebar/TrafficList';
import { WorkspaceLayout } from '../Layout/WorkspaceLayout';
import { UrlEditor } from '../Editor/UrlEditor';
import HttpResponseViewer from '../ui/HttpResponseViewer';
import { useTraffic } from '@/hooks/traffic';
import { SaveModal } from '../ui/SaveModal'; // Assuming you have this
import { useNotification } from '../ui/NotificationProvider';

// === NEW: HTTP Formatters for the Viewer ===
const buildRawRequestMessage = (req: Traffic) => {
  let path = req.url;
  try {
    const parsed = new URL(req.url);
    path = parsed.pathname + parsed.search + parsed.hash;
  } catch { }
  const firstLine = `${req.method} ${path} HTTP/1.1`;
  const headerText = Object.entries(req.request_headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `${firstLine}\n${headerText}\n\n${req.request_body || ''}`;
};

const buildRawResponseMessage = (req: Traffic) => {
  const firstLine = `HTTP/1.1 ${req.status_code}`;
  const headerText = Object.entries(req.response_headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `${firstLine}\n${headerText}\n\n${req.response_body || ''}`;
};

export function HistoryView() {
  const {
    traffic, setTraffic, selectedReq, selectedId, setSelectedId,
    historyLimit, setHistoryLimit, isLimitEnabled, setIsLimitEnabled,
    uiLayout, updateUILayout,
    // NEW: Destructure the safe repeater functions instead of raw setters
    refreshRepeater, setRepeaterSelectedId,
    // NEW: Get replacement apply functions
    applyUrlReplacements, applyHeaderReplacements, applyBodyReplacements,
    simpleMode
  } = useTraffic();

  const { notify } = useNotification();

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [localLimit, setLocalLimit] = useState(historyLimit.toString());
  const [prevHistoryLimit, setPrevHistoryLimit] = useState(historyLimit);

  if (historyLimit !== prevHistoryLimit) {
    setPrevHistoryLimit(historyLimit);
    setLocalLimit(historyLimit.toString());
  }

  const handleLimitCommit = () => {
    const val = Number(localLimit);
    if (!isNaN(val) && val > 0) setHistoryLimit(val);
    else setLocalLimit(historyLimit.toString());
  };

  const handleSaveToVault = async (data: unknown) => {
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

  // === UPGRADED: Network-safe Workbench Injection ===
  const handleAddToRepeater = async (req: Traffic, raw: boolean = false) => {
    try {
      let path = req.url;
      try { path = new URL(req.url).pathname; } catch { }

      // Simple Mode: ALWAYS raw send
      const isRaw = simpleMode || raw;

      // Apply replacements to URL, headers, and body only if not raw mode
      const transformedUrl = isRaw ? req.url : applyUrlReplacements(req.url);
      const transformedHeaders = isRaw ? (req.request_headers || {}) : applyHeaderReplacements(req.request_headers || {});
      const transformedBody = isRaw ? (req.request_body || '') : applyBodyReplacements(req.request_body || '');

      const response = await fetch(`/api/repeater-request${isRaw ? '?raw=true' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${req.method} ${path}`,
          group: isRaw ? 'Raw Imports' : 'History Imports', // Groups it cleanly!
          method: req.method,
          url: transformedUrl,
          headers: transformedHeaders,
          body: transformedBody,
        })
      });

      const data = await response.json();
      if (data.success || data.id) {
        if (refreshRepeater) await refreshRepeater();
        if (setRepeaterSelectedId) setRepeaterSelectedId(data.id);
        notify.success(isRaw ? 'Staged Raw to Workbench!' : 'Staged to Workbench!');
      }
    } catch (error) {
      notify.error('Error sending to Workbench: ' + error);
    }
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
        listComponent={() => (
          <TrafficList items={traffic} activeId={selectedId} onSelect={setSelectedId} onDelete={handleDeleteHistoryRequest} layout="sidebar" />
        )}

        toolbarRight={
          <>
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
            <div className={`w-full mx-auto pb-24 space-y-10 ${splitMode === 'horizontal' ? 'max-w-360' : 'max-w-5xl'}`}>
              <header className="flex flex-col items-start border-b border-zinc-800 pb-6">
                <div className="ml-auto flex gap-3 mb-4">
                  <button onClick={() => setShowSaveModal(true)} className="px-4 py-2 bg-sky-900/30 hover:bg-sky-600 text-sky-400 hover:text-white text-[10px] rounded border border-sky-800 transition-all uppercase font-bold">Save_to_Vault</button>
                  <button onClick={() => handleAddToRepeater(selectedReq, false)} className="px-4 py-2 bg-purple-900/30 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] rounded border border-purple-800 transition-all uppercase font-bold">Send_to_Workbench</button>
                  {!simpleMode && <button onClick={() => handleAddToRepeater(selectedReq, true)} className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] rounded border border-zinc-700 transition-all uppercase font-bold">Raw</button>}
                  <button onClick={copyAsCurl} className="px-3 py-1 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white text-[10px] rounded border border-zinc-700 transition-all uppercase font-bold">Copy_as_cURL</button>
                </div>
                <div className="w-full">
                  <UrlEditor method={selectedReq.method} onMethodChange={() => { }} url={selectedReq.url} onChange={() => { }} readOnly={true} />
                </div>
              </header>

              <div className={`grid ${splitMode === 'horizontal' ? 'grid-cols-2 gap-8' : 'grid-cols-1 gap-10'}`}>
                <div className="flex flex-col space-y-3">
                  <h3 className="text-sky-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> Request_Payload</h3>
                  <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-100">
                    <HttpResponseViewer text={buildRawRequestMessage(selectedReq)} />
                  </div>
                </div>

                <div className="flex flex-col space-y-3">
                  <h3 className="text-amber-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><span className="opacity-50">#</span> Response_Payload</h3>
                  <div className="flex-1 bg-zinc-900/20 border border-zinc-800/50 rounded overflow-hidden min-h-100">
                    {selectedReq.status_code === 0 ? (
                      <div className="h-full flex items-center justify-center text-zinc-600 text-[10px] uppercase tracking-widest">Awaiting Response...</div>
                    ) : (
                      <HttpResponseViewer text={buildRawResponseMessage(selectedReq)} />
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
