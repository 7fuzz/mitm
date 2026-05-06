import { useState } from 'react';
import { RepeaterRequest } from '@/components/View/RepeaterView';
import { RepeaterGroup } from './types';

export function useRepeater() {
  const [repeaterRequests, setRepeaterRequests] = useState<RepeaterRequest[]>([]);
  const [repeaterGroups, setRepeaterGroups] = useState<RepeaterGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('All');

  // Internal bootstrapper
  const initActiveGroup = (groupId: string) => setActiveGroupId(groupId);

  const refreshRepeater = async () => {
    try {
      const [reqRes, groupRes] = await Promise.all([
        fetch(`/api/repeater-db?groupId=${activeGroupId}`),
        fetch('/api/repeater-groups')
      ]);
      setRepeaterRequests(await reqRes.json());
      setRepeaterGroups(await groupRes.json());
    } catch (error) { console.error('Failed to refresh repeater data:', error); }
  };

  // === UPGRADED: Lazy Loader now saves to database state ===
  const switchGroup = async (groupId: string) => {
    setActiveGroupId(groupId);

    // Save to the Python app_state table in the background
    fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active_repeater_group: groupId }) }).catch(console.error);

    try {
      const res = await fetch(`/api/repeater-db?groupId=${groupId}`);
      setRepeaterRequests(await res.json());
    } catch (error) { console.error("Failed to load group:", error); }
  };

  const addEmptyRequest = async (targetGroup: string | null = null) => {
    try {
      const response = await fetch('/api/repeater-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Request', groupId: targetGroup, method: 'GET', url: '{{base_url}}/api/', headers: {}, body: '' }),
      });
      const data = await response.json();
      if (data.success || data.id) { await refreshRepeater(); return data.id; }
    } catch (error) { alert('Error creating request: ' + error); }
    return null;
  };

  const duplicateRequest = async (currentReq: RepeaterRequest) => {
    try {
      const response = await fetch('/api/repeater-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${currentReq.name} (Copy)`,
          groupId: currentReq.groupId,
          method: currentReq.method,
          url: currentReq.url,
          headers: currentReq.headers || {},
          body: currentReq.body || '',
        }),
      });
      const data = await response.json();
      if (data.success || data.id) { await refreshRepeater(); return data.id; }
    } catch (error) { alert('Error duplicating request: ' + error); }
    return null;
  };

  const deleteRequest = async (id: string) => {
    setRepeaterRequests(prev => prev.filter(r => r.id !== id));
    fetch(`/api/repeater-db/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const updateRequest = async (id: string, updates: Partial<RepeaterRequest>) => {
    setRepeaterRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    fetch(`/api/repeater-db/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }).catch(console.error);
  };

  const importPostman = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const collection = JSON.parse(text);
        const groupName = collection.info?.name || 'Postman Import';

        const response = await fetch('/api/repeater-import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection, group: groupName }),
        });
        const result = await response.json();

        if (result.success) {
          alert(`✓ Imported ${result.imported} request(s)`);
          await switchGroup('All');
        } else alert(`Error: ${result.error}`);
      } catch (error) { alert(`Failed to import: ${error}`); }
    };
    input.click();
  };

  const importProject = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        let importEnv = false;
        if (data.placeholders && Object.keys(data.placeholders).length > 0) {
          importEnv = confirm(`This project contains ${Object.keys(data.placeholders).length} environment variables. Would you like to import them as a new environment?`);
        }

        const response = await fetch('/api/repeater-import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, importEnv }),
        });
        const result = await response.json();

        if (result.success) {
          alert(`✓ Imported ${result.imported} request(s)${importEnv ? ' and environment variables' : ''}`);
          await refreshRepeater();
          if (importEnv) window.location.reload(); 
        } else alert(`Error: ${result.error}`);
      } catch (error) { alert(`Failed to import: ${error}`); }
    };
    input.click();
  };

  const createGroup = async (name: string) => {
    if (!name.trim()) return null;
    const res = await fetch('/api/repeater-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const data = await res.json();
    if (data.success) { await refreshRepeater(); return data.id; }
    return null;
  };

  const renameGroup = async (id: string, name: string) => {
    if (!name.trim()) return;
    setRepeaterGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));
    await fetch(`/api/repeater-groups/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  };

  const deleteGroup = async (id: string) => {
    setRepeaterGroups(prev => prev.filter(g => g.id !== id));
    setRepeaterRequests(prev => prev.filter(r => r.groupId !== id));

    await fetch(`/api/repeater-groups/${id}`, { method: 'DELETE' });

    if (activeGroupId === id) {
      await switchGroup('All');
    }
  };
  const reorderRequests = async (reorderedIds: string[]) => {
    // Optimistically update UI
    setRepeaterRequests(prev => {
      const sorted = [...prev].sort((a, b) => {
        const idxA = reorderedIds.indexOf(a.id);
        const idxB = reorderedIds.indexOf(b.id);
        return idxA - idxB;
      });
      return sorted;
    });

    try {
      await fetch('/api/repeater-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reorderedIds)
      });
    } catch (error) {
      console.error("Failed to save reorder:", error);
    }
  };

  return {
    repeaterRequests, repeaterGroups, activeGroupId, switchGroup,
    _setRawRepeater: setRepeaterRequests, _setRawGroups: setRepeaterGroups, initActiveGroup,
    refreshRepeater, addEmptyRequest, duplicateRequest, deleteRequest, updateRequest, importPostman,
    importProject, createGroup, renameGroup, deleteGroup, reorderRequests
  };
}
