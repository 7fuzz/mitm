import { useEffect, useState } from 'react';
import { Traffic } from '@/types/traffic';
import HttpResponseViewer from './HttpResponseViewer';
import { SaveModal } from '../ui/SaveModal';

interface Props {
  req: Traffic;
  onSendToRepeater?: (req: Traffic) => void;
}

const buildRawHttpMessage = (headers: Record<string, string>, body: string) => {
  const headerText = Object.entries(headers || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  return `${headerText}\n\n${body || ''}`;
};

export function TrafficDetail({ req, onSendToRepeater }: Props) {
  const [showSaveModal, setShowSaveModal] = useState(false);

  const handleSave = async (data: any) => {
    await fetch('/api/saved', { method: 'POST', body: JSON.stringify(data) });
  };
  const copyAsCurl = () => {
    const curl = `curl -X ${req.method} '${req.url}' ${Object.entries(req.request_headers)
      .map(([k, v]) => `-H '${k}: ${v}'`)
      .join(' ')}`;
    navigator.clipboard.writeText(curl);
  };

  const rawRequest = buildRawHttpMessage(req.request_headers, req.request_body);
  const rawResponse = buildRawHttpMessage(req.response_headers, req.response_body);

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-950 p-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="max-w-5xl mx-auto space-y-8">

        <header className="flex justify-between items-start border-b border-zinc-800 pb-4">
          <div className="space-y-1 w-3/4">
            <h3 className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest">// TARGET_URL</h3>
            <div className="text-emerald-100 break-all bg-zinc-900/50 p-2 rounded border border-zinc-800/50">{req.url}</div>
          </div>
          <button onClick={() => setShowSaveModal(true)} className="px-4 py-2 bg-sky-900/30 hover:bg-sky-600 text-sky-400 hover:text-white text-[10px] rounded border border-sky-800 transition-all uppercase font-bold">
            Save_to_Vault
          </button>
          <button
            onClick={() => onSendToRepeater?.(req)}
            className="px-4 py-2 bg-purple-900/30 hover:bg-purple-600 text-purple-400 hover:text-white text-[10px] rounded border border-purple-800 transition-all uppercase font-bold"
          >
            Send_to_Repeater
          </button>
          <button
            onClick={copyAsCurl}
            className="px-3 py-1 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white text-[10px] rounded border border-zinc-700 transition-all uppercase font-bold"
          >
            Copy_as_cURL
          </button>
        </header>

        <div className="flex flex-col gap-10 pb-12">
          <div className="space-y-4">
            <h3 className="text-sky-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="opacity-50">#</span> Request_Payload
            </h3>
            <HttpResponseViewer text={rawRequest} />
          </div>

          <div className="space-y-4">
            <h3 className="text-amber-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="opacity-50">#</span> Response_Payload
            </h3>
            {req.status_code === 0 ? (
              <div className="h-[200px] flex items-center justify-center border border-zinc-800 border-dashed rounded bg-zinc-900/20 text-zinc-600 text-[10px] uppercase tracking-widest">
                Awaiting Response...
              </div>
            ) : (
              <HttpResponseViewer text={rawResponse} />
            )}
          </div>

        </div>
      </div>
      {showSaveModal && <SaveModal req={req} onClose={() => setShowSaveModal(false)} onSave={handleSave} />}
    </div>
  );
}
