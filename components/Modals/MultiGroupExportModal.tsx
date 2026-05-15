import { useState } from 'react';

interface MultiGroupExportModalProps {
  isOpen: boolean;
  groups: { id: string; name: string }[];
  onClose: () => void;
  onExport: (selectedGroupIds: string[], projectName: string) => void;
}

export function MultiGroupExportModal({ isOpen, groups, onClose, onExport }: MultiGroupExportModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('My Project Export');
  const [prevOpen, setPrevOpen] = useState(isOpen);

  if (isOpen && !prevOpen) {
    setPrevOpen(true);
    setSelectedIds(groups.map(g => g.id));
  } else if (!isOpen && prevOpen) {
    setPrevOpen(false);
  }

  if (!isOpen) return null;

  const toggleGroup = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    if (selectedIds.length > 0 && projectName.trim()) {
      onExport(selectedIds, projectName.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-backdrop backdrop-blur-sm px-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl shadow-app-shadow w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="text-zinc-200 font-bold uppercase tracking-widest text-[11px]">Multi-Group Export</h3>
        </div>
        <div className="p-4 flex flex-col gap-6">
          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block">Project Name</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 p-3 rounded text-amber-400 outline-none focus:border-purple-500 transition-colors text-xs font-mono font-bold"
              placeholder="Project name..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest block">Select Groups to Include</label>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded max-h-60 overflow-y-auto divide-y divide-zinc-800/50">
              {groups.length === 0 ? (
                <div className="p-4 text-center text-zinc-600 text-[10px] uppercase font-bold tracking-widest">No groups found</div>
              ) : (
                groups.map(group => (
                  <label key={group.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-800/50 transition-colors group">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 checked:bg-purple-600 text-purple-600 focus:ring-purple-500 focus:ring-offset-zinc-950"
                    />
                    <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${selectedIds.includes(group.id) ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-400'}`}>
                      {group.name}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex gap-2">
              <button onClick={() => setSelectedIds(groups.map(g => g.id))} className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-black tracking-tighter transition-colors">Select All</button>
              <button onClick={() => setSelectedIds([])} className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-black tracking-tighter transition-colors">Clear All</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors rounded">
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={selectedIds.length === 0 || !projectName.trim()}
                className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest bg-purple-600 hover:bg-purple-500 text-zinc-950 disabled:opacity-30 disabled:hover:bg-purple-600 transition-colors rounded shadow-lg shadow-purple-500/20"
              >
                Export {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
