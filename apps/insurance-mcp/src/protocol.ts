export function normalizeProxyMessage(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  // ArmorIQ adds envelope metadata outside JSON-RPC. It grants no domain authority.
  const { _iam_context: _ignored, ...message } = body as Record<string, unknown>;
  return message;
}
