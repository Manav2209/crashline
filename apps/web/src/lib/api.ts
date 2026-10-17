export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('crashline-access-token');
  const response = await fetch(`/api${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message ?? 'Could not connect to the workspace.');
  return body as T;
}
export function post<T>(path: string, body: unknown = {}, operationId?: string) {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body), ...(operationId ? { headers: { 'Idempotency-Key': operationId } } : {}) });
}
export function formatDate(value: string | null, time = false) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value));
}
export function shortId(id: string) { return id.startsWith('CLM-') ? id : `CLM-${id.slice(0, 8).toUpperCase()}`; }
