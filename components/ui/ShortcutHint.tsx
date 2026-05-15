'use client';

interface ShortcutHintProps {
  isOpen: boolean;
  simpleMode: boolean;
}

export function ShortcutHint({ isOpen, simpleMode }: ShortcutHintProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'h', label: 'History' },
    { key: 'i', label: 'Intercept' },
    { key: 'r', label: 'Repeater' },
  ];

  if (!simpleMode) {
    shortcuts.push({ key: 'w', label: 'Workspace' });
    shortcuts.push({ key: 'u', label: 'Utilities' });
  }

  shortcuts.push({ key: 'o', label: 'Options' });

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-xl shadow-2xl p-1 flex gap-1 items-center">
        <div className="px-3 py-1.5 text-zinc-500 font-black text-[10px] uppercase tracking-widest border-r border-zinc-800 mr-1">
          Go_To
        </div>
        {shortcuts.map((s) => (
          <div key={s.key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
            <kbd className="min-w-5 h-5 flex items-center justify-center bg-zinc-950 border border-zinc-700 rounded text-[10px] font-bold text-emerald-text uppercase">
              {s.key}
            </kbd>
            <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
