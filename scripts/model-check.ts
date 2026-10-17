const response = await fetch(`${process.env.MODEL_BASE_URL}/chat/completions`, {
  method: 'POST', signal: AbortSignal.timeout(45000),
  headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: process.env.MODEL_NAME, max_tokens: 20, messages: [{ role: 'user', content: 'Reply with exactly: connected' }] }),
});
const data = await response.json() as { choices?: { message: { content: string } }[]; error?: { type?: string; message?: string }; usage?: unknown };
console.info(JSON.stringify({ provider: 'AIRouter', model: process.env.MODEL_NAME, status: response.status, connected: response.ok, usage: data.usage, errorType: data.error?.type }));
