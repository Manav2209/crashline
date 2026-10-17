import { required, Problem } from '@crashline/server';
import type { ToolName } from '@crashline/contracts';

export async function forwardTool(sessionId: string, tool: ToolName, args: Record<string, unknown>, correlationId: string, operationId: string) {
  const response = await fetch(`${required('ORCHESTRATOR_URL')}/internal/tools/execute`, {
    method: 'POST', signal: AbortSignal.timeout(55000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${required('INTERNAL_SERVICE_TOKEN')}` },
    body: JSON.stringify({ sessionId, tool, args, correlationId, operationId }),
  });
  const data = await response.json() as { code?: string; message?: string };
  if (!response.ok) throw new Problem(response.status, data.code ?? 'tool_failed', data.message ?? 'The operation could not be completed.');
  return data;
}
