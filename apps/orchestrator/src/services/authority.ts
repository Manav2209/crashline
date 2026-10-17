import { ArmorIQClient, type IntentToken } from '@armoriq/sdk';
import { armorAction, toolScopes, type ExecutionContext, type ToolName } from '@crashline/contracts';
import { hash, required, signContext } from '@crashline/server';

export type ArmorPort = Pick<ArmorIQClient, 'capturePlan' | 'getIntentToken' | 'invoke'>;
export function createArmorClient(userEmail?: string): ArmorPort {
  const mcp = process.env.ARMORIQ_MCP_NAME ?? 'insurance-mcp';
  const client = new ArmorIQClient({
    apiKey: required('ARMORIQ_API_KEY'), timeout: 20000,
    ...(process.env.ARMORIQ_AGENT_ID ? { agentId: process.env.ARMORIQ_AGENT_ID } : {}),
    mcpCredentials: { [mcp]: { authType: 'bearer', token: required('MCP_ACCESS_TOKEN') } },
  });
  client.userEmailOverride = userEmail;
  return client;
}
export async function createAuthority(client: ArmorPort, ctx: ExecutionContext, tool: ToolName, args: Record<string, unknown>) {
  const mcp = process.env.ARMORIQ_MCP_NAME ?? 'insurance-mcp';
  const authorization = signContext({ context: ctx, tool, argsHash: hash(JSON.stringify(args)) });
  const params = { ...args, _authorization: authorization };
  const intent = `Synthetic accident intake/investigation for ${ctx.policyId}; role=${ctx.role}; claim=${ctx.claimId ?? 'new draft'}.`;
  const plan = client.capturePlan('trusted-workflow', intent, {
    goal: intent,
    steps: toolScopes[ctx.role].map((action) => ({ action: armorAction(action), mcp, params: action === tool ? params : {} })),
  }, { role: ctx.role, correlationId: ctx.correlationId, authority: 'independently-scoped-plan' });
  const token: IntentToken = await client.getIntentToken(plan, undefined, 120);
  return { token, params, mcp, action: armorAction(tool) };
}
