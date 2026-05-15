import { useState } from 'react';
import { useTraffic, RepeaterRequest } from '@/hooks/traffic';
import { WorkspaceLayout } from '../Layout/WorkspaceLayout';
import { ConfirmModal, PromptModal, MultiGroupExportModal } from '../Modals';
import { EnvironmentsSection } from '../modules/workspace/EnvironmentsSection';
import { CollectionsSection } from '../modules/workspace/CollectionsSection';
import { ReplacementsSection } from '../modules/workspace/ReplacementsSection';

export function WorkspaceView() {
  const {
    uiLayout, updateUILayout,
    variables, activeEnvId,
    repeaterGroups,
    importPostman, importProject,
    simpleMode
  } = useTraffic();

  const [activeTab, setActiveTab] = useState<'env' | 'collections' | 'replacements'>('env');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [promptConfig, setPromptConfig] = useState({ isOpen: false, title: '', initialValue: '', action: (_val: string) => { } });
  const openPrompt = (title: string, initialValue: string, action: (val: string) => void) => setPromptConfig({ isOpen: true, title, initialValue, action });
  const closePrompt = () => setPromptConfig(prev => ({ ...prev, isOpen: false }));

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: () => { } });
  const openConfirm = (title: string, message: string, action: () => void) => setConfirmConfig({ isOpen: true, title, message, action });

  const [exportModalOpen, setExportModalOpen] = useState(false);

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

    } catch (_err) { alert('Export failed: ' + _err); }
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
            className={`flex items-center text-left px-3 py-2.5 rounded text-[11px] font-bold tracking-wider transition-all border ${activeTab === 'collections' ? 'bg-purple-500/10 border-purple-500/40 text-purple-400' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900'}`}
          >
            Repeater Collections
          </button>
          <button
            onClick={() => setActiveTab('replacements')}
            className={`flex items-center text-left px-3 py-2.5 rounded text-[11px] font-bold tracking-wider transition-all border ${activeTab === 'replacements' ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900'}`}
          >
            Repeater Replacements
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
          {activeTab === 'env' && <EnvironmentsSection openPrompt={openPrompt} openConfirm={openConfirm} />}
          {activeTab === 'collections' && <CollectionsSection selectedGroupId={selectedGroupId} setSelectedGroupId={setSelectedGroupId} openPrompt={openPrompt} openConfirm={openConfirm} />}
          {activeTab === 'replacements' && <ReplacementsSection />}
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
