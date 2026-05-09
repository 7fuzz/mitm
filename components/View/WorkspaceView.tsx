import { useState, useEffect, useRef, useCallback } from 'react';
import { useTraffic, RepeaterGroup, RepeaterRequest } from '@/hooks/traffic';
import { WorkspaceLayout } from '../Layout/WorkspaceLayout';
import { ConfirmModal, PromptModal, MultiGroupExportModal } from '../Modals';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ReplacementCategory = 'URL_REPLACEMENTS' | 'HEADER_REPLACEMENTS' | 'BODY_KEY_REPLACEMENTS' | 'URL_PARAM_REPLACEMENTS' | 'TEXT_REPLACEMENTS';

interface ReplacementEntry {
  id: string;
  pattern: string;
  replacement: string;
}

const CATEGORY_INFO: Record<ReplacementCategory, { label: string; description: string; color: string }> = {
  URL_REPLACEMENTS: { label: 'URL Patterns', description: 'Domain prefix replacements for environment switching', color: 'sky' },
  HEADER_REPLACEMENTS: { label: 'Header Replacements', description: 'Replace whole header values based on their KEY (e.g., Authorization)', color: 'emerald' },
  BODY_KEY_REPLACEMENTS: { label: 'Body Keys', description: 'Replace JSON keys in request body', color: 'amber' },
  URL_PARAM_REPLACEMENTS: { label: 'URL Params', description: 'Replace URL query parameter values', color: 'rose' },
  TEXT_REPLACEMENTS: { label: 'Global Text', description: 'Global string replacement across URL, Headers, and Body (e.g., xyz -> {{var}})', color: 'indigo' },
};

function SortableGroupItem({ group, isActive, onSelect, onRename, onDelete }: { group: RepeaterGroup, isActive: boolean, onSelect: (id: string) => void, onRename: (group: RepeaterGroup) => void, onDelete: (group: RepeaterGroup) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between p-3 rounded border transition-all cursor-pointer ${isActive ? 'bg-purple-500/10 border-purple-500/40 text-purple-400' : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'}`}
      onClick={() => onSelect(group.id)}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:text-zinc-200">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="18" x2="16" y2="18"></line></svg>
        </div>
        <span className="font-bold text-xs uppercase tracking-wider truncate">{group.name}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onRename(group); }} className="p-1.5 hover:text-purple-400"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(group); }} className="p-1.5 hover:text-rose-500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
      </div>
    </div>
  );
}

