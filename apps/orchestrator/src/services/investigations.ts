import { db, Prisma, type InvestigationRun } from '@crashline/db';
import { type Role } from '@crashline/contracts';
import { Problem } from '@crashline/server';
import { resolveContext } from './context';
import { invokeTool } from './gateway';
import { mergeFindings } from './reports';
import { runSpecialist } from './specialists';
import { setAgentStatus } from './leases';

async function saveSpecialist(run: InvestigationRun, sessionId: string, role: Role) {
  const existing = await db.agentFinding.findUnique({ where: { runId_agentType: { runId: run.id, agentType: role } } });
  if (existing) { await setAgentStatus(run, role, 'COMPLETED'); return existing.payloadJson; }
  await setAgentStatus(run, role, 'RUNNING');
  const ctx = await resolveContext(sessionId, role, crypto.randomUUID(), crypto.randomUUID(), run.id, { owner: run.leaseOwner, attempt: run.attempt });
  try {
    const finding = await runSpecialist(ctx, AbortSignal.timeout(90000));
    await db.$transaction(async (tx) => {
      await setAgentStatus(run, role, 'COMPLETED', tx);
      await tx.agentFinding.upsert({
        where: { runId_agentType: { runId: run.id, agentType: role } },
        create: { runId: run.id, agentType: role, payloadJson: finding, model: process.env.MODEL_NAME! },
        update: { payloadJson: finding },
      });
      await tx.activityEvent.create({ data: { claimId: run.claimId, runId: run.id, eventType: 'agent.completed', payloadJson: { role } } });
    });
    return finding;
  } catch (error) {
    await setAgentStatus(run, role, 'FAILED');
    const failureCode = error instanceof Problem ? error.code : error instanceof SyntaxError ? 'invalid_model_json' : 'specialist_failed';
    await db.activityEvent.create({ data: { claimId: run.claimId, runId: run.id, eventType: 'agent.failed', payloadJson: { role, reason: 'Specialist review failed or exceeded its time limit.', failureCode } } });
    throw new Problem(502, 'specialist_failed', `${role} could not complete its review.`);
  }
}
export async function investigate(run: InvestigationRun) {
  const session = await db.intakeSession.findFirst({ where: { claimId: run.claimId, status: 'ACTIVE', expiresAt: { gt: new Date() } } });
  if (!session) throw new Problem(409, 'session_expired', 'No active claim session remains.');
  const results = await Promise.allSettled([
    saveSpecialist(run, session.id, 'POLICY_AGENT'), saveSpecialist(run, session.id, 'INVESTIGATOR'),
  ]);
  const values = results.map((result) => result.status === 'fulfilled' ? result.value : null);
  const report = mergeFindings(values[0], values[1]);
  const ctx = await resolveContext(session.id, 'ORCHESTRATOR', crypto.randomUUID(), crypto.randomUUID(), run.id, { owner: run.leaseOwner, attempt: run.attempt });
  await invokeTool(ctx, 'claims.save_report', report);
}
export async function retryInvestigation(claimId: string) {
  return db.$transaction(async (tx) => {
    const claim = await tx.claim.findFirst({ where: { id: claimId, userId: 'DEMO-001' } });
    if (!claim || claim.status !== 'INVESTIGATION_FAILED') throw new Problem(409, 'retry_ineligible', 'Only failed investigations can be retried.');
    const run = await tx.investigationRun.findUniqueOrThrow({ where: { claimId_claimVersion: { claimId, claimVersion: claim.version } } });
    if (run.attempt >= 3) throw new Problem(409, 'retry_exhausted', 'The investigation retry limit has been reached.');
    await tx.investigationReport.deleteMany({ where: { runId: run.id, partial: true } });
    await tx.investigationRun.update({ where: { id: run.id }, data: {
      status: 'QUEUED', leaseUntil: null, leaseOwner: null, error: null, finishedAt: null,
      policyAgentStatus: 'QUEUED', investigatorStatus: 'QUEUED',
    } });
    await tx.claim.update({ where: { id: claimId }, data: { status: 'SUBMITTED' } });
    return { runId: run.id, status: 'QUEUED' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
