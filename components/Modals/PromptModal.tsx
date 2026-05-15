import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  initialValue?: string;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export function PromptModal({ isOpen, title, initialValue = '', onClose, onSubmit }: PromptModalProps) {
  const [value, setValue] = useState(initialValue);
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevInitial, setPrevInitial] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  if (isOpen && (!prevOpen || initialValue !== prevInitial)) {
    setPrevOpen(true);
    setPrevInitial(initialValue);
    setValue(initialValue);
  } else if (!isOpen && prevOpen) {
    setPrevOpen(false);
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-backdrop backdrop-blur-sm px-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl shadow-app-shadow w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="text-zinc-200 font-bold uppercase tracking-widest text-[11px]">{title}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 p-3 rounded text-amber-400 outline-none focus:border-emerald-500 transition-colors text-xs font-mono font-bold placeholder:text-zinc-600"
            placeholder="Type here..."
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={!value.trim()} className="px-6">
              Confirm
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
