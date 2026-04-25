'use client';
import { useState } from 'react';
import { TrafficProvider, useTraffic } from '@/hooks/traffic';
import { InterceptView } from '@/components/View/InterceptView';
import { SavedView } from '@/components/View/SavedView';
import { RepeaterView } from '@/components/View/RepeaterView';
import { HistoryView } from '@/components/View/HistoryView';
import { OptionsView } from '@/components/View/OptionsView';

// ==========================================
// 1. THE OUTER WRAPPER (No Hooks Here!)
// ==========================================
export default function Page() {
  return (
    <TrafficProvider>
      <TrafficApp />
    </TrafficProvider>
  );
}

// ==========================================
// 2. THE INNER APP (Safe to use Context!)
// ==========================================
function TrafficApp() {
  // ✅ This now works perfectly because TrafficApp lives inside TrafficProvider!
  const { traffic, repeaterRequests } = useTraffic();

  const [activeTab, setActiveTab] = useState<'history' | 'intercept' | 'saved' | 'repeater' | 'options'>('history');

  const pendingCount = traffic.filter(t => t.is_intercepted).length;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-300 font-mono text-sm overflow-hidden selection:bg-emerald-500/30">

      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex gap-1 h-full">
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 h-full flex items-center text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'history' ? 'border-emerald-500 text-emerald-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
          >
            HTTP_History
          </button>

          <button
            onClick={() => setActiveTab('intercept')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'intercept' ? 'border-rose-500 text-rose-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
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
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'repeater' ? 'border-purple-500 text-purple-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
          >
            Workbench
            {repeaterRequests.length > 0 && (
              <span className="bg-purple-500 text-zinc-950 px-1.5 py-0.5 rounded text-[9px]">
                {repeaterRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('saved')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'saved' ? 'border-sky-500 text-sky-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
          >
            Proxy_Vault
          </button>

          <button
            onClick={() => setActiveTab('options')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'options' ? 'border-orange-500 text-orange-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
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

        {/* LOOK HOW CLEAN THIS IS NOW! NO MORE MASSIVE PROP DRILLING! */}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'intercept' && <InterceptView />}
        {activeTab === 'saved' && <SavedView />}
        {activeTab === 'repeater' && <RepeaterView />}
        {activeTab === 'options' && <OptionsView />}

      </main>
    </div>
  );
}
