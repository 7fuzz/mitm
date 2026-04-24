import { ReactNode, useState, useEffect } from 'react';
import { PromptModal } from '../ui/PromptModal';
import { GlobalVariable, GlobalVariableValue, UILayout, useTraffic } from '@/hooks/traffic';

// === Global Debounced Variable Card ===
const DebouncedVariableCard = ({ variable, onUpdate, onDelete }: { variable: GlobalVariable, onUpdate: any, onDelete: any }) => {
  const [name, setName] = useState(variable.name);
  const [values, setValues] = useState<GlobalVariableValue[]>(variable.values);
  const [activeIndex, setActiveIndex] = useState(variable.activeIndex);

  useEffect(() => {
    const handler = setTimeout(() => {
      const isNameChanged = name !== variable.name;
      const isActiveChanged = activeIndex !== variable.activeIndex;
      const isValuesChanged = JSON.stringify(values) !== JSON.stringify(variable.values);

      if (isNameChanged || isActiveChanged || isValuesChanged) {
        onUpdate(variable.id, { name, values, activeIndex });
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [name, values, activeIndex, variable.id, variable.name, variable.activeIndex, variable.values, onUpdate]);

  const addVariant = () => {
    const newValues = [...values, { id: crypto.randomUUID(), name: `Variant ${values.length + 1}`, value: '' }];
    setValues(newValues);
    setActiveIndex(newValues.length - 1);
  };

  const updateVariant = (id: string, updates: Partial<GlobalVariableValue>) => {
    setValues(values.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const deleteVariant = (id: string, idx: number) => {
    if (values.length <= 1) return;
    setValues(values.filter(v => v.id !== id));
    if (activeIndex >= idx && activeIndex > 0) setActiveIndex(activeIndex - 1);
  };

  const activeVal = values[activeIndex] || values[0];

  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-950 border border-zinc-800/50 rounded group shadow-sm">
      <div className="flex items-center justify-between">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key (e.g. target_id)"
          className="w-1/2 bg-transparent text-amber-400 outline-none focus:border-b focus:border-amber-500 transition-colors text-xs font-mono font-bold"
        />
        <div className="flex items-center gap-1">
          <select
            value={activeIndex}
            onChange={(e) => setActiveIndex(Number(e.target.value))}
            className="w-28 bg-zinc-900 text-zinc-400 text-[10px] font-bold p-1 outline-none border border-zinc-700 rounded cursor-pointer truncate"
          >
            {values.map((val, i) => <option key={val.id} value={i}>{val.name || `Variant ${i + 1}`}</option>)}
          </select>
          <button onClick={addVariant} className="p-1.5 bg-zinc-900 hover:bg-emerald-900/30 text-emerald-500 border border-zinc-700 rounded transition-colors" title="Add New Variant">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          <button onClick={() => onDelete(variable.id)} className="p-1.5 text-zinc-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100" title="Delete Variable">✕</button>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <input
          value={activeVal.name}
          onChange={(e) => updateVariant(activeVal.id, { name: e.target.value })}
          placeholder="Variant Name"
          className="w-1/3 bg-zinc-900 border border-zinc-700 p-2 rounded text-sky-400 outline-none focus:border-amber-500 transition-colors text-[11px] font-mono"
        />
        <input
          value={activeVal.value}
          onChange={(e) => updateVariant(activeVal.id, { value: e.target.value })}
          placeholder="Value..."
          className="flex-1 bg-zinc-900 border border-zinc-700 p-2 rounded text-zinc-300 outline-none focus:border-amber-500 transition-colors text-[11px] font-mono break-all"
        />
        <button
          onClick={() => deleteVariant(activeVal.id, activeIndex)}
          disabled={values.length <= 1}
          className="p-2 text-zinc-600 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-zinc-600 transition-colors"
          title="Delete Active Variant"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  );
};

// === Main Layout ===
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
  const { isListOpen, listLayout, splitMode } = uiLayout;

  const {
    variables, addVariable, updateVariable, deleteVariable,
    activeProject, updateActiveProject,
    renameProject, deleteProject
  } = useTraffic();

  const [showVariables, setShowVariables] = useState(false);

  // === NEW: Modal State Management ===
  const [promptConfig, setPromptConfig] = useState({
    isOpen: false,
    title: '',
    initialValue: '',
    action: (val: string) => { }
  });

  const openPrompt = (title: string, initialValue: string, action: (val: string) => void) => {
    setPromptConfig({ isOpen: true, title, initialValue, action });
  };

  const closePrompt = () => {
    setPromptConfig(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950">

      {/* Render the Custom Modal */}
      <PromptModal
        isOpen={promptConfig.isOpen}
        title={promptConfig.title}
        initialValue={promptConfig.initialValue}
        onClose={closePrompt}
        onSubmit={promptConfig.action}
      />

      {/* Global Toolbar Area */}
      <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/20 shrink-0 relative z-20">
        <div className="flex items-center gap-4 p-3 min-h-12">

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

          <div className="w-px h-4 bg-zinc-800 hidden lg:block"></div>

          <button
            onClick={() => setShowVariables(!showVariables)}
            className={`px-3 py-1.5 border flex items-center gap-2 text-[10px] rounded transition-all uppercase font-black tracking-widest ${showVariables ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border-zinc-700'}`}
          >
            <span className="opacity-50">&#123;&#123;</span> {activeProject} <span className="opacity-50">&#125;&#125;</span>
          </button>

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

        {/* Global Variables Dropdown Panel */}
        {showVariables && (
          <div className="absolute top-full left-0 right-0 bg-zinc-900 border-b border-zinc-800 p-4 shadow-xl shadow-black/50 z-30 flex flex-col gap-4">
            <div className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Project:</span>
              <select
                value={activeProject}
                onChange={e => updateActiveProject(e.target.value)}
                className="bg-zinc-900 text-amber-400 text-xs font-bold px-2 py-1 outline-none border border-zinc-700 rounded cursor-pointer max-w-[150px] truncate"
              >
                {Array.from(new Set(variables.map(v => v.project).concat([activeProject]))).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                {/* NEW: Hooked up Custom Rename Prompt */}
                <button
                  onClick={() => openPrompt('Rename Project', activeProject, (newName) => {
                    if (newName && newName !== activeProject) renameProject(activeProject, newName);
                  })}
                  disabled={activeProject === 'Default'}
                  className="p-1.5 text-zinc-500 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-500 transition-colors"
                  title="Rename Project"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                </button>

                <button
                  onClick={() => { if (confirm(`Are you sure you want to delete the project "${activeProject}" and ALL its variables?`)) deleteProject(activeProject); }}
                  disabled={activeProject === 'Default'}
                  className="p-1.5 text-zinc-500 hover:text-rose-500 disabled:opacity-20 disabled:hover:text-zinc-500 transition-colors"
                  title="Delete Project"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>

              <div className="w-px h-4 bg-zinc-800 mx-auto"></div>

              {/* NEW: Hooked up Custom New Project Prompt */}
              <button
                onClick={() => openPrompt('New Project Name', '', (newName) => updateActiveProject(newName, true))}
                className="text-[10px] uppercase font-bold text-sky-400 hover:text-sky-300"
              >
                + New Project
              </button>

              <div className="w-px h-4 bg-zinc-800 mx-2"></div>

              <button
                onClick={() => addVariable({ id: crypto.randomUUID(), project: activeProject, name: '', values: [{ id: crypto.randomUUID(), name: 'Default', value: '' }], activeIndex: 0 })}
                className="text-[10px] uppercase font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                + Add Variable
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
              {variables.filter(v => v.project === activeProject).map(v => (
                <DebouncedVariableCard
                  key={v.id}
                  variable={v}
                  onUpdate={updateVariable}
                  onDelete={deleteVariable}
                />
              ))}
            </div>
          </div>
        )}

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
