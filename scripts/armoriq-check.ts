import { db } from '../packages/db/src';
import { createSession } from '../apps/api/src/services/sessions';
import { resolveContext } from '../apps/orchestrator/src/services/context';
import { createArmorClient, createAuthority } from '../apps/orchestrator/src/services/authority';
import { armorAction, toolScopes } from '../packages/contracts/src';

async function checkPolicy() {
  const session = await createSession();
  try {
    const ctx = await resolveContext(session.sessionId, 'INTAKE', crypto.randomUUID(), crypto.randomUUID());
    const client = createArmorClient(ctx.userEmail);
    const { token } = await createAuthority(client, ctx, 'policy.get_details', {});
    const validation = token.policyValidation;
    const allowed: unknown[] = Array.isArray(validation?.allowed_tools) ? validation.allowed_tools : [];
    const missing = toolScopes.INTAKE.filter((tool) => !allowed.includes(armorAction(tool)));
    const denied: unknown[] = Array.isArray(validation?.denied_tools) ? validation.denied_tools : [];
    console.info(JSON.stringify({ allowedTools: allowed, missingIntakeTools: missing, deniedTools: denied, remoteToolExecutionTested: false }));
    if (missing.length || denied.length) {
      throw new Error('The signed ArmorIQ policy does not permit the exact intake transport aliases. Refresh the restricted MCP registration; keep settlement and coverage mutation denied.');
    }
    console.info('Policy names match. Run security:live to verify actual proxy execution and blocks.');
  } finally {
    await db.intakeSession.delete({ where: { id: session.sessionId } });
  }
}
try { await checkPolicy(); }
catch (error) { console.error(error instanceof Error ? error.message : 'ArmorIQ policy check failed.'); process.exitCode = 1; }
finally { await db.$disconnect(); }
