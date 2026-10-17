import { toolSchemas, type ExecutionContext, type ToolName } from '@crashline/contracts';
import { db, Prisma } from '@crashline/db';
import { executionFingerprint, Problem } from '@crashline/server';
import { authorizeTool, signedToolContextSchema } from './authorization';
import { createDraft, saveReport, submitClaim } from './claims';
import { verifyContext } from '@crashline/server';

export async function dispatchDomain(tx: Prisma.TransactionClient, ctx: ExecutionContext, tool: ToolName, args: unknown) {
  switch (tool) {
    case 'policy.get_details':
      return tx.policy.findFirstOrThrow({ where: { id: ctx.policyId, holderId: ctx.userId } });
    case 'policy.get_coverage_rules':
      return tx.policy.findFirstOrThrow({ where: { id: ctx.policyId, holderId: ctx.userId }, select: { id: true, coveragesJson: true, exclusionsJson: true, deductible: true, limitsJson: true } });
    case 'claims.get_details':
      if (!ctx.claimId) throw new Problem(409, 'claim_required', 'No claim exists yet.');
      return tx.claim.findFirstOrThrow({ where: { id: ctx.claimId, userId: ctx.userId, policyId: ctx.policyId } });
    case 'claims.get_intake_requirements':
      return { required: ['incidentAt with timezone', 'location', 'description'], followUp: ['injury status', 'other vehicles', 'police report or explicitly unknown'], limitations: 'Never determine fault or infer fraud.' };
    case 'claims.create_draft': return createDraft(tx, ctx, args);
    case 'claims.submit_fnol': return submitClaim(tx, ctx);
    case 'claims.save_report': return saveReport(tx, ctx, args);
    default: throw new Problem(403, 'forbidden', 'This sandbox has no settlement or coverage mutation implementation.');
  }
}
export async function executeTool(tool: ToolName, rawArgs: Record<string, unknown>) {
  const token = typeof rawArgs._authorization === 'string' ? rawArgs._authorization : '';
  const { _authorization, ...proposed } = rawArgs;
  const args = toolSchemas[tool].parse(proposed);
  const signed = verifyContext(token, signedToolContextSchema);
  await db.mcpInvocation.create({ data: { tool, operationId: signed.context.operationId, correlationId: signed.context.correlationId } });
  const ctx = await authorizeTool(tool, args, token);
  const requestHash = executionFingerprint(ctx, tool, args);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const receipt = await tx.toolExecution.findUnique({ where: { operationId: ctx.operationId } });
        if (receipt) {
          if (receipt.requestHash !== requestHash) throw new Problem(409, 'idempotency_conflict', 'The operation key was used for a different request.');
          return receipt.resultJson;
        }
        const result = JSON.parse(JSON.stringify(await dispatchDomain(tx, ctx, tool, args))) as Prisma.InputJsonValue;
        await tx.toolExecution.create({ data: { operationId: ctx.operationId, tool, requestHash, resultJson: result } });
        return result;
      }, { isolationLevel: 'Serializable', timeout: 15000 });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code);
      if (!retryable || attempt === 2) throw error;
    }
  }
  throw new Problem(409, 'concurrency_conflict', 'Please retry the request with the same operation key.');
}
