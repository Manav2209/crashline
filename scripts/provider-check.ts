import { ArmorIQClient } from '../apps/orchestrator/node_modules/@armoriq/sdk';

async function checkProviders() {
  const armor = new ArmorIQClient({ apiKey: process.env.ARMORIQ_API_KEY, timeout: 15000 });
  try {
    const bootstrap = await armor.bootstrap();
    console.info(JSON.stringify({ service: 'armoriq', status: 'connected', responseKeys: Object.keys(bootstrap) }));
  } catch (error) {
    console.info(JSON.stringify({ service: 'armoriq', status: 'failed', errorType: error instanceof Error ? error.name : 'unknown' }));
  }
  const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY ?? '' }, signal: AbortSignal.timeout(15000),
  });
  const data = await response.json() as { agents?: { agent_id: string; name: string }[] };
  console.info(JSON.stringify({ service: 'elevenlabs', httpStatus: response.status, agents: data.agents?.map((agent) => ({ id: agent.agent_id, name: agent.name })) ?? [] }));
}
await checkProviders();
