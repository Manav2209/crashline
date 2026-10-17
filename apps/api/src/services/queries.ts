import { db, Prisma } from '@crashline/db';
import { Problem, required } from '@crashline/server';

export async function listClaims(status: string | undefined, search: string | undefined, page: number) {
  const where: Prisma.ClaimWhereInput = {
    userId: 'DEMO-001', ...(status ? { status: status as Prisma.EnumClaimStatusFilter } : {}),
    ...(search ? { OR: [{ id: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [claims, total, counts] = await Promise.all([
    db.claim.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 }),
    db.claim.count({ where }),
    db.claim.groupBy({ by: ['status'], where: { userId: 'DEMO-001' }, _count: true }),
  ]);
  return { claims, total, page, counts: Object.fromEntries(counts.map((entry) => [entry.status, entry._count])) };
}
export async function getClaim(id: string) {
  const claim = await db.claim.findFirst({ where: { id, userId: 'DEMO-001' }, include: {
    reports: { orderBy: { createdAt: 'desc' } },
    runs: { orderBy: { createdAt: 'desc' }, include: { findings: true } },
  } });
  if (!claim) throw new Problem(404, 'claim_not_found', 'Claim not found.');
  return claim;
}
export async function getPolicy(id: string) {
  const policy = await db.policy.findFirst({ where: { id, holderId: 'DEMO-001' } });
  if (!policy) throw new Problem(404, 'policy_not_found', 'Policy not found for this account.');
  return policy;
}
export async function securityAttempts(claimId?: string, role?: string, decision?: string, tool?: string) {
  return db.toolAttempt.findMany({
    where: {
      session: { userId: 'DEMO-001' }, ...(claimId ? { claimId } : {}),
      ...(role ? { agentType: role } : {}), ...(decision ? { decision } : {}), ...(tool ? { mcpTool: tool } : {}),
    }, orderBy: { createdAt: 'desc' }, take: 200,
    select: { id: true, claimId: true, agentType: true, mcpTool: true, decision: true, reason: true, executed: true, armorTraceId: true, armorPlanId: true, planHash: true, enforcementSource: true, resultStatus: true, mcpInvoked: true, createdAt: true, correlationId: true },
  });
}
export async function requestRetry(claimId: string) {
  await getClaim(claimId);
  const response = await fetch(`${required('ORCHESTRATOR_URL')}/internal/investigations/start`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${required('INTERNAL_SERVICE_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ claimId }),
  });
  const result = await response.json() as { code?: string; message?: string };
  if (!response.ok) throw new Problem(response.status, result.code ?? 'retry_failed', result.message ?? 'Retry could not start.');
  return result;
}
