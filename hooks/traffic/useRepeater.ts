import { useState } from 'react';
import { RepeaterRequest } from '@/components/View/RepeaterView';

export function useRepeater(prefsRef: React.MutableRefObject<any>) {
  const [repeaterRequests, setRepeaterRequests] = useState<RepeaterRequest[]>([]);

  const updateRepeater = (requests: RepeaterRequest[]) => {
    setRepeaterRequests(requests);
    if (prefsRef.current.repeater) fetch('/api/repeater-db', { method: 'POST', body: JSON.stringify(requests) });
  };

  return { repeaterRequests, setRepeaterRequests: updateRepeater, _setRawRepeater: setRepeaterRequests };
}
