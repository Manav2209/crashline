import { useCallback, useEffect, useRef, useState } from 'react';
import { api, post } from './api';
import { createEventRefresh } from './event-refresh';

export function useResource<T>(path: string, interval = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try { const result = await api<T>(path); if (request === sequence.current) { setData(result); setError(''); } }
    catch (failure) { if (request === sequence.current) setError(failure instanceof Error ? failure.message : 'Unable to load data.'); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [path]);
  useEffect(() => {
    setLoading(true);
    void refresh();
    const timer = interval ? setInterval(() => { void refresh(); }, interval) : undefined;
    return () => { sequence.current++; clearInterval(timer); };
  }, [refresh, interval]);
  return { data, error, loading, refresh };
}
export function useClaimEvents(claimId: string, refresh: () => void) {
  useEffect(() => {
    let source: EventSource | undefined;
    let cancelled = false;
    const updates = createEventRefresh(() => { if (!cancelled) refresh(); });
    let retry: ReturnType<typeof setTimeout>;
    async function connect() {
      try {
        const { ticket } = await post<{ ticket: string }>(`/claims/${claimId}/event-ticket`);
        if (cancelled) return;
        source = new EventSource(`/api/claims/${claimId}/events?ticket=${encodeURIComponent(ticket)}`);
        source.onmessage = () => updates.schedule();
        source.onerror = () => { source?.close(); if (!cancelled) retry = setTimeout(() => { void connect(); }, 5000); };
      } catch { if (!cancelled) retry = setTimeout(() => { void connect(); }, 5000); }
    }
    void connect();
    return () => { cancelled = true; clearTimeout(retry); updates.cancel(); source?.close(); };
  }, [claimId, refresh]);
}
