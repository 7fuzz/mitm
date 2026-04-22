'use client';
import { useState } from 'react';
import { useTraffic } from '@/hooks/useTraffic';
import { TrafficList } from '@/components/Sidebar/TrafficList';
import { TrafficDetail } from '@/components/Inspector/TrafficDetail';
import { InterceptView } from '@/components/Intercept/InterceptView';
import { SavedView } from '@/components/Saved/SavedView';
import { RepeaterView, type RepeaterRequest } from '@/components/Repeater/RepeaterView';

export default function Page() {
  const {
    traffic, selectedReq, selectedId, setSelectedId,
    isIntercepting, interceptMode, ignoredMethods, updateConfig, resumeRequest,
    isLimitEnabled, setIsLimitEnabled, historyLimit, setHistoryLimit
  } = useTraffic();

  const [activeTab, setActiveTab] = useState<'history' | 'intercept' | 'saved' | 'repeater'>('history');
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState(true);
  const [repeaterRequests, setRepeaterRequests] = useState<RepeaterRequest[]>([]);

  const pendingCount = traffic.filter(t => t.is_intercepted).length;

  const handleAddToRepeater = (req: any) => {
    const repeaterReq: RepeaterRequest = {
      id: crypto.randomUUID(),
      name: `${req.method} ${new URL(req.url).pathname}`,
      method: req.method,
      url: req.url,
      headers: req.request_headers || {},
      body: req.request_body || '',
      timestamp: Date.now(),
    };
    setRepeaterRequests([...repeaterRequests, repeaterReq]);
    setActiveTab('repeater');
  };

  const handleUpdateRepeaterRequest = (id: string, updates: Partial<RepeaterRequest>) => {
    setRepeaterRequests(repeaterRequests.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleDeleteRepeaterRequest = (id: string) => {
    setRepeaterRequests(repeaterRequests.filter(r => r.id !== id));
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-300 font-mono text-sm overflow-hidden selection:bg-emerald-500/30">

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex gap-1 h-full">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 h-full flex items-center text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'history' ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
              }`}
          >
            HTTP_History
          </button>

          <button
            onClick={() => setActiveTab('intercept')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'intercept' ? 'border-rose-500 text-rose-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
              }`}
          >
            Intercept
            {pendingCount > 0 && (
              <span className="bg-rose-500 text-zinc-950 px-1.5 py-0.5 rounded text-[9px] animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'saved' ? 'border-sky-500 text-sky-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
              }`}
          >
            Proxy_Vault
          </button>

          <button
            onClick={() => setActiveTab('repeater')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'repeater' ? 'border-purple-500 text-purple-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
              }`}
          >
            Repeater
            {repeaterRequests.length > 0 && (
              <span className="bg-purple-500 text-zinc-950 px-1.5 py-0.5 rounded text-[9px]">
                {repeaterRequests.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Proxy_Active
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">

        {/* --- TAB: HISTORY --- */}
        {activeTab === 'history' && (
          <>
            <div className={`${isHistorySidebarOpen ? 'w-1/3 border-r' : 'w-0 border-r-0'} border-zinc-800 transition-all duration-300 flex flex-col overflow-hidden bg-zinc-950`}>
              <div className="min-w-[300px] flex-1 flex flex-col h-full">
                <TrafficList items={traffic} activeId={selectedId} onSelect={setSelectedId} />
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
                      <input
                        type="number"
                        value={historyLimit}
                        onChange={(e) => setHistoryLimit(Number(e.target.value) || 100)}
                        className="w-16 bg-zinc-950 border border-zinc-700 text-emerald-400 text-[10px] font-bold tracking-widest p-1.5 rounded outline-none focus:border-emerald-500 text-center"
                      />
                    </div>
                  )}

                  <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest ml-4">
                    Total: {traffic.length}
                  </span>
                </div>
              </div>

              {selectedReq ? (
                <TrafficDetail req={selectedReq} onSendToRepeater={handleAddToRepeater} />
              ) : (
                <div className="flex-1 flex items-center justify-center opacity-20 grayscale pointer-events-none select-none">
                  <div className="text-center space-y-4">
                    <div className="text-[40px] font-black tracking-tighter">HISTORY_IDLE</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* --- TAB: INTERCEPT --- */}
        {activeTab === 'intercept' && (
          <InterceptView
            traffic={traffic}
            isIntercepting={isIntercepting}
            interceptMode={interceptMode}
            ignoredMethods={ignoredMethods}
            updateConfig={updateConfig}
            onResume={resumeRequest}
          />
        )}

        {/* --- TAB: SAVED VAULT --- */}
        {activeTab === 'saved' && (
          <SavedView onSendToRepeater={(item) => {
            const repeaterReq: RepeaterRequest = {
              id: crypto.randomUUID(),
              name: item.name,
              method: item.request?.method || 'GET',
              url: item.request?.url || '',
              headers: item.request?.headers || {},
              body: item.request?.body || '',
              timestamp: Date.now(),
            };
            setRepeaterRequests([...repeaterRequests, repeaterReq]);
            setActiveTab('repeater');
          }} />
        )}

        {/* --- TAB: REPEATER --- */}
        {activeTab === 'repeater' && (
          <RepeaterView
            requests={repeaterRequests}
            onAddRequest={(req) => setRepeaterRequests([...repeaterRequests, req])}
            onUpdateRequest={handleUpdateRepeaterRequest}
            onDeleteRequest={handleDeleteRepeaterRequest}
          />
        )}

      </main>
    </div>
  );
}
