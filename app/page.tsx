'use client';
import { useState } from 'react';
import { useTraffic } from '@/hooks/useTraffic';
import { InterceptView } from '@/components/View/InterceptView';
import { SavedView } from '@/components/View/SavedView';
import { RepeaterView, type RepeaterRequest } from '@/components/View/RepeaterView';
import { HistoryView } from '@/components/View/HistoryView';
import { OptionsView } from '@/components/View/OptionsView';

export default function Page() {
  const {
    traffic, setTraffic, selectedReq, selectedId, setSelectedId, isIntercepting, interceptMode, ignoredMethods, updateConfig, resumeRequest,
    isLimitEnabled, setIsLimitEnabled, historyLimit, setHistoryLimit, repeaterRequests, setRepeaterRequests, prefs, updatePrefs,
  } = useTraffic();

  const [activeTab, setActiveTab] = useState<'history' | 'intercept' | 'saved' | 'repeater' | 'options'>('history');

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

  const handleDeleteHistoryRequest = (id: string) => {
    // 1. Optimistically update the UI
    setTraffic(traffic.filter(t => t.id !== id));
    if (selectedId === id) setSelectedId(null);

    // 2. Tell the SQLite Master DB to delete the row
    fetch(`/api/history/${id}`, { method: 'DELETE' }).catch(err =>
      console.error('Failed to delete history item:', err)
    );
  };

  const handleClearHistory = () => {
    // 1. Optimistically clear the UI
    setTraffic([]);
    setSelectedId(null);

    // 2. Tell the SQLite Master DB to drop the whole table
    // (Make sure this points to /api/history and NOT /api/traffic!)
    fetch('/api/history', { method: 'DELETE' }).catch(err =>
      console.error('Failed to clear history:', err)
    );
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

          <button
            onClick={() => setActiveTab('saved')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'saved' ? 'border-sky-500 text-sky-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
              }`}
          >
            Proxy_Vault
          </button>

          <button
            onClick={() => setActiveTab('options')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'options' ? 'border-orange-500 text-orange-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'
              }`}
          >
            Options
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
          <HistoryView
            traffic={traffic}
            selectedReq={selectedReq}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            isLimitEnabled={isLimitEnabled}
            setIsLimitEnabled={setIsLimitEnabled}
            historyLimit={historyLimit}
            setHistoryLimit={setHistoryLimit}
            onSendToRepeater={handleAddToRepeater}
            onDeleteRequest={handleDeleteHistoryRequest}
            onClearHistory={handleClearHistory}
          />
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
            onUpdateRequest={handleUpdateRepeaterRequest}
            onDeleteRequest={handleDeleteRepeaterRequest}
          />
        )}

        {activeTab === 'options' && (
          <OptionsView prefs={prefs} updatePrefs={updatePrefs} />
        )}

      </main>
    </div>
  );
}
