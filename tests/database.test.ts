import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db } from '../packages/db/src';
import { draftSchema, type ExecutionContext, type ToolName } from '../packages/contracts/src';
import { hash, signContext } from '../packages/server/src';
import { createSession, confirmDraft } from '../apps/api/src/services/sessions';
import { executeTool } from '../apps/insurance-mcp/src/services/tools';
import { invokeTool } from '../apps/orchestrator/src/services/gateway';
import { resolveContext } from '../apps/orchestrator/src/services/context';
import { createInsuranceServer } from '../apps/insurance-mcp/src/server';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const enabled = process.env.RUN_DB_TESTS === 'true';
const suite = enabled ? describe : describe.skip;
let sessionId: string;
let ctx: ExecutionContext;
const operations: string[] = [];
function argsFor(tool: ToolName, args: Record<string, unknown>, context = ctx) {
  const operationId = crypto.randomUUID(); operations.push(operationId);
  const contextWithOperation = { ...context, operationId };
  return { ...args, _authorization: signContext({ context: contextWithOperation, tool, argsHash: hash(JSON.stringify(args)) }) };
}
suite('local database + real MCP protocol (not ArmorIQ live evidence)', () => {
  beforeAll(async () => {
    const session = await createSession(); sessionId = session.sessionId;
    ctx = await resolveContext(sessionId, 'INTAKE', crypto.randomUUID(), crypto.randomUUID());
  });
  afterAll(async () => {
    const session = await db.intakeSession.findUnique({ where: { id: sessionId } });
    await db.toolAttempt.deleteMany({ where: { sessionId } });
    if (session?.claimId) {
      await db.activityEvent.deleteMany({ where: { claimId: session.claimId } });
      await db.investigationRun.deleteMany({ where: { claimId: session.claimId } });
    }
    await db.intakeSession.deleteMany({ where: { id: sessionId } });
    if (session?.claimId) await db.claim.delete({ where: { id: session.claimId } });
    await db.mcpInvocation.deleteMany({ where: { operationId: { in: operations } } });
    await db.toolExecution.deleteMany({ where: { operationId: { in: operations } } });
  });
  test('genuine MCP tools/list discovers the insurance tool inventory', async () => {
    const server = createInsuranceServer();
    const client = new Client({ name: 'crashline-test', version: '0.1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport); await client.connect(clientTransport);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('claims.create_draft');
    const result = await client.callTool({ name: 'policy.get_details', arguments: argsFor('policy.get_details', {}) });
    expect(result.isError).not.toBe(true);
    await client.close(); await server.close();
  });
  test('same mutation key returns one claim and no extra version increment', async () => {
    const fields = draftSchema.parse({ incidentAt: '2026-10-15T09:30:00+05:30', location: 'Integration Test Signal', description: 'Synthetic test: stationary at a red light.' });
    const args = argsFor('claims.create_draft', fields);
    const first = await executeTool('claims.create_draft', args) as { claimId: string; version: number };
    const second = await executeTool('claims.create_draft', args) as { claimId: string; version: number };
    expect(first).toEqual(second); expect(first.version).toBe(1);
    expect(await db.claim.count({ where: { id: first.claimId } })).toBe(1);
  });
  test('ArmorIQ transport aliases retain canonical authorization and deny forbidden operations', async () => {
    const server = createInsuranceServer();
    const client = new Client({ name: 'crashline-alias-test', version: '0.1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport); await client.connect(clientTransport);
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toContain('policy__get_details');
      const args = argsFor('policy.get_details', {});
      const result = await client.callTool({ name: 'policy__get_details', arguments: args });
      expect(result.isError).not.toBe(true);
      const invocation = await db.mcpInvocation.findFirstOrThrow({ where: { operationId: operations.at(-1)! } });
      expect(invocation.tool).toBe('policy.get_details');
      const rejected = await client.callTool({ name: 'claims__approve_settlement', arguments: argsFor('claims.approve_settlement', { amount: 12000 }) });
      expect(rejected.isError).toBe(true);
    } finally { await client.close(); await server.close(); }
  });
  test('submission requires server-recorded confirmation of current version', async () => {
    const current = await db.intakeSession.findUniqueOrThrow({ where: { id: sessionId }, include: { claim: true } });
    await expect(executeTool('claims.submit_fnol', argsFor('claims.submit_fnol', {}))).rejects.toThrow('confirmation');
    await confirmDraft(sessionId, current.claim!.version, 'I confirm submission of this synthetic test report.');
    const args = argsFor('claims.submit_fnol', {});
    await executeTool('claims.submit_fnol', args); await executeTool('claims.submit_fnol', args);
    expect(await db.investigationRun.count({ where: { claimId: current.claimId! } })).toBe(1);
  });
  test('forged owner context and forbidden role are rejected by domain defense', async () => {
    await expect(executeTool('policy.get_details', argsFor('policy.get_details', {}, { ...ctx, userId: 'ATTACKER' }))).rejects.toThrow('own');
    await expect(executeTool('claims.approve_settlement', argsFor('claims.approve_settlement', { amount: 12000 }))).rejects.toThrow('role');
  });
  test('gateway fails closed when ArmorIQ is unavailable; no MCP handler is invoked', async () => {
    const operationId = crypto.randomUUID(); operations.push(operationId);
    const before = await db.mcpInvocation.count({ where: { operationId } });
    const port = { capturePlan: () => { throw new Error('test-only provider outage'); }, getIntentToken: async () => { throw new Error('unreachable'); }, invoke: async () => { throw new Error('unreachable'); } };
    await expect(invokeTool({ ...ctx, operationId }, 'policy.get_details', {}, port)).rejects.toThrow('enforcement_unavailable');
    expect(await db.mcpInvocation.count({ where: { operationId } })).toBe(before);
    const attempt = await db.toolAttempt.findFirstOrThrow({ where: { operationId } });
    expect(attempt.decision).toBe('UNAVAILABLE'); expect(attempt.executed).toBe(false); expect(attempt.planHash).toBeNull();
  });
});
