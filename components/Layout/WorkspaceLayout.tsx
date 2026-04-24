import { ReactNode } from 'react';
import { UILayout } from '@/hooks/useTraffic';

interface Props {
  listComponent?: (layout: 'sidebar' | 'bottom') => ReactNode;
  mainContent: (splitMode: 'vertical' | 'horizontal') => ReactNode;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  extraHeader?: ReactNode;
  uiLayout: UILayout;
  onUpdateLayout: (updates: Partial<UILayout>) => void;
}

export function WorkspaceLayout({ listComponent, mainContent, toolbarLeft, toolbarRight, extraHeader, uiLayout, onUpdateLayout }: Props) {

  // Destructure for easy reading
  const { isListOpen, listLayout, splitMode } = uiLayout;

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950">

      {/* Global Toolbar Area */}
      <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/20 shrink-0 relative z-20">
        <div className="flex items-center gap-4 p-3 min-h-[48px]">

          {listComponent && (
            <>
              <button onClick={() => onUpdateLayout({ isListOpen: !isListOpen })} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-all border flex items-center gap-2 ${isListOpen ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-transparent border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                {isListOpen ? 'Hide List' : 'Show List'}
              </button>

              <div className="w-px h-4 bg-zinc-800 hidden md:block"></div>

              <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800 hidden md:flex">
                <button onClick={() => onUpdateLayout({ listLayout: 'sidebar' })} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${listLayout === 'sidebar' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Sidebar</button>
                <button onClick={() => onUpdateLayout({ listLayout: 'bottom' })} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${listLayout === 'bottom' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Bottom</button>
              </div>

              <div className="w-px h-4 bg-zinc-800 hidden lg:block"></div>
            </>
          )}

          <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800 hidden lg:flex">
            <button onClick={() => onUpdateLayout({ splitMode: 'vertical' })} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${splitMode === 'vertical' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Top / Bot</button>
            <button onClick={() => onUpdateLayout({ splitMode: 'horizontal' })} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-all ${splitMode === 'horizontal' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Side / Side</button>
          </div>

          {toolbarLeft && (
            <>
              <div className="w-px h-4 bg-zinc-800 hidden lg:block"></div>
              {toolbarLeft}
            </>
          )}

          <div className="ml-auto flex items-center gap-3">
            {toolbarRight}
          </div>
        </div>

        {extraHeader}
      </div>

      {/* Main Layout Engine */}
      <div className={`flex flex-1 overflow-hidden ${listLayout === 'bottom' ? 'flex-col' : 'flex-row'}`}>

        {listLayout === 'sidebar' && isListOpen && listComponent && (
          <div className="w-[350px] border-r border-zinc-800 flex flex-col shrink-0 bg-zinc-950">
            {listComponent('sidebar')}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 bg-zinc-950">
          {mainContent(splitMode)}
        </div>

        {listLayout === 'bottom' && isListOpen && listComponent && (
          <div className="h-[300px] border-t border-zinc-800 flex flex-col shrink-0 bg-zinc-950">
            {listComponent('bottom')}
          </div>
        )}

      </div>
    </div>
  );
}
