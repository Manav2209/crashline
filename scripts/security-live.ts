import { db } from '../packages/db/src';
import { createSession, confirmDraft } from '../apps/api/src/services/sessions';
import { resolveContext } from '../apps/orchestrator/src/services/context';
import { invokeTool } from '../apps/orchestrator/src/services/gateway';
import { draftSchema, type ToolName, type Role } from '../packages/contracts/src';
import { claimJob } from '../apps/orchestrator/src/services/jobs';
import { investigate } from '../apps/orchestrator/src/services/investigations';

async function assertLiveBlock(sessionId: string, role: Role, tool: ToolName, args: Record<string, unknown>, runId: string) {
  const ctx = await resolveContext(sessionId, role, crypto.randomUUID(), crypto.randomUUID(), runId);
  const before = await db.mcpInvocation.count({ where: { operationId: ctx.operationId } });
  try { await invokeTool(ctx, tool, args); throw new Error('Expected ArmorIQ to reject the operation.'); }
  catch {
    const attempt = await db.toolAttempt.findFirstOrThrow({ where: { operationId: ctx.operationId } });
    if (attempt.decision !== 'BLOCK') throw new Error(`Live enforcement was ${attempt.decision}; this is not a proven block.`);
    const after = await db.mcpInvocation.count({ where: { operationId: ctx.operationId } });
    if (before !== after || attempt.executed) throw new Error('Blocked action reached the MCP handler.');
    return { tool, role, decision: attempt.decision, source: attempt.enforcementSource, reason: attempt.reason, planHash: attempt.planHash, planId: attempt.armorPlanId, handlerInvocations: after - before };
  }
}
async function proveSecurity() {
  const session = await createSession();
  const ctx = await resolveContext(session.sessionId, 'INTAKE', crypto.randomUUID(), crypto.randomUUID());
  const input = draftSchema.parse({ incidentAt: '2026-10-15T09:30:00+05:30', location: 'Demo City — Main Street signal', description: 'Synthetic live enforcement test: rear-ended while waiting at a red light.', injuryStatus: 'none_reported', otherPartyInvolved: true });
  const result = await invokeTool(ctx, 'claims.create_draft', input) as { claimId: string; version: number };
  await invokeTool(ctx, 'claims.create_draft', input);
  const claim = await db.claim.findUniqueOrThrow({ where: { id: result.claimId } });
  if (claim.version !== 1) throw new Error('Duplicate mutation changed the claim version.');
  await confirmDraft(session.sessionId, claim.version, 'Synthetic live test harness confirmation: submit these fictional incident facts.');
  const submitCtx = await resolveContext(session.sessionId, 'INTAKE', crypto.randomUUID(), crypto.randomUUID());
  await invokeTool(submitCtx, 'claims.submit_fnol', {});
  const queued = await db.investigationRun.findUniqueOrThrow({ where: { claimId_claimVersion: { claimId: claim.id, claimVersion: claim.version } } });
  const run = await claimJob(queued.id, 'live-security-harness');
  if (!run) throw new Error('A background worker already claimed the test run. Stop it before running this isolated live harness.');
  const renewal = setInterval(() => {
    void db.investigationRun.updateMany({ where: { id: run.id, status: 'RUNNING', leaseOwner: run.leaseOwner, attempt: run.attempt }, data: { leaseUntil: new Date(Date.now() + 120000) } }).catch(() => {});
  }, 30000);
  try {
    const policyBefore = JSON.stringify(await db.policy.findUnique({ where: { id: ctx.policyId } }));
    const blocks = [];
    blocks.push(await assertLiveBlock(session.sessionId, 'INVESTIGATOR', 'claims.approve_settlement', { amount: 12000 }, run.id));
    blocks.push(await assertLiveBlock(session.sessionId, 'POLICY_AGENT', 'policy.change_coverage', { effectiveFrom: '2025-01-01T00:00:00Z' }, run.id));
    blocks.push(await assertLiveBlock(session.sessionId, 'POLICY_AGENT', 'claims.get_details', {}, run.id));
    if (JSON.stringify(await db.policy.findUnique({ where: { id: ctx.policyId } })) !== policyBefore) throw new Error('Policy changed during a forbidden operation.');
    await investigate(run);
    const report = await db.investigationReport.findUniqueOrThrow({ where: { runId: run.id } });
    if (report.partial) throw new Error('The live investigation produced a partial report. Inspect actual activity before claiming a complete demo.');
    const allowed = await db.toolAttempt.findMany({ where: { sessionId: session.sessionId, decision: 'ALLOW', resultStatus: 'SUCCESS' }, select: { mcpTool: true, agentType: true, planHash: true, armorPlanId: true, armorTraceId: true, enforcementSource: true, executed: true } });
    const evidence = { createdAt: new Date().toISOString(), source: 'live @armoriq/sdk + remote proxy + insurance-mcp', claimId: claim.id, runId: run.id, reportId: report.id, idempotentDraft: true, allowed, blocks };
    await Bun.write(new URL('../docs/live-security-evidence.json', import.meta.url), JSON.stringify(evidence, null, 2));
    console.info(JSON.stringify(evidence, null, 2));
  } finally {
    clearInterval(renewal);
    const unfinished = await db.investigationRun.updateMany({ where: { id: run.id, status: 'RUNNING', leaseOwner: run.leaseOwner, attempt: run.attempt }, data: { status: 'FAILED', finishedAt: new Date(), leaseUntil: null, leaseOwner: null, error: 'Live harness did not finish; inspect actual activity.' } });
    if (unfinished.count) await db.claim.update({ where: { id: claim.id }, data: { status: 'INVESTIGATION_FAILED' } });
  }
}
try { await proveSecurity(); }
catch (error) { console.error(error instanceof Error ? error.message : 'Live security checks failed.'); process.exitCode = 1; }
finally { await db.$disconnect(); }
