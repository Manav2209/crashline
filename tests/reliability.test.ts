import { afterAll, describe, expect, test } from 'bun:test';
import { ArmorIQClient, IntentMismatchException, type IntentToken } from '../apps/orchestrator/node_modules/@armoriq/sdk';
import { db } from '../packages/db/src';
import { executeTool } from '../apps/insurance-mcp/src/services/tools';
import { invokeTool } from '../apps/orchestrator/src/services/gateway';
import { resolveContext } from '../apps/orchestrator/src/services/context';
import { setAgentStatus } from '../apps/orchestrator/src/services/leases';
import { mergeFindings } from '../apps/orchestrator/src/services/reports';
import { confirmDraft, renewVoiceCapability, resolveCapability } from '../apps/api/src/services/sessions';
import { cleanFixtures, fixture, operation, signedArgs } from './helpers/fixtures';

const suite = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
// Unit-test transport doubles below are never treated as live ArmorIQ evidence.
const token: IntentToken = { tokenId: 'TEST-ONLY', planHash: 'NOT-LIVE-PROOF', signature: 'TEST', issuedAt: 0, expiresAt: 9999999999, policy: {}, compositeIdentity: 'TEST', stepProofs: [], totalSteps: 1, rawToken: {} };
function fakePort(invoke: Pick<ArmorIQClient, 'invoke'>['invoke']) {
  return { capturePlan: (_llm: string, _prompt: string, plan?: Record<string, unknown>) => ({ plan: plan ?? {}, metadata: {} }), getIntentToken: async () => token, invoke };
}
suite('reliability checks using local synthetic fixtures', () => {
  afterAll(cleanFixtures);
  registerMutationChecks();
  registerLeaseChecks();
  registerGatewayChecks();
  registerSessionChecks();
});
function registerSessionChecks() {
  test('voice reconnection binds a new conversation and invalidates the old capability', async () => {
    const { session } = await fixture();
    await resolveCapability(session.sessionCapability, 'first-test-conversation');
    const capability = await renewVoiceCapability(session.sessionId);
    await expect(resolveCapability(session.sessionCapability, 'first-test-conversation')).rejects.toThrow('expired');
    const bound = await resolveCapability(capability, 'reconnected-test-conversation');
    expect(bound.id).toBe(session.sessionId);
    await expect(resolveCapability(capability, 'another-test-conversation')).rejects.toThrow('match');
  });
  test('expired sessions cannot rotate voice access or confirm a draft', async () => {
    const { session } = await fixture();
    await db.intakeSession.update({ where: { id: session.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(renewVoiceCapability(session.sessionId)).rejects.toThrow('expired');
    await expect(confirmDraft(session.sessionId, 1, 'Confirm synthetic draft.')).rejects.toThrow('expired');
  });
  test('concurrent repeated confirmations create one confirmation event', async () => {
    const { session, claimId } = await fixture();
    const results = await Promise.all([confirmDraft(session.sessionId, 1, 'Confirm synthetic draft.'), confirmDraft(session.sessionId, 1, 'Confirm synthetic draft.')]);
    expect(results).toEqual([{ confirmed: true, version: 1 }, { confirmed: true, version: 1 }]);
    expect(await db.activityEvent.count({ where: { claimId, eventType: 'customer.confirmed' } })).toBe(1);
  });
}
function registerMutationChecks() {
  test('concurrent identical draft requests create one version increment', async () => {
    const { ctx, draft, claimId } = await fixture();
    const args = signedArgs(ctx, 'claims.create_draft', draft);
    const values = await Promise.all([executeTool('claims.create_draft', args), executeTool('claims.create_draft', args)]);
    expect(values[0]).toEqual(values[1]);
    expect((await db.claim.findUniqueOrThrow({ where: { id: claimId } })).version).toBe(2);
  });
  test('reusing a mutation key for different arguments cannot return an old success', async () => {
    const { ctx, draft } = await fixture();
    await executeTool('claims.create_draft', signedArgs(ctx, 'claims.create_draft', draft));
    await expect(executeTool('claims.create_draft', signedArgs(ctx, 'claims.create_draft', { ...draft, location: 'Another synthetic street' }))).rejects.toThrow('different request');
  });
  test('editing a confirmed draft clears confirmation and requires a new review', async () => {
    const { ctx, session, draft } = await fixture();
    await confirmDraft(session.sessionId, 1, 'I confirm this synthetic report.');
    await confirmDraft(session.sessionId, 1, 'I confirm this synthetic report.');
    expect(await db.activityEvent.count({ where: { claimId: ctx.claimId!, eventType: 'customer.confirmed' } })).toBe(1);
    await executeTool('claims.create_draft', signedArgs(ctx, 'claims.create_draft', draft));
    await expect(confirmDraft(session.sessionId, 1, 'I confirm this old version.')).rejects.toThrow('changed');
    const changed = { ...ctx, operationId: operation() };
    await expect(executeTool('claims.submit_fnol', signedArgs(changed, 'claims.submit_fnol', {}))).rejects.toThrow('confirmation');
  });
  test('expired session capabilities cannot retrieve policy information', async () => {
    const { ctx, session } = await fixture();
    await db.intakeSession.update({ where: { id: session.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(resolveCapability(session.sessionCapability)).rejects.toThrow('expired');
    await expect(executeTool('policy.get_details', signedArgs(ctx, 'policy.get_details', {}))).rejects.toThrow('active');
  });
}
function registerLeaseChecks() {
  test('a reassigned worker cannot write findings or dispatch tools', async () => {
    const { ctx, run } = await fixture(true);
    await db.investigationRun.update({ where: { id: run!.id }, data: { leaseOwner: 'replacement-worker', attempt: { increment: 1 } } });
    await expect(setAgentStatus(run!, 'POLICY_AGENT', 'COMPLETED')).rejects.toThrow('reassigned');
    await expect(executeTool('claims.get_details', signedArgs(ctx, 'claims.get_details', {}))).rejects.toThrow('reassigned');
    await expect(resolveContext(ctx.sessionId, 'ORCHESTRATOR', crypto.randomUUID(), operation(), run!.id, { owner: run!.leaseOwner, attempt: run!.attempt })).rejects.toThrow('owns');
  });
  test('an expired lease cannot save a report', async () => {
    const { ctx, run } = await fixture(true);
    await db.investigationRun.update({ where: { id: run!.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    const report = mergeFindings(null, null);
    await expect(executeTool('claims.save_report', signedArgs(ctx, 'claims.save_report', report))).rejects.toThrow('expired');
    expect(await db.investigationReport.count({ where: { runId: run!.id } })).toBe(0);
  });
  test('a saved partial report can be replayed idempotently after the run finishes', async () => {
    const { ctx, run } = await fixture(true);
    const report = mergeFindings(null, null);
    const args = signedArgs(ctx, 'claims.save_report', report);
    expect(await executeTool('claims.save_report', args)).toEqual(await executeTool('claims.save_report', args));
    expect((await db.investigationRun.findUniqueOrThrow({ where: { id: run!.id } })).status).toBe('PARTIAL');
  });
}
function registerGatewayChecks() {
  test('domain rejection stays separate from unavailable enforcement', async () => {
    const { ctx } = await fixture();
    const port = fakePort(async (mcp, tool, _token, args) => {
      try { await executeTool('claims.submit_fnol', args!); throw new Error('Expected missing confirmation.'); }
      catch (error) { return { mcp, action: tool, verified: true, status: 'error', result: { isError: true, content: [{ type: 'text', text: (error as Error).message }] }, metadata: {} }; }
    });
    await expect(invokeTool(ctx, 'claims.submit_fnol', {}, port)).rejects.toThrow('confirmation');
    const attempt = await db.toolAttempt.findFirstOrThrow({ where: { operationId: ctx.operationId } });
    expect(attempt.decision).toBe('ALLOW'); expect(attempt.resultStatus).toBe('ERROR'); expect(attempt.mcpInvoked).toBe(true); expect(attempt.executed).toBe(false);
  });
  test('an unverified SDK response cannot be recorded as allowed', async () => {
    const { ctx } = await fixture();
    const port = fakePort(async (mcp, action) => ({ mcp, action, verified: false, status: 'success', result: {}, metadata: {} }));
    await expect(invokeTool(ctx, 'policy.get_details', {}, port)).rejects.toThrow('enforcement_unavailable');
    const attempt = await db.toolAttempt.findFirstOrThrow({ where: { operationId: ctx.operationId } });
    expect(attempt.decision).toBe('UNAVAILABLE'); expect(attempt.mcpInvoked).toBe(false);
  });
  test('SDK plan rejection is recorded distinctly and invokes no MCP handler', async () => {
    const { ctx } = await fixture();
    const port = fakePort(async () => { throw new IntentMismatchException('TEST-ONLY action outside plan.'); });
    await expect(invokeTool(ctx, 'claims.approve_settlement', { amount: 12000 }, port)).rejects.toThrow('plan enforcement');
    const attempt = await db.toolAttempt.findFirstOrThrow({ where: { operationId: ctx.operationId } });
    expect(attempt.enforcementSource).toBe('ARMORIQ_SDK_PLAN'); expect(attempt.mcpInvoked).toBe(false); expect(attempt.executed).toBe(false);
  });
}
