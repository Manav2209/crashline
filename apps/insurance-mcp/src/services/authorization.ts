import { executionContextSchema, toolScopes, type ToolName } from '@crashline/contracts';
import { db } from '@crashline/db';
import { executionFingerprint, hash, Problem, verifyContext } from '@crashline/server';
import { z } from 'zod';

export const signedToolContextSchema = z.object({
  context: executionContextSchema, tool: z.string(), argsHash: z.string(),
});
export async function authorizeTool(tool: ToolName, args: unknown, token: string) {
  const signed = verifyContext(token, signedToolContextSchema);
  const ctx = signed.context;
  if (signed.tool !== tool || signed.argsHash !== hash(JSON.stringify(args))) {
    throw new Problem(403, 'argument_mismatch', 'Arguments differ from the authorized request.');
  }
  if (!toolScopes[ctx.role].includes(tool)) throw new Problem(403, 'role_scope', 'This role cannot perform this action.');
  const session = await db.intakeSession.findUnique({ where: { id: ctx.sessionId }, include: { user: true } });
  if (!session || session.status !== 'ACTIVE' || session.expiresAt.getTime() < Date.now()) {
    throw new Problem(403, 'session_expired', 'Intake session is no longer active.');
  }
  if (session.userId !== ctx.userId || session.policyId !== ctx.policyId || session.user.email !== ctx.userEmail) {
    throw new Problem(403, 'ownership', 'The session does not own this policy.');
  }
  if (ctx.claimId && session.claimId !== ctx.claimId) throw new Problem(403, 'ownership', 'Claim does not belong to this session.');
  const receipt = await db.toolExecution.findUnique({ where: { operationId: ctx.operationId } });
  if (receipt) {
    if (receipt.requestHash !== executionFingerprint(ctx, tool, args)) throw new Problem(409, 'idempotency_conflict', 'The operation key was used for a different request.');
    return ctx;
  }
  if (ctx.runId) {
    const run = await db.investigationRun.findUnique({ where: { id: ctx.runId }, include: { claim: true } });
    if (!run || run.claimId !== ctx.claimId || run.status !== 'RUNNING' || run.claim.userId !== ctx.userId || run.claim.status !== 'INVESTIGATING') {
      throw new Problem(403, 'run_scope', 'An active investigation for this claim is required.');
    }
    if (!run.leaseUntil || run.leaseUntil.getTime() < Date.now()) throw new Problem(409, 'lease_expired', 'Investigation lease expired.');
    if (run.leaseOwner !== ctx.leaseOwner || run.attempt !== ctx.leaseAttempt) throw new Problem(409, 'lease_changed', 'The investigation was reassigned to another worker.');
  } else if (ctx.role !== 'INTAKE') {
    throw new Problem(403, 'run_scope', 'Specialist tools require an investigation run.');
  }
  return ctx;
}
