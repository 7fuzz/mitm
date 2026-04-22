import { useEffect, useState } from "react";

// Live Timer Component
export const InterceptTimer = ({ startTime }: { startTime: number }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Initial calculation
    setElapsed(Math.floor((Date.now() - startTime) / 1000));

    // Tick every second
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');

  // Turn text red if it's been paused for more than 30 seconds (might cause app timeout)
  const isWarning = elapsed > 30;

  return (
    <div className={`flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded bg-zinc-900/50 border border-zinc-800 ${isWarning ? 'text-rose-400' : 'text-zinc-400'}`}>
      <span className="w-2 h-2 rounded-full animate-pulse bg-current" />
      Paused: {m}:{s}
    </div>
  );
};
