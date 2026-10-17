import { db } from '@crashline/db';
import { investigate } from './investigations';

const owner = crypto.randomUUID();
async function recoverExpiredJobs() {
  const expired = await db.investigationRun.findMany({ where: { status: 'RUNNING', leaseUntil: { lt: new Date() } }, take: 10 });
  for (const run of expired) {
    await db.$transaction(async (tx) => {
      const changed = await tx.investigationRun.updateMany({
        where: { id: run.id, status: 'RUNNING', leaseUntil: { lt: new Date() } },
        data: {
          status: run.attempt >= 2 ? 'FAILED' : 'QUEUED', leaseOwner: null, leaseUntil: null,
          finishedAt: run.attempt >= 2 ? new Date() : null, error: 'Worker lease expired.',
          policyAgentStatus: run.policyAgentStatus === 'COMPLETED' ? 'COMPLETED' : run.attempt >= 2 ? 'FAILED' : 'QUEUED',
          investigatorStatus: run.investigatorStatus === 'COMPLETED' ? 'COMPLETED' : run.attempt >= 2 ? 'FAILED' : 'QUEUED',
        },
      });
      if (changed.count && run.attempt >= 2) {
        await tx.claim.update({ where: { id: run.claimId }, data: { status: 'INVESTIGATION_FAILED' } });
      }
    });
  }
}
export async function claimJob(runId?: string, leaseOwner: string = owner) {
  const candidate = await db.investigationRun.findFirst({ where: { status: 'QUEUED', ...(runId ? { id: runId } : {}) }, orderBy: { createdAt: 'asc' } });
  if (!candidate) return null;
  return db.$transaction(async (tx) => {
    const changed = await tx.investigationRun.updateMany({
      where: { id: candidate.id, status: 'QUEUED' },
      data: { status: 'RUNNING', leaseOwner, leaseUntil: new Date(Date.now() + 120000), startedAt: new Date(), attempt: { increment: 1 } },
    });
    if (!changed.count) return null;
    await tx.claim.update({ where: { id: candidate.claimId }, data: { status: 'INVESTIGATING' } });
    await tx.activityEvent.create({ data: { claimId: candidate.claimId, runId: candidate.id, eventType: 'investigation.started', payloadJson: { attempt: candidate.attempt + 1 } } });
    return tx.investigationRun.findUniqueOrThrow({ where: { id: candidate.id } });
  });
}
export function startWorker() {
  let busy = false;
  let stopped = false;
  async function tick() {
    if (busy || stopped) return;
    busy = true;
    try {
      await recoverExpiredJobs();
      const run = await claimJob();
      if (!run) return;
      const renewal = setInterval(() => {
        void db.investigationRun.updateMany({ where: { id: run.id, status: 'RUNNING', leaseOwner: owner }, data: { leaseUntil: new Date(Date.now() + 120000) } }).catch(() => {});
      }, 30000);
      try { await investigate(run); }
      catch {
        await db.$transaction(async (tx) => {
          const changed = await tx.investigationRun.updateMany({
            where: { id: run.id, status: 'RUNNING', leaseOwner: owner },
            data: { status: 'FAILED', leaseOwner: null, leaseUntil: null, finishedAt: new Date(), error: 'Investigation could not complete. Review configuration and enforcement activity.' },
          });
          if (changed.count) await tx.claim.update({ where: { id: run.claimId }, data: { status: 'INVESTIGATION_FAILED' } });
        });
      } finally { clearInterval(renewal); }
    } catch { console.warn('Investigation worker is waiting for the database.'); }
    finally { busy = false; }
  }
  const timer = setInterval(() => { void tick(); }, 2000);
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
