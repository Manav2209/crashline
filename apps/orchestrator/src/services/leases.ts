import { db, type InvestigationRun, type Prisma } from '@crashline/db';
import { Problem } from '@crashline/server';

export function leaseWhere(run: InvestigationRun) {
  return { id: run.id, status: 'RUNNING' as const, leaseOwner: run.leaseOwner, attempt: run.attempt, leaseUntil: { gt: new Date() } };
}
export async function setAgentStatus(run: InvestigationRun, role: string, status: string, tx: Prisma.TransactionClient = db) {
  const field = role === 'POLICY_AGENT' ? 'policyAgentStatus' : 'investigatorStatus';
  const changed = await tx.investigationRun.updateMany({ where: leaseWhere(run), data: { [field]: status } });
  if (!changed.count) throw new Problem(409, 'lease_changed', 'The investigation lease expired or was reassigned.');
}
