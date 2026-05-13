'use client';
import { useState } from 'react';
import { TrafficProvider, useTraffic } from '@/hooks/traffic';
import { InterceptView } from '@/components/View/InterceptView';
import { SavedView } from '@/components/View/SavedView';
import { RepeaterView } from '@/components/View/RepeaterView';
import { HistoryView } from '@/components/View/HistoryView';
import { OptionsView } from '@/components/View/OptionsView';
import { UtilitiesView } from '@/components/View/UtilitiesView';
import { WorkspaceView } from '@/components/View/WorkspaceView';

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
  const { traffic, repeaterRequests, simpleMode } = useTraffic();

  const [activeTab, setActiveTab] = useState<'history' | 'intercept' | 'saved' | 'repeater' | 'options' | 'utilities' | 'workspace'>('history');

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
            className={`px-6 h-full flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'intercept' ? 'border-rose-500 text-rose-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
          >
            Intercept
            {pendingCount > 0 && (
              <span className="flex items-center justify-center min-w-5 h-5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full text-[9px] animate-pulse px-1 font-black">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('repeater')}
            className={`px-6 h-full flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'repeater' ? 'border-purple-500 text-purple-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
          >
            {simpleMode ? 'Repeater' : 'Workbench'}
            {repeaterRequests.length > 0 && (
              <span className="flex items-center justify-center min-w-5 h-5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full text-[9px] px-1 font-black">
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

          {!simpleMode && (
            <button
              onClick={() => setActiveTab('workspace')}
              className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'workspace' ? 'border-blue-500 text-blue-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
            >
              Workspace
            </button>
          )}

          {!simpleMode && (
            <button
              onClick={() => setActiveTab('utilities')}
              className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'utilities' ? 'border-fuchsia-500 text-fuchsia-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
            >
              Utilities
            </button>
          )}

          <button
            onClick={() => setActiveTab('options')}
            className={`px-6 h-full flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'options' ? 'border-orange-500 text-orange-400 bg-zinc-900/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30'}`}
          >
            Options
          </button>
        </div>

        <div className="flex items-center gap-3 px-3 py-1.5 bg-emerald-500/5 border border-emerald-500/20 rounded-full group hover:border-emerald-500/40 transition-all cursor-default">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-[10px] text-emerald-500/80 font-black uppercase tracking-[0.15em]">Proxy_Live</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'intercept' && <InterceptView />}
        {activeTab === 'saved' && <SavedView />}
        {activeTab === 'repeater' && <RepeaterView />}
        {!simpleMode && activeTab === 'workspace' && <WorkspaceView />}
        {!simpleMode && activeTab === 'utilities' && <UtilitiesView />}
        {activeTab === 'options' && <OptionsView />}
      </main>
    </div>
  );
}
