import { readFile, writeFile } from 'node:fs/promises';

type Schema = Record<string, unknown>;
type ToolDefinition = { name: string; path: string; description: string; args?: Schema; submission?: boolean };
type SetupState = { secretId?: string; toolIds: Record<string, string>; agentId?: string; configuredAt?: string; publicApiUrl?: string };
const statePath = new URL('../.voice-state.json', import.meta.url);
const envPath = new URL('../../../.env', import.meta.url);
function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
async function provider<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai${path}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: { 'xi-api-key': env('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json() as { detail?: unknown };
    throw new Error(`ElevenLabs ${path}: HTTP ${response.status}; ${JSON.stringify(error.detail ?? 'request rejected').slice(0, 1200)}`);
  }
  return response.json() as Promise<T>;
}
function makeTool(tool: ToolDefinition, secretId: string) {
  const properties: Record<string, unknown> = {
    sessionId: { type: 'string', dynamic_variable: 'session_id' },
    conversationId: { type: 'string', dynamic_variable: 'system__conversation_id' },
    operationId: { type: 'string', description: 'Generate a UUID v4 for this operation. Reuse only for an exact retry.' },
  };
  if (tool.submission) Object.assign(properties, {
    confirmed: { type: 'boolean', description: 'True only after explicit customer confirmation to submit the latest draft.' },
    version: { type: 'integer', description: 'The version returned by the latest successful create_claim_draft call.' },
    confirmationText: { type: 'string', description: 'The actual words the customer used to confirm submission.' },
  });
  else properties.args = tool.args;
  return {
    type: 'webhook', name: tool.name, description: tool.description, response_timeout_secs: 60,
    tool_error_handling_mode: 'passthrough',
    api_schema: {
      url: `${env('PUBLIC_API_URL')}/api/voice/tools/${tool.path}`, method: 'POST',
      request_headers: { Authorization: { secret_id: secretId }, 'X-Session-Capability': { variable_name: 'secret__session_capability' } },
      request_body_schema: { type: 'object', properties, required: Object.keys(properties) },
    },
    dynamic_variables: { dynamic_variable_placeholders: { session_id: 'session-supplied-at-runtime', secret__session_capability: 'runtime-only' } },
  };
}
async function loadState(): Promise<SetupState> {
  try { return JSON.parse(await readFile(statePath, 'utf8')); }
  catch { return { toolIds: {} }; }
}
async function configure() {
  const tools = JSON.parse(await readFile(new URL('../tools.json', import.meta.url), 'utf8')) as ToolDefinition[];
  const prompt = await readFile(new URL('../agent-prompt.md', import.meta.url), 'utf8');
  if (!process.argv.includes('--apply')) {
    console.info(JSON.stringify({ mode: 'preview', agentName: 'CrashLine · Synthetic Claims', voiceModel: 'gemini-3.5-flash', apiUrl: env('PUBLIC_API_URL'), tools: tools.map((tool) => makeTool(tool, '<workspace-secret-id>')), auth: 'signed URLs only; no allowlist', secretValues: 'omitted' }, null, 2));
    return;
  }
  const state = await loadState();
  if (!state.secretId) {
    const secret = await provider<{ secret_id: string }>('/secrets', { type: 'new', name: 'CrashLine webhook sender', value: `Bearer ${env('ELEVENLABS_WEBHOOK_TOOL_SECRET')}` });
    state.secretId = secret.secret_id;
    await writeFile(statePath, JSON.stringify(state, null, 2));
  }
  for (const tool of tools) {
    const existing = state.toolIds[tool.name];
    const result = await provider<{ id: string }>(existing ? `/tools/${existing}` : '/tools', { tool_config: makeTool(tool, state.secretId) }, existing ? 'PATCH' : 'POST');
    state.toolIds[tool.name] = result.id ?? existing;
    await writeFile(statePath, JSON.stringify(state, null, 2));
  }
  const configuration = {
    name: 'CrashLine · Synthetic Claims', tags: ['crashline', 'synthetic-sandbox'],
    conversation_config: { agent: { language: 'en', first_message: 'Hi, I’m CrashLine, an automated accident reporting assistant for this synthetic demo. Before we begin, is anyone injured or in immediate danger?', prompt: { prompt, llm: 'gemini-3.5-flash', tool_ids: Object.values(state.toolIds) }, dynamic_variables: { dynamic_variable_placeholders: { session_id: 'runtime-session' } } } },
    platform_settings: { auth: { enable_auth: true }, overrides: { conversation_config_override: { agent: { prompt: { prompt: false } } } } },
  };
  const result = await provider<{ agent_id: string }>(state.agentId ? `/agents/${state.agentId}` : '/agents/create', configuration, state.agentId ? 'PATCH' : 'POST');
  state.agentId = result.agent_id ?? state.agentId;
  state.configuredAt = new Date().toISOString();
  state.publicApiUrl = env('PUBLIC_API_URL');
  await writeFile(statePath, JSON.stringify(state, null, 2));
  const currentEnv = await readFile(envPath, 'utf8');
  await writeFile(envPath, currentEnv.replace(/^ELEVENLABS_AGENT_ID=.*$/m, `ELEVENLABS_AGENT_ID=${state.agentId}`));
  console.info(JSON.stringify({ configured: true, agentId: state.agentId, tools: Object.keys(state.toolIds), secretValues: 'omitted' }));
}
await configure();
