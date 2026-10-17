import { db } from '../packages/db/src';
import { createSession } from '../apps/api/src/services/sessions';
import { resolveContext } from '../apps/orchestrator/src/services/context';
import { invokeTool } from '../apps/orchestrator/src/services/gateway';
import { createArmorClient, type ArmorPort } from '../apps/orchestrator/src/services/authority';
import { armorAction } from '../packages/contracts/src';

async function proveRemotePolicyBlock() {
  const session = await createSession();
  const ctx = await resolveContext(session.sessionId, 'INTAKE', crypto.randomUUID(), crypto.randomUUID());
  const client = createArmorClient(ctx.userEmail);
  const tool = 'claims.approve_settlement';
  const args = { amount: 12000 };
  // Diagnostic only: declare the forbidden action so SDK plan exclusion cannot count as this proof.
  const port: ArmorPort = {
    capturePlan: (llm, prompt, plan, metadata) => client.capturePlan(llm, prompt, {
      ...plan, steps: [...(Array.isArray(plan?.steps) ? plan.steps : []), {
        mcp: process.env.ARMORIQ_MCP_NAME ?? 'insurance-mcp', action: armorAction(tool), params: args,
      }],
    }, metadata),
    getIntentToken: client.getIntentToken.bind(client), invoke: client.invoke.bind(client),
  };
  const before = await db.mcpInvocation.count({ where: { operationId: ctx.operationId } });
  try { await invokeTool(ctx, tool, args, port); }
  catch { /* Inspect the persisted real enforcement decision below. */ }
  const attempt = await db.toolAttempt.findFirstOrThrow({ where: { operationId: ctx.operationId } });
  const after = await db.mcpInvocation.count({ where: { operationId: ctx.operationId } });
  if (attempt.decision !== 'BLOCK' || attempt.enforcementSource !== 'ARMORIQ_POLICY' || attempt.executed || after !== before) {
    throw new Error(`Remote policy block not proven: ${attempt.decision}/${attempt.enforcementSource}; handler invocations=${after - before}.`);
  }
  const evidence = {
    createdAt: new Date().toISOString(), source: 'live ArmorIQ remote policy enforcement',
    operationId: ctx.operationId, tool, transportAction: armorAction(tool), declaredInPlan: true,
    decision: attempt.decision, enforcementSource: attempt.enforcementSource, reason: attempt.reason,
    planHash: attempt.planHash, planId: attempt.armorPlanId, executed: attempt.executed,
    handlerInvocations: after - before, settlementImplementation: 'none; synthetic diagnostic only',
  };
  await Bun.write(new URL('../docs/live-policy-block-evidence.json', import.meta.url), JSON.stringify(evidence, null, 2));
  console.info(JSON.stringify(evidence, null, 2));
}
try { await proveRemotePolicyBlock(); }
catch (error) { console.error(error instanceof Error ? error.message : 'Remote policy probe failed.'); process.exitCode = 1; }
finally { await db.$disconnect(); }
