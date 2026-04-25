import { useState } from 'react';
import { RepeaterRequest } from '@/components/View/RepeaterView';

export interface RepeaterGroup { id: string; name: string; orderIndex?: number; }

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
    if (activeGroupId === id) await switchGroup('All'); // switchGroup automatically handles saving the state!
    await fetch(`/api/repeater-groups/${id}`, { method: 'DELETE' });
  };

  return {
    repeaterRequests, repeaterGroups, activeGroupId, switchGroup,
    _setRawRepeater: setRepeaterRequests, _setRawGroups: setRepeaterGroups, initActiveGroup,
    refreshRepeater, addEmptyRequest, duplicateRequest, deleteRequest, updateRequest, importPostman,
    createGroup, renameGroup, deleteGroup
  };
}
