import { useState } from 'react';
import { Traffic } from '@/types/traffic';
import { TrafficList } from '../Sidebar/TrafficList';
import { WorkspaceLayout } from '../Layout/WorkspaceLayout';
import { UrlEditor } from '../Editor/UrlEditor';
import HttpResponseViewer from '../ui/HttpResponseViewer';
import { useTraffic } from '@/hooks/traffic';
import { useNotification } from '../ui/NotificationProvider';
import { Button } from '../ui/Button';

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
    refreshRepeater, setRepeaterSelectedId,
    applyAllReplacements,
    simpleMode
  } = useTraffic();

  const { notify } = useNotification();

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

  const handleDeleteHistoryRequest = (id: string) => {
    setTraffic(traffic.filter(t => t.id !== id));
    if (selectedId === id) setSelectedId(null);
    fetch(`/api/history/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const handleClearHistory = () => {
    setTraffic([]); setSelectedId(null);
    fetch('/api/history', { method: 'DELETE' }).catch(console.error);
  };

  const handleAddToRepeater = async (req: Traffic, raw: boolean = false) => {
    try {
      let path = req.url;
      try { path = new URL(req.url).pathname; } catch { }

      const isRaw = simpleMode || raw;

      const { url: transformedUrl, headers: transformedHeaders, body: transformedBody } = isRaw
        ? { url: req.url, headers: req.request_headers || {}, body: req.request_body || '' }
        : applyAllReplacements({ url: req.url, headers: req.request_headers || {}, body: req.request_body || '' });

      const response = await fetch(`/api/repeater-request${isRaw ? '?raw=true' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${req.method} ${path}`,
          group: isRaw ? 'Raw Imports' : 'History Imports',
          method: req.method,
          url: transformedUrl,
          headers: transformedHeaders,
          body: transformedBody,
          response: req.status_code !== 0 ? {
            status: req.status_code,
            headers: req.response_headers || {},
            body: req.response_body || '',
          } : undefined
        })
      });

      const data = await response.json();
      if (data.success || data.id) {
        if (refreshRepeater) await refreshRepeater();
        if (setRepeaterSelectedId) setRepeaterSelectedId(data.id);
        notify.success(isRaw ? `Staged Raw to Repeater!` : `Staged to Repeater!`);
      }
    } catch (error) {
      notify.error(`Error sending to Repeater: ` + error);
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
            <Button
              variant={isLimitEnabled ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsLimitEnabled(!isLimitEnabled)}
              className={!isLimitEnabled ? 'border-dashed border-zinc-700' : ''}
            >
              {isLimitEnabled ? 'Limit: ON' : 'Limit: OFF'}
            </Button>

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

            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest ml-2 mr-2">
              Total: {traffic.length}
            </span>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm('Clear all history? This cannot be undone.')) {
                  handleClearHistory();
                }
              }}
            >
              Clear_History
            </Button>
          </>
        }

        mainContent={(splitMode) => (
          selectedReq ? (
            <div className={`w-full mx-auto pb-24 space-y-10 ${splitMode === 'horizontal' ? 'max-w-360' : 'max-w-5xl'}`}>
              <header className="flex flex-col items-start border-b border-zinc-800 pb-6">
                <div className="ml-auto flex gap-3 mb-4">
                  <Button
                    variant="purple"
                    size="sm"
                    onClick={() => handleAddToRepeater(selectedReq, false)}
                  >
                    Send_to_Repeater
                  </Button>
                  
                  {!simpleMode && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAddToRepeater(selectedReq, true)}
                    >
                      Raw
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={copyAsCurl}
                    className="hover:bg-emerald-600 hover:border-emerald-500"
                  >
                    Copy_as_cURL
                  </Button>
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
    </>
  );
}
