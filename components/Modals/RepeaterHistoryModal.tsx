import { useState, useEffect } from 'react';
import HttpResponseViewer from '../ui/HttpResponseViewer';

interface HistoryItem {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  response: {
    status: number;
    headers: Record<string, string>;
    body: string;
  };
  timestamp: number;
}

interface RepeaterHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  repeaterId: string;
  repeaterName: string;
}

export function RepeaterHistoryModal({ isOpen, onClose, repeaterId, repeaterName }: RepeaterHistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && repeaterId) {
      fetchHistory();
    }
  }, [isOpen, repeaterId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/repeater/${repeaterId}/history`);
      const data = await res.json();
      setHistory(data);
      if (data.length > 0) setSelectedItem(data[0]);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Are you sure you want to clear the history for this request?')) return;
    try {
      await fetch(`/api/repeater/${repeaterId}/history`, { method: 'DELETE' });
      setHistory([]);
      setSelectedItem(null);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  if (!isOpen) return null;

  const buildRawRequest = (item: HistoryItem) => {
    let path = item.url;
    try {
      const parsed = new URL(item.url);
      path = parsed.pathname + parsed.search + parsed.hash;
    } catch { }
    const firstLine = `${item.method} ${path} HTTP/1.1`;
    const headers = Object.entries(item.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
    return `${firstLine}\n${headers}\n\n${item.body}`;
  };

  const buildRawResponse = (item: HistoryItem) => {
    const firstLine = `HTTP/1.1 ${item.response.status}`;
    const headers = Object.entries(item.response.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
    return `${firstLine}\n${headers}\n\n${item.response.body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-6xl h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                <path d="M12 8v4l3 3" /><circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <div>
              <h2 className="text-zinc-100 font-black uppercase text-xs tracking-tighter">Request_History</h2>
              <p className="text-zinc-500 text-[10px] font-mono">{repeaterName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearHistory}
              disabled={history.length === 0}
              className="px-3 py-1.5 text-rose-500 hover:bg-rose-500/10 rounded text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-20"
            >
              Clear_History
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - List of history items */}
          <div className="w-72 border-r border-zinc-800 overflow-y-auto bg-zinc-950">
            {isLoading ? (
              <div className="p-10 text-center text-zinc-600 animate-pulse uppercase text-[10px] font-bold tracking-widest">Loading...</div>
            ) : history.length === 0 ? (
              <div className="p-10 text-center text-zinc-600 uppercase text-[10px] font-bold tracking-widest">No history yet</div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`p-3 border-b border-zinc-900/50 cursor-pointer transition-all ${selectedItem?.id === item.id ? 'bg-purple-500/10 border-l-4 border-l-purple-500' : 'hover:bg-zinc-900 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-black uppercase ${item.response.status >= 400 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {item.response.status}
                    </span>
                    <span className="text-zinc-600 text-[9px] font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-300 truncate font-mono">
                    {item.method} {item.url}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Main Viewer */}
          <div className="flex-1 overflow-hidden flex flex-col bg-zinc-900/20">
            {selectedItem ? (
              <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
                <div className="space-y-3">
                  <h3 className="text-purple-500 font-bold uppercase text-[9px] tracking-widest"># Captured_Request</h3>
                  <div className="border border-zinc-800 rounded bg-zinc-950 min-h-[200px] shadow-inner shadow-black/50">
                    <HttpResponseViewer text={buildRawRequest(selectedItem)} />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-amber-500 font-bold uppercase text-[9px] tracking-widest"># Captured_Response</h3>
                  <div className="border border-zinc-800 rounded bg-zinc-950 min-h-[200px] shadow-inner shadow-black/50">
                    <HttpResponseViewer text={buildRawResponse(selectedItem)} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-700 uppercase font-black tracking-tighter text-2xl opacity-20 select-none">
                Select an Item
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
