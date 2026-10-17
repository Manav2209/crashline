import { db } from '../../packages/db/src';
import { draftSchema, type ExecutionContext, type ToolName } from '../../packages/contracts/src';
import { hash, signContext } from '../../packages/server/src';
import { createSession, confirmDraft } from '../../apps/api/src/services/sessions';
import { resolveContext } from '../../apps/orchestrator/src/services/context';
import { executeTool } from '../../apps/insurance-mcp/src/services/tools';

const sessions: string[] = [];
const operations: string[] = [];
export function operation() { const id = crypto.randomUUID(); operations.push(id); return id; }
export function signedArgs(ctx: ExecutionContext, tool: ToolName, args: Record<string, unknown>) {
  return { ...args, _authorization: signContext({ context: ctx, tool, argsHash: hash(JSON.stringify(args)) }) };
}
export async function fixture(investigating = false) {
  const session = await createSession(); sessions.push(session.sessionId);
  const ctx = await resolveContext(session.sessionId, 'INTAKE', crypto.randomUUID(), operation());
  const draft = draftSchema.parse({ incidentAt: '2026-10-15T09:30:00+05:30', location: 'Synthetic Reliability Test Signal', description: 'Synthetic test: a rear-end collision while stopped.', injuryStatus: 'none_reported' });
  const created = await executeTool('claims.create_draft', signedArgs(ctx, 'claims.create_draft', draft)) as { claimId: string; version: number };
  if (!investigating) return { ctx: { ...ctx, operationId: operation(), claimId: created.claimId }, draft, session, claimId: created.claimId, run: null };
  await confirmDraft(session.sessionId, created.version, 'I confirm this synthetic test report.');
  const submitCtx = { ...ctx, operationId: operation(), claimId: created.claimId };
  await executeTool('claims.submit_fnol', signedArgs(submitCtx, 'claims.submit_fnol', {}));
  const run = await db.investigationRun.update({
    where: { claimId_claimVersion: { claimId: created.claimId, claimVersion: created.version } },
    data: { status: 'RUNNING', attempt: 1, leaseOwner: crypto.randomUUID(), leaseUntil: new Date(Date.now() + 120000) },
  });
  await db.claim.update({ where: { id: created.claimId }, data: { status: 'INVESTIGATING' } });
  const agentCtx = await resolveContext(session.sessionId, 'ORCHESTRATOR', crypto.randomUUID(), operation(), run.id);
  return { ctx: agentCtx, draft, session, claimId: created.claimId, run };
}
export async function cleanFixtures() {
  const records = await db.intakeSession.findMany({ where: { id: { in: sessions } }, select: { claimId: true } });
  const claimIds = records.flatMap((record) => record.claimId ? [record.claimId] : []);
  await db.toolAttempt.deleteMany({ where: { sessionId: { in: sessions } } });
  await db.activityEvent.deleteMany({ where: { claimId: { in: claimIds } } });
  await db.investigationReport.deleteMany({ where: { claimId: { in: claimIds } } });
  await db.agentFinding.deleteMany({ where: { run: { claimId: { in: claimIds } } } });
  await db.investigationRun.deleteMany({ where: { claimId: { in: claimIds } } });
  await db.intakeSession.deleteMany({ where: { id: { in: sessions } } });
  await db.claim.deleteMany({ where: { id: { in: claimIds } } });
  await db.mcpInvocation.deleteMany({ where: { operationId: { in: operations } } });
  await db.toolExecution.deleteMany({ where: { operationId: { in: operations } } });
}
