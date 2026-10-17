import { ArmorIQClient } from '@armoriq/sdk';
import { armorAction, toolScopes } from '@crashline/contracts';
import { required } from '@crashline/server';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';

const registrationSchema = z.object({
  success: z.literal(true), agent: z.object({ agentId: z.string().uuid(), name: z.string() }),
  registered_mcps: z.array(z.object({ mcpId: z.string().uuid(), name: z.string(), url: z.string().url() })),
  policies: z.array(z.object({ policyId: z.string().uuid(), name: z.string(), targetId: z.string().uuid() })),
});
async function saveRegistration(data: z.infer<typeof registrationSchema>) {
  const envPath = new URL('../../../.env', import.meta.url);
  const content = await readFile(envPath, 'utf8');
  const setting = `ARMORIQ_AGENT_ID=${data.agent.agentId}`;
  const updated = /^ARMORIQ_AGENT_ID=.*$/m.test(content)
    ? content.replace(/^ARMORIQ_AGENT_ID=.*$/m, setting) : `${content.trimEnd()}\n${setting}\n`;
  await writeFile(envPath, updated);
  await mkdir(new URL('../../../.tools/', import.meta.url), { recursive: true });
  await writeFile(new URL('../../../.tools/armoriq-registration.json', import.meta.url), JSON.stringify({
    ...data, registeredAt: new Date().toISOString(), liveExecutionVerified: false,
  }, null, 2));
}

const client = new ArmorIQClient({ apiKey: required('ARMORIQ_API_KEY'), timeout: 15000 });
const bootstrap = await client.bootstrap();
const mcp = process.env.ARMORIQ_MCP_NAME ?? 'insurance-mcp';
const allowed = [...new Set(Object.values(toolScopes).flat())];
const payload = {
  ...(process.argv.includes('--replace-policy') ? { onConflict: 'replace' } : {}),
  version: 'v1', environment: 'sandbox',
  identity: { api_key: '$ARMORIQ_API_KEY', user_id: 'DEMO-001', agent_id: 'crashline' },
  proxy: { url: 'https://proxy.armoriq.ai', timeout: 30, max_retries: 0 },
  mcp_servers: [{ id: mcp, url: required('INSURANCE_MCP_ENDPOINT'), description: 'CrashLine synthetic insurance sandbox', auth: { type: 'bearer', token: required('MCP_ACCESS_TOKEN') } }],
  policy: { allow: allowed.map((tool) => `${mcp}.${armorAction(tool)}`), deny: [`${mcp}.${armorAction('claims.approve_settlement')}`, `${mcp}.${armorAction('policy.change_coverage')}`] },
  intent: { ttl_seconds: 120, require_csrg: true },
};
const response = await fetch('https://api.armoriq.ai/iap/sdk/register', {
  method: 'POST', headers: { Authorization: `Bearer ${required('ARMORIQ_API_KEY')}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload), signal: AbortSignal.timeout(45000),
});
const data = await response.json() as Record<string, unknown>;
console.info(JSON.stringify({ status: response.status, responseKeys: Object.keys(data), success: response.ok && data.success !== false, previousMcpCount: Array.isArray(bootstrap.mcps) ? bootstrap.mcps.length : null }));
if (!response.ok || data.success !== true) {
  const message = String(data.message ?? 'ArmorIQ did not accept the registration.').replace(/(?:ak_(?:live|test|claw)_|sk[-_])[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 1500);
  console.info(JSON.stringify({ code: data.code, message, conflicts: data.conflicts, imported: data.imported }));
  process.exitCode = 1;
} else {
  const registration = registrationSchema.parse(data);
  await saveRegistration(registration);
  console.info(JSON.stringify({ agentId: registration.agent.agentId, mcpNames: registration.registered_mcps.map((item) => item.name), next: 'Run bun run armoriq:check, then security:live. Registration is not execution evidence.' }));
}
