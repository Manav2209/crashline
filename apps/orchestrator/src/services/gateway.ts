import { IntentMismatchException, PolicyBlockedException, PolicyHoldException, type IntentToken } from '@armoriq/sdk';
import { toolSchemas, type ExecutionContext, type ToolName } from '@crashline/contracts';
import { db, Prisma } from '@crashline/db';
import { executionFingerprint, Problem } from '@crashline/server';
import { createArmorClient, createAuthority, type ArmorPort } from './authority';

type Outcome = {
  decision: string; reason: string; enforcementSource: string; resultStatus: string;
  executed: boolean; mcpInvoked: boolean; traceId?: string;
};

function safeReason(error: unknown) {
  const text = error instanceof Error ? error.message : 'Enforcement could not be verified.';
  return text.replace(/(?:ak_(?:live|test|claw)_|sk[-_])[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 1000);
}
function classifyFailure(error: unknown) {
  if (error instanceof IntentMismatchException) return { decision: 'BLOCK', enforcementSource: 'ARMORIQ_SDK_PLAN', reason: `ArmorIQ SDK plan enforcement: ${safeReason(error)}` };
  if (error instanceof PolicyBlockedException || (error instanceof Error && error.name === 'PolicyBlockedException')) {
    return { decision: 'BLOCK', enforcementSource: 'ARMORIQ_POLICY', reason: `ArmorIQ policy enforcement: ${safeReason(error)}` };
  }
  if (error instanceof PolicyHoldException || (error instanceof Error && error.name === 'PolicyHoldException')) {
    return { decision: 'HOLD', enforcementSource: 'ARMORIQ_POLICY', reason: 'ArmorIQ requires human approval. This action was not automatically retried.' };
  }
  return { decision: 'UNAVAILABLE', enforcementSource: 'UNVERIFIED', reason: 'enforcement_unavailable: the operation could not be verified; no direct MCP fallback was attempted.' };
}
function toolError(result: unknown) {
  const payload = result as { content?: { type?: string; text?: string }[] } | null;
  const message = payload?.content?.find((item) => item.type === 'text')?.text;
  return safeReason(new Error(message ?? 'The authorized MCP operation did not complete.'));
}
async function recordAttempt(ctx: ExecutionContext, tool: ToolName, outcome: Outcome, token?: IntentToken) {
  const session = await db.intakeSession.findUniqueOrThrow({ where: { id: ctx.sessionId } });
  await db.$transaction(async (tx) => {
    await tx.toolAttempt.create({ data: {
      operationId: ctx.operationId, sessionId: ctx.sessionId, runId: ctx.runId,
      claimId: session.claimId, agentType: ctx.role, mcpTool: tool,
      requestJson: { argumentValues: 'omitted', operationId: ctx.operationId },
      decision: outcome.decision, reason: outcome.reason, executed: outcome.executed,
      armorTraceId: outcome.traceId, armorPlanId: token?.planId, planHash: token?.planHash,
      enforcementSource: outcome.enforcementSource, resultStatus: outcome.resultStatus,
      mcpInvoked: outcome.mcpInvoked, correlationId: ctx.correlationId,
    } });
    await tx.activityEvent.create({ data: {
      claimId: session.claimId, runId: ctx.runId, eventType: 'security.decision',
      payloadJson: { tool, role: ctx.role, ...outcome, correlationId: ctx.correlationId },
    } });
  });
}
export async function invokeTool(ctx: ExecutionContext, tool: ToolName, input: unknown, port?: ArmorPort) {
  const args = toolSchemas[tool].parse(input) as Record<string, unknown>;
  const fingerprint = executionFingerprint(ctx, tool, args);
  let token: IntentToken | undefined;
  let result: Prisma.JsonValue | undefined;
  const outcome: Outcome = { decision: 'UNAVAILABLE', reason: '', enforcementSource: 'UNVERIFIED', resultStatus: 'NOT_EXECUTED', executed: false, mcpInvoked: false };
  try {
    const client = port ?? createArmorClient(ctx.userEmail);
    const authority = await createAuthority(client, ctx, tool, args);
    token = authority.token;
    const response = await client.invoke(authority.mcp, authority.action, token, authority.params, undefined, ctx.userEmail);
    if (!response.verified) throw new Problem(502, 'unverified_execution', 'The provider did not verify the call.');
    outcome.decision = 'ALLOW';
    outcome.enforcementSource = 'ARMORIQ_PROXY';
    outcome.traceId = typeof response.metadata?.trace_id === 'string' ? response.metadata.trace_id : undefined;
    if (response.status !== 'success') throw new Problem(422, 'domain_rejected', toolError(response.result));
    const receipt = await db.toolExecution.findUnique({ where: { operationId: ctx.operationId } });
    if (!receipt || receipt.requestHash !== fingerprint) throw new Problem(502, 'missing_receipt', 'The authorized call has no matching execution receipt.');
    outcome.reason = 'ArmorIQ verified the plan-bound call; the MCP operation has a matching persisted execution receipt.';
    outcome.resultStatus = 'SUCCESS';
    result = receipt.resultJson;
  } catch (error) {
    if (outcome.decision === 'ALLOW') {
      outcome.resultStatus = 'ERROR'; outcome.reason = safeReason(error);
    } else Object.assign(outcome, classifyFailure(error));
  }
  const [receipt, invocations] = await Promise.all([
    db.toolExecution.findUnique({ where: { operationId: ctx.operationId } }),
    db.mcpInvocation.count({ where: { operationId: ctx.operationId, tool } }),
  ]);
  outcome.executed = receipt?.requestHash === fingerprint;
  outcome.mcpInvoked = invocations > 0;
  await recordAttempt(ctx, tool, outcome, token);
  if (outcome.decision !== 'ALLOW') throw new Problem(outcome.decision === 'BLOCK' ? 403 : 503, outcome.decision === 'BLOCK' ? 'armoriq_blocked' : 'enforcement_unavailable', outcome.reason);
  if (outcome.resultStatus !== 'SUCCESS') throw new Problem(422, 'tool_execution_failed', outcome.reason);
  return result;
}
