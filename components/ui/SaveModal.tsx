import { useState } from 'react';
import { Traffic } from '@/types/traffic';

interface Props {
  req: Traffic;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function SaveModal({ req, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('Uncategorized');
  const [saveReq, setSaveReq] = useState(true);
  const [saveRes, setSaveRes] = useState(true);

  const handleSave = () => {
    if (!name) return;

    // Extract only the fields we want to save
    const requestData = saveReq ? {
      method: req.method, url: req.url,
      headers: req.request_headers, body: req.request_body
    } : null;

    const responseData = saveRes ? {
      status_code: req.status_code,
      headers: req.response_headers, body: req.response_body
    } : null;

    onSave({ name, group, request: requestData, response: responseData });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-md p-6 space-y-6 shadow-2xl">
        <h2 className="text-sky-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
          <span className="opacity-50">#</span> Save_To_Vault
        </h2>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Entry Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IDOR on /api/users" className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded text-zinc-300 outline-none focus:border-sky-500 text-xs font-mono" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Group / Category</label>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Auth Bypass" className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded text-zinc-300 outline-none focus:border-sky-500 text-xs font-mono" />
          </div>

          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-mono text-zinc-400 cursor-pointer hover:text-white">
              <input type="checkbox" checked={saveReq} onChange={(e) => setSaveReq(e.target.checked)} className="accent-sky-500" /> Save Request
            </label>
            <label className="flex items-center gap-2 text-xs font-mono text-zinc-400 cursor-pointer hover:text-white">
              <input type="checkbox" checked={saveRes} onChange={(e) => setSaveRes(e.target.checked)} className="accent-amber-500" /> Save Response
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 text-zinc-500 hover:text-white text-xs uppercase font-bold tracking-widest">Cancel</button>
          <button onClick={handleSave} disabled={!name || (!saveReq && !saveRes)} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-30 text-white text-xs uppercase font-bold tracking-widest rounded transition-colors">Save Entry</button>
        </div>
      </div>
    </div>
  );
}
