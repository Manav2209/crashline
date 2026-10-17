import { db } from '@crashline/db';
import { type ExecutionContext, type Role } from '@crashline/contracts';
import { Problem } from '@crashline/server';

export async function resolveContext(sessionId: string, role: Role, correlationId: string, operationId: string, runId: string | null = null, expectedLease?: { owner: string | null; attempt: number }): Promise<ExecutionContext> {
  const session = await db.intakeSession.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!session || session.status !== 'ACTIVE' || session.expiresAt.getTime() < Date.now()) {
    throw new Problem(403, 'invalid_session', 'A valid active session is required.');
  }
  let leaseOwner: string | null = null;
  let leaseAttempt: number | null = null;
  if (runId) {
    const run = await db.investigationRun.findUnique({ where: { id: runId } });
    if (!run || run.claimId !== session.claimId || run.status !== 'RUNNING') throw new Problem(403, 'invalid_run', 'An active scoped run is required.');
    if (!run.leaseOwner || !run.leaseUntil || run.leaseUntil.getTime() <= Date.now()) throw new Problem(409, 'lease_expired', 'The investigation lease is not active.');
    if (expectedLease && (expectedLease.owner !== run.leaseOwner || expectedLease.attempt !== run.attempt)) throw new Problem(409, 'lease_changed', 'Another worker now owns this investigation.');
    leaseOwner = run.leaseOwner;
    leaseAttempt = run.attempt;
  }
  return {
    userId: session.userId, policyId: session.policyId, claimId: session.claimId,
    sessionId, role, userEmail: session.user.email, correlationId, operationId, runId, leaseOwner, leaseAttempt,
  };
}