export function WorkspaceView() {
  const {
    uiLayout, updateUILayout,
    environments, activeEnvId, setActiveEnvironment, createEnvironment, renameEnvironment, deleteEnvironment,
    variables, addVariable, updateVariable, deleteVariable,
    repeaterGroups, createGroup, renameGroup, deleteGroup,
    importPostman, importProject, reorderGroups,
    replacements: _replacements, orderedReplacements, saveReplacements, deleteReplacement, isLoading: replacementsLoading,
    simpleMode: _simpleMode
  } = useTraffic();

  const [activeTab, setActiveTab] = useState<'env' | 'collections' | 'replacements'>('env');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', initialValue: '', action: (_val: string) => { } });
  const openPrompt = (title: string, initialValue: string, action: (val: string) => void) => setPromptConfig({ isOpen: true, title, initialValue, action });
  const closePrompt = () => setPromptConfig(prev => ({ ...prev, isOpen: false }));

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: () => { } });
  const openConfirm = (title: string, message: string, action: () => void) => setConfirmConfig({ isOpen: true, title, message, action });

  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Replacements UI State
  const [expandedCategory, setExpandedCategory] = useState<ReplacementCategory | null>('URL_REPLACEMENTS');
  const [localReplacements, setLocalReplacements] = useState<Record<ReplacementCategory, ReplacementEntry[]>>({
    URL_REPLACEMENTS: [],
    HEADER_REPLACEMENTS: [],
    BODY_KEY_REPLACEMENTS: [],
    URL_PARAM_REPLACEMENTS: [],
    TEXT_REPLACEMENTS: [],
  });
  const [isSavingReplacements, setIsSavingReplacements] = useState(false);
  const [saveReplacementsMessage, setSaveReplacementsMessage] = useState('');
  
  // Debounce ref for auto-save
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const lastSavedRef = useRef<string>('');

  const [prevOrderedReplacements, setPrevOrderedReplacements] = useState(orderedReplacements);

  if (orderedReplacements !== prevOrderedReplacements) {
    setPrevOrderedReplacements(orderedReplacements);
    if (orderedReplacements && orderedReplacements.length > 0) {
      const converted: Record<ReplacementCategory, ReplacementEntry[]> = {
        URL_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'URL_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
        HEADER_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'HEADER_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
        BODY_KEY_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'BODY_KEY_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
        URL_PARAM_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'URL_PARAM_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
        TEXT_REPLACEMENTS: orderedReplacements.filter(r => r.type === 'TEXT_REPLACEMENTS').map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })),
      };
      setLocalReplacements(converted);
    }
  }

  // Sync refs in effect
  useEffect(() => {
    if (orderedReplacements && orderedReplacements.length > 0) {
      const payloadString = JSON.stringify(orderedReplacements.map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })));
      lastSavedRef.current = payloadString;
      isInitialLoad.current = false;
    }
  }, [orderedReplacements]);

  const saveReplacementsRef = useRef(saveReplacements);
  useEffect(() => {
    saveReplacementsRef.current = saveReplacements;
  }, [saveReplacements]);

  const debouncedSave = useCallback((data: Record<ReplacementCategory, ReplacementEntry[]>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Flatten data for comparison and incremental save
    const currentItems = (Object.entries(data) as [ReplacementCategory, ReplacementEntry[]][]).flatMap(([type, entries]) => 
      entries.filter(e => e.pattern).map(e => ({ ...e, type }))
    );
    
    const currentPayloadString = JSON.stringify(currentItems.map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })));
    if (lastSavedRef.current === currentPayloadString) return;

    // Find ONLY changed or new items
    const lastItems: { id: string; pattern: string; replacement: string }[] = JSON.parse(lastSavedRef.current || '[]');
    const modifiedItems = currentItems.filter(curr => {
      const prev = lastItems.find(l => l.id === curr.id);
      return !prev || prev.pattern !== curr.pattern || prev.replacement !== curr.replacement;
    });

    if (modifiedItems.length === 0) return;

    setSaveReplacementsMessage('Saving...');
    debounceRef.current = setTimeout(async () => {
      setIsSavingReplacements(true);
      try {
        // Send only modified items using incremental mode
        const result = await saveReplacementsRef.current(modifiedItems, true);
        if (result.success) {
          lastSavedRef.current = currentPayloadString;
          setSaveReplacementsMessage('Auto-saved ✓');
        } else {
          setSaveReplacementsMessage('Save failed');
        }
      } catch (_e) {
        setSaveReplacementsMessage('Save failed');
      }
      setIsSavingReplacements(false);
      setTimeout(() => setSaveReplacementsMessage(''), 2000);
    }, 800);
  }, []);

  useEffect(() => {
    if (!isInitialLoad.current) {
      debouncedSave(localReplacements);
    }
  }, [localReplacements, debouncedSave]);

  const updateReplacementEntry = (category: ReplacementCategory, index: number, field: 'pattern' | 'replacement', value: string) => {
    setLocalReplacements(prev => ({
      ...prev,
      [category]: prev[category].map((entry, i) => i === index ? { ...entry, [field]: value } : entry)
    }));
  };

  const addReplacement = (category: ReplacementCategory) => {
    setLocalReplacements(prev => ({
      ...prev,
      [category]: [...prev[category], { id: crypto.randomUUID(), pattern: '', replacement: '' }]
    }));
  };

  const removeReplacement = (category: ReplacementCategory, index: number) => {
    const entry = localReplacements[category][index];
    if (entry && entry.id) {
       deleteReplacement(entry.id);
    }
    setLocalReplacements(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const handleSaveReplacements = async () => {
    setIsSavingReplacements(true);
    setSaveReplacementsMessage('');
    try {
      const allItems = (Object.entries(localReplacements) as [ReplacementCategory, ReplacementEntry[]][]).flatMap(([type, entries]) => 
        entries.filter(e => e.pattern).map(e => ({ ...e, type }))
      );

      const result = await saveReplacements(allItems, true);
      if (result.success) {
        setSaveReplacementsMessage('Replacements updated successfully!');
        lastSavedRef.current = JSON.stringify(allItems.map(r => ({ id: r.id, pattern: r.pattern, replacement: r.replacement })));
      } else {
        setSaveReplacementsMessage('Error: Failed to save replacements');
      }
    } catch (_e) {
      setSaveReplacementsMessage('Error: Failed to save replacements');
    }
    setIsSavingReplacements(false);
    setTimeout(() => setSaveReplacementsMessage(''), 3000);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleGroupReorder = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = repeaterGroups.findIndex(g => g.id === active.id);
      const newIndex = repeaterGroups.findIndex(g => g.id === over.id);
      const newGroups = arrayMove(repeaterGroups, oldIndex, newIndex);
      
      reorderGroups(newGroups.map(g => g.id));
    }
  };

  const handleExport = async (selectedGroupIds: string[], projectName: string) => {
    try {
      const fetchPromises = selectedGroupIds.map(gid => fetch(`/api/repeater-db?groupId=${gid}`).then(r => r.json()));
      const results = await Promise.all(fetchPromises);
      const flattenedRequests: RepeaterRequest[] = results.flat();
      
      if (flattenedRequests.length === 0) return alert('No requests found in selected groups.');

      const placeholders: Record<string, string> = {};
      variables.filter(v => v.environmentId === activeEnvId).forEach(v => {
        if (v.name.trim()) {
          const activeVal = v.values[v.activeIndex] || v.values[0];
          placeholders[v.name.trim()] = activeVal ? activeVal.value : '';
        }
      });

      const splitUrl = (urlStr: string) => {
        let baseUrl = '';
        let endpoint = urlStr;
        const params: Record<string, string> = {};

        if (urlStr.startsWith('{{')) {
          const endOfVar = urlStr.indexOf('}}');
          if (endOfVar !== -1) {
            const firstSlash = urlStr.indexOf('/', endOfVar);
            if (firstSlash !== -1) {
              baseUrl = urlStr.substring(0, firstSlash);
              endpoint = urlStr.substring(firstSlash);
            } else { baseUrl = urlStr; endpoint = ''; }
          }
        } else {
          try {
            const u = new URL(urlStr);
            baseUrl = u.origin;
            endpoint = u.pathname;
          } catch (_e) { /* fallback */ }
        }

        try {
          const searchIdx = endpoint.indexOf('?');
          if (searchIdx !== -1) {
            const search = endpoint.substring(searchIdx);
            endpoint = endpoint.substring(0, searchIdx);
            const sp = new URLSearchParams(search);
            sp.forEach((v, k) => { params[k] = v; });
          }
        } catch (_e) { /* ignore */ }
        return { baseUrl, endpoint, params };
      };

      const headerCounts: Record<string, Record<string, number>> = {};
      flattenedRequests.forEach(req => {
        Object.entries(req.headers || {}).forEach(([k, v]) => {
          const key = (k as string).toLowerCase();
          if (!headerCounts[key]) headerCounts[key] = {};
          headerCounts[key][v as string] = (headerCounts[key][v as string] || 0) + 1;
        });
      });

      const globalHeader: Record<string, string> = {};
      const threshold = Math.max(1, flattenedRequests.length * 0.6);
      Object.entries(headerCounts).forEach(([key, vals]) => {
        Object.entries(vals).forEach(([v, count]) => {
          if (count >= threshold) {
            const sampleReq = flattenedRequests.find(r => Object.keys(r.headers || {}).some(hk => hk.toLowerCase() === key));
            const originalKey = Object.keys(sampleReq?.headers || {}).find(hk => hk.toLowerCase() === key) || key;
            globalHeader[originalKey] = v;
          }
        });
      });

      const test_cases = selectedGroupIds.map(gid => {
        const groupReqs = flattenedRequests.filter(r => (r.groupId || 'null') === gid);
        if (groupReqs.length === 0) return null;

        const groupName = gid === 'null' ? 'Default' : (repeaterGroups.find(g => g.id === gid)?.name || 'Unknown Group');
        
        const baseUrls = groupReqs.map(r => splitUrl(r.url).baseUrl);
        const mostCommonBase = baseUrls.sort((a, b) => baseUrls.filter(v => v === a).length - baseUrls.filter(v => v === b).length).pop() || '{{apiUrl}}';

        const targets = groupReqs.map(req => {
          const { baseUrl, endpoint, params } = splitUrl(req.url);
          let parsedBody = req.body;
          try {
            if (req.body && (req.body.startsWith('{') || req.body.startsWith('['))) {
              parsedBody = JSON.parse(req.body);
            }
          } catch (_e) { /* keep as string */ }

          const localHeaders: Record<string, string | null> = {};
          Object.entries(req.headers || {}).forEach(([k, v]) => {
            const gk = Object.keys(globalHeader).find(key => key.toLowerCase() === k.toLowerCase());
            if (!gk || globalHeader[gk] !== v) {
              localHeaders[k] = v;
            }
          });
          Object.keys(globalHeader).forEach(gk => {
            if (!Object.keys(req.headers || {}).some(rk => rk.toLowerCase() === gk.toLowerCase())) {
              localHeaders[gk] = null;
            }
          });

          return {
            name: req.name,
            endpoint: baseUrl === mostCommonBase ? endpoint : (baseUrl + endpoint),
            method: req.method,
            header: Object.keys(localHeaders).length > 0 ? localHeaders : undefined,
            params: Object.keys(params).length > 0 ? params : undefined,
            body: req.method !== 'GET' ? parsedBody : undefined,
            extract: req.extract || {}
          };
        });

        return {
          name: groupName,
          url: mostCommonBase,
          target: targets
        };
      }).filter((tc): tc is NonNullable<typeof tc> => tc !== null);

      const exportData = {
        name: projectName,
        url: (test_cases[0] as { url: string })?.url || '{{apiUrl}}',
        header: globalHeader,
        placeholders,
        test_cases
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) { alert('Export failed: ' + err); }
  };

  return (
    <WorkspaceLayout
      uiLayout={uiLayout}
      onUpdateLayout={updateUILayout}
      listComponent={() => (
        <div className="flex flex-col p-2 gap-1 h-full">
          <div className="px-3 py-2 text-[9px] font-black tracking-widest text-zinc-600 uppercase mb-2">Workspace Setup</div>
          <button
            onClick={() => setActiveTab('env')}
            className={`flex items-center text-left px-3 py-2.5 rounded text-[11px] font-bold tracking-wider transition-all border ${activeTab === 'env' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900'}`}
          >
            Environments & Variables
          </button>
          <button
            onClick={() => setActiveTab('collections')}
            className={`flex items-center text-left px-3 py-2.5 rounded text-[11px] font-bold tracking-wider transition-all border ${activeTab === 'collections' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900'}`}
          >
            Workbench Collections
          </button>
          <button
            onClick={() => setActiveTab('replacements')}
            className={`flex items-center text-left px-3 py-2.5 rounded text-[11px] font-bold tracking-wider transition-all border ${activeTab === 'replacements' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900'}`}
          >
            Workbench Replacements
          </button>
        </div>
      )}
      toolbarLeft={
        <div className="flex items-center px-4">
          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-zinc-300">
            Workspace_Management / {activeTab === 'env' ? 'Environments' : activeTab === 'collections' ? 'Collections' : 'Replacements'}
          </span>
        </div>
      }
      toolbarRight={
        <div className="flex items-center gap-2">
          <button onClick={importPostman} className="px-3 py-1.5 text-zinc-500 hover:text-sky-400 text-[10px] rounded transition-all uppercase font-bold">Import PM</button>
          <button onClick={importProject} className="px-3 py-1.5 text-zinc-500 hover:text-sky-400 text-[10px] rounded transition-all uppercase font-bold">Import Project</button>
          <button onClick={() => setExportModalOpen(true)} className="px-3 py-1.5 text-zinc-500 hover:text-amber-400 text-[10px] rounded transition-all uppercase font-bold">Export</button>
        </div>
      }
      mainContent={() => (
        <div className="w-full max-w-5xl mx-auto py-6 space-y-10">
          {activeTab === 'env' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-amber-500 font-bold uppercase text-[10px] tracking-widest">Available Environments</h3>
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
                          <span className="text-[9px] text-zinc-600 font-mono uppercase">ID: {v.id.substring(0, 8)}...</span>
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
          )}
          
          {activeTab === 'collections' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-purple-500 font-bold uppercase text-[10px] tracking-widest">Workbench Collections Management</h3>
                  <button onClick={() => openPrompt('New Collection Name', '', createGroup)} className="px-3 py-1.5 bg-purple-600/10 border border-purple-600/30 text-purple-500 hover:bg-purple-600/20 rounded text-[9px] font-black uppercase tracking-widest transition-all">+ Create Collection</button>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupReorder}>
                    <SortableContext items={repeaterGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                      {repeaterGroups.map(group => (
                        <SortableGroupItem
                          key={group.id}
                          group={group}
                          isActive={selectedGroupId === group.id}
                          onSelect={setSelectedGroupId}
                          onRename={(g: RepeaterGroup) => openPrompt('Rename Collection', g.name, (val) => renameGroup(g.id, val))}
                          onDelete={(g: RepeaterGroup) => openConfirm('Delete Collection', `Permanently destroy "${g.name}" and all requests inside?`, () => deleteGroup(g.id))}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'replacements' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-rose-500 font-bold uppercase text-[10px] tracking-widest">Workbench Replacements</h3>
                    <p className="text-zinc-500 text-[10px] font-mono mt-1">Configure variable placeholders applied when sending requests from History to Workbench.</p>
                  </div>
                </div>

                {replacementsLoading ? (
                  <div className="text-center py-12 border border-zinc-800 border-dashed rounded bg-zinc-900/20 text-zinc-600 font-mono text-[10px] uppercase tracking-widest">Loading replacements...</div>
                ) : (
                  <div className="space-y-3">
                    {(Object.keys(CATEGORY_INFO) as ReplacementCategory[]).map(category => {
                      const info = CATEGORY_INFO[category];
                      const isExpanded = expandedCategory === category;
                      const entries = localReplacements[category] || [];

                      return (
                        <div key={category} className="border border-zinc-800 rounded overflow-hidden bg-zinc-900/30">
                          <button
                            onClick={() => setExpandedCategory(isExpanded ? null : category)}
                            className="w-full flex items-center justify-between p-4 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-2 h-2 rounded-full bg-${info.color}-500`} />
                              <div className="text-left">
                                <div className="text-xs text-zinc-300 font-bold uppercase tracking-widest">{info.label}</div>
                                <div className="text-[10px] text-zinc-600 font-mono">{entries.length} rule{entries.length !== 1 ? 's' : ''}</div>
                              </div>
                            </div>
                            <span className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </button>

                          {isExpanded && (
                            <div className="p-4 border-t border-zinc-800 space-y-3 bg-zinc-950/30">
                              <p className="text-[10px] text-zinc-500 font-mono italic">{info.description}</p>
                              
                              {entries.length === 0 ? (
                                <div className="text-center py-6 border border-zinc-800 border-dashed rounded text-zinc-700 text-[10px] font-mono uppercase tracking-widest">No replacements configured</div>
                              ) : (
                                <div className="space-y-2">
                                  {entries.map((entry, idx) => (
                                    <div key={idx} className="flex items-center gap-2 group">
                                      <input
                                        type="text"
                                        value={entry.pattern}
                                        onChange={(e) => updateReplacementEntry(category, idx, 'pattern', e.target.value)}
                                        placeholder={category === 'HEADER_REPLACEMENTS' ? "Header Key (e.g. Authorization)" : category === 'BODY_KEY_REPLACEMENTS' ? "JSON Key (e.g. user_id)" : category === 'TEXT_REPLACEMENTS' ? "Any Text (e.g. xyz)" : "Pattern (e.g. api.)"}
                                        className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 rounded text-zinc-300 font-mono text-xs outline-none focus:border-rose-500/50 transition-all"
                                      />
                                      <span className="text-zinc-600 text-xs">→</span>
                                      <input
                                        type="text"
                                        value={entry.replacement}
                                        onChange={(e) => updateReplacementEntry(category, idx, 'replacement', e.target.value)}
                                        placeholder={category === 'HEADER_REPLACEMENTS' ? "Value (e.g. Bearer {{token}})" : category === 'TEXT_REPLACEMENTS' ? "Replacement (e.g. {{something}})" : "Replacement (e.g. {{env}})"}
                                        className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 rounded text-amber-400 font-mono text-xs outline-none focus:border-rose-500/50 transition-all"
                                      />
                                      <button
                                        onClick={() => removeReplacement(category, idx)}
                                        className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => addReplacement(category)}
                                className="text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-widest flex items-center gap-1 mt-2"
                              >
                                + Add Rule
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 border-t border-zinc-800/50">
                  <span className={`text-[10px] font-mono uppercase tracking-widest ${saveReplacementsMessage.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {saveReplacementsMessage}
                  </span>
                  <button
                    onClick={handleSaveReplacements}
                    disabled={isSavingReplacements}
                    className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] rounded uppercase font-black tracking-widest transition-colors disabled:opacity-50"
                  >
                    {isSavingReplacements ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    >
      <PromptModal isOpen={promptConfig.isOpen} title={promptConfig.title} initialValue={promptConfig.initialValue} onClose={closePrompt} onSubmit={promptConfig.action} />
      <ConfirmModal isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} isDestructive={true} onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmConfig.action} />
      <MultiGroupExportModal
        isOpen={exportModalOpen}
        groups={[...repeaterGroups, { id: 'null', name: 'Default (Uncategorized)' }]}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExport}
      />
    </WorkspaceLayout>
  );
}
