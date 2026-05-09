import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { UILayout, useTraffic } from '@/hooks/traffic';

// === Main Layout ===
interface Props {
  children?: ReactNode;
  listComponent?: () => ReactNode;
  mainContent: (splitMode: 'vertical' | 'horizontal') => ReactNode;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  extraHeader?: ReactNode;
  uiLayout: UILayout;
  onUpdateLayout: (updates: Partial<UILayout>) => void;
}

export function WorkspaceLayout({ children, listComponent, mainContent, toolbarLeft, toolbarRight, extraHeader, uiLayout, onUpdateLayout }: Props) {
  const { isListOpen, sidebarWidth, splitMode } = uiLayout;
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const {
    environments, activeEnvId, setActiveEnvironment, simpleMode
  } = useTraffic();

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth > 150 && newWidth < 800) {
        onUpdateLayout({ sidebarWidth: newWidth });
      }
    }
  }, [isResizing, onUpdateLayout]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 select-none">
      {children}
      
      {/* Global Toolbar Area */}
      <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/40 shrink-0 relative z-20">
        <div className="flex items-center justify-between p-2 min-h-12 gap-4">

          {/* ZONE A: UI CONTROLS */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded border border-zinc-800/50">
            <button
              onClick={() => onUpdateLayout({ isListOpen: !isListOpen })}
              className={`p-1.5 rounded transition-all ${isListOpen ? 'text-emerald-500' : 'text-zinc-600'}`}
              title={`${isListOpen ? 'Hide' : 'Show'} Sidebar`}
            >
              {isListOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
              )}
            </button>
            <div className="w-px h-4 bg-zinc-800 mx-1"></div>
            <button
              onClick={() => onUpdateLayout({ splitMode: splitMode === 'vertical' ? 'horizontal' : 'vertical' })}
              className="p-1.5 text-zinc-500 hover:text-zinc-300"
              title="Toggle Split Mode (Side-by-Side / Top-Bottom)"
            >
              {splitMode === 'horizontal' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="12" x2="21" y2="12"></line></svg>
              )}
            </button>
          </div>

          {/* ZONE B: GLOBAL CONTEXT (Environment Switcher) */}
          {!simpleMode && (
            <div className="flex items-center gap-2 bg-zinc-950 p-1 rounded-full border border-zinc-800 px-3 shadow-inner shadow-black/50">
              <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest hidden sm:inline-block">Env:</span>
              <select
                value={activeEnvId}
                onChange={(e) => setActiveEnvironment(e.target.value)}
                className="bg-transparent text-amber-400 text-[10px] uppercase font-bold outline-none cursor-pointer max-w-40 truncate"
              >
                {environments.map(e => <option key={e.id} value={e.id} className="bg-zinc-900 text-zinc-300">{e.name}</option>)}
              </select>
            </div>
          )}

          {/* ZONE C: VIEW SPECIFIC CONTEXT (The toolbarLeft slot) */}
          <div className="flex-1 flex items-center justify-center">
            {toolbarLeft}
          </div>

          {/* ZONE D: ACTIONS (The toolbarRight slot) */}
          <div className="flex items-center gap-2">
            {toolbarRight}
          </div>
        </div>

        {extraHeader}
      </div>

      {/* Main Layout Engine */}
      <div className="flex flex-1 overflow-hidden flex-row">
        {isListOpen && listComponent && (
          <>
            <div 
              ref={sidebarRef}
              style={{ width: sidebarWidth }}
              className="border-r border-zinc-800 flex flex-col shrink-0 bg-zinc-950 transition-[width] duration-0"
            >
              {listComponent()}
            </div>
            {/* Drag Handle */}
            <div
              onMouseDown={startResizing}
              className={`w-1 cursor-col-resize hover:bg-sky-500/50 transition-colors z-10 ${isResizing ? 'bg-sky-500' : 'bg-transparent'}`}
            />
          </>
        )}

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 bg-zinc-950 select-text">
          {mainContent(splitMode)}
        </div>
      </div>
    </div>
  );
}
