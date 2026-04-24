import { useState } from 'react';
import { Traffic } from '@/types/traffic';

export function useTrafficLog() {
  const [traffic, setTraffic] = useState<Traffic[]>([]);

  const resumeRequest = async (id: string, modifiedData: any) => {
    await fetch(`http://127.0.0.1:3001/resume/${id}`, { method: 'POST', body: JSON.stringify(modifiedData) });
    setTraffic(prev => prev.map((t) => (t.id === id ? { ...t, is_intercepted: false } : t)));
  };

  return { traffic, setTraffic, resumeRequest };
}
