import { readFile } from 'node:fs/promises';

export async function voiceReady() {
  try {
    const content = await readFile(new URL('../../../voice-agent/.voice-state.json', import.meta.url), 'utf8');
    const state = JSON.parse(content) as { agentId?: string; configuredAt?: string; publicApiUrl?: string; toolIds?: Record<string, string> };
    const tools = ['fetch_policy', 'create_claim_draft', 'submit_accident_report'];
    return Boolean(process.env.ELEVENLABS_API_KEY && state.agentId === process.env.ELEVENLABS_AGENT_ID && state.configuredAt && state.publicApiUrl === process.env.PUBLIC_API_URL && tools.every((name) => state.toolIds?.[name]));
  } catch { return false; }
}
