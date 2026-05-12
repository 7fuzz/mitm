import { useTraffic } from '@/hooks/traffic';

interface EnvironmentsSectionProps {
  openPrompt: (title: string, initialValue: string, action: (val: string) => void) => void;
  openConfirm: (title: string, message: string, action: () => void) => void;
}

export function EnvironmentsSection({ openPrompt, openConfirm }: EnvironmentsSectionProps) {
  const {
    environments, activeEnvId, setActiveEnvironment, createEnvironment, renameEnvironment, deleteEnvironment,
    variables, addVariable, updateVariable, deleteVariable, saveVariable,
    prefs, updatePrefs
  } = useTraffic();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-amber-500 font-bold uppercase text-[10px] tracking-widest">Available Environments</h3>
            <div className="flex items-center gap-2 px-2 py-1 bg-zinc-900/50 border border-zinc-800 rounded">
              <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Auto-Save</span>
              <button 
                onClick={() => updatePrefs({ ...prefs, autoSave: !prefs.autoSave })}
                className={`w-8 h-4 rounded-full relative transition-colors ${prefs.autoSave ? 'bg-emerald-500/50' : 'bg-zinc-800'}`}
              >
                <div className={`absolute top-1 w-2 h-2 rounded-full transition-all ${prefs.autoSave ? 'right-1 bg-emerald-400' : 'left-1 bg-zinc-600'}`} />
              </button>
            </div>
          </div>
          <button onClick={() => openPrompt('New Environment Name', '', createEnvironment)} className="px-3 py-1.5 bg-amber-600/10 border border-amber-600/30 text-amber-500 hover:bg-amber-600/20 rounded text-[9px] font-black uppercase tracking-widest transition-all">+ Create Environment</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {environments.map(env => (
            <div key={env.id} className={`p-4 rounded border transition-all flex flex-col gap-3 ${activeEnvId === env.id ? 'bg-amber-500/5 border-amber-500/40 shadow-lg shadow-amber-900/10' : 'bg-zinc-900/30 border-zinc-800'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-wider ${activeEnvId === env.id ? 'text-amber-400' : 'text-zinc-400'}`}>{env.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => openPrompt('Rename Environment', env.name, (val) => renameEnvironment(env.id, val))} className="p-1 text-zinc-600 hover:text-zinc-300"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
                  {env.id !== 'default-env-id' && <button onClick={() => openConfirm('Delete Environment', `Are you sure? All variables in "${env.name}" will be lost.`, () => deleteEnvironment(env.id))} className="p-1 text-zinc-600 hover:text-rose-500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>}
                </div>
              </div>
              <button 
                onClick={() => setActiveEnvironment(env.id)}
                disabled={activeEnvId === env.id}
                className={`w-full py-1.5 rounded text-[9px] font-black uppercase tracking-[0.2em] border transition-all ${activeEnvId === env.id ? 'bg-amber-500 border-amber-400 text-zinc-950' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:text-zinc-300 hover:border-zinc-700'}`}
              >
                {activeEnvId === env.id ? 'Current_Active' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 pt-8 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-emerald-500 font-bold uppercase text-[10px] tracking-widest">Global Variables ({environments.find(e => e.id === activeEnvId)?.name})</h3>
          <button 
            onClick={() => addVariable({ 
              id: crypto.randomUUID(), 
              environmentId: activeEnvId, 
              name: '', 
              values: [
                { id: crypto.randomUUID(), name: 'Default', value: '' },
                { id: crypto.randomUUID(), name: '(auto)', value: '' }
              ], 
              activeIndex: 0 
            })}
            className="px-3 py-1.5 bg-emerald-600/10 border border-emerald-600/30 text-emerald-500 hover:bg-emerald-600/20 rounded text-[9px] font-black uppercase tracking-widest transition-all"
          >
            + Add New Variable
          </button>
        </div>
        
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg divide-y divide-zinc-800 overflow-hidden">
          {variables.filter(v => v.environmentId === activeEnvId).length === 0 ? (
            <div className="p-12 text-center text-zinc-600 font-mono text-[10px] uppercase tracking-widest">No variables defined for this environment</div>
          ) : (
            variables.filter(v => v.environmentId === activeEnvId).map(v => (
              <div key={v.id} className="p-4 flex items-start gap-6 hover:bg-zinc-900/20 transition-colors group">
                <div className="flex flex-col gap-1 w-1/4">
                  <input 
                    value={v.name}
                    onChange={(e) => updateVariable(v.id, { name: e.target.value })}
                    className="bg-transparent text-amber-400 font-bold text-xs outline-none focus:text-amber-300 transition-colors"
                    placeholder="KEY_NAME"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-zinc-600 font-mono uppercase">ID: {v.id.substring(0, 8)}...</span>
                    {!prefs.autoSave && (
                      <button 
                        onClick={() => saveVariable(v.id, v)}
                        className="text-[8px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors"
                      >
                        [Save]
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  {v.values.map((val, idx) => (
                    <div key={val.id} className="flex items-center gap-2">
                      <input 
                        value={val.name}
                        onChange={(e) => {
                          const newVals = v.values.map(vv => vv.id === val.id ? { ...vv, name: e.target.value } : vv);
                          updateVariable(v.id, { values: newVals });
                        }}
                        className={`w-24 bg-zinc-900/50 border border-zinc-800 p-1.5 rounded text-[10px] font-bold ${val.name === '(auto)' ? 'text-purple-400 border-purple-900/30' : 'text-sky-400'}`}
                        placeholder="Variant"
                        disabled={val.name === '(auto)'}
                      />
                      <input 
                        value={val.value}
                        onChange={(e) => {
                          const newVals = v.values.map(vv => vv.id === val.id ? { ...vv, value: e.target.value } : vv);
                          updateVariable(v.id, { values: newVals });
                        }}
                        className="flex-1 bg-zinc-900/50 border border-zinc-800 p-1.5 rounded text-zinc-300 text-[10px] font-mono"
                        placeholder="Value..."
                      />
                      <div className="flex items-center gap-1 ml-2">
                        <button 
                          onClick={() => updateVariable(v.id, { activeIndex: idx })}
                          className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter border transition-all ${v.activeIndex === idx ? 'bg-emerald-500 border-emerald-400 text-zinc-950' : 'bg-transparent border-zinc-800 text-zinc-600 hover:text-zinc-300'}`}
                        >
                          {v.activeIndex === idx ? 'Active' : 'Set'}
                        </button>
                        {v.values.length > 1 && val.name !== '(auto)' && (
                          <button onClick={() => updateVariable(v.id, { values: v.values.filter(vv => vv.id !== val.id), activeIndex: 0 })} className="p-1 text-zinc-700 hover:text-rose-500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => updateVariable(v.id, { values: [...v.values, { id: crypto.randomUUID(), name: `Variant ${v.values.length + 1}`, value: '' }] })}
                    className="text-[9px] text-zinc-500 hover:text-emerald-400 font-bold uppercase tracking-widest w-fit"
                  >
                    + New Variant
                  </button>
                </div>
                <button onClick={() => deleteVariable(v.id)} className="p-2 text-zinc-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
