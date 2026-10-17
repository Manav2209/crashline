import { Router, raw } from 'express';
import { z } from 'zod';
import { draftSchema } from '@crashline/contracts';
import { db } from '@crashline/db';
import { bearerAuth, Problem } from '@crashline/server';
import { resolveCapability, confirmDraft } from '../services/sessions';
import { forwardTool } from '../services/orchestrator';
import { verifyPostCall, archivePostCall } from '../services/provider';

export const voiceRouter = Router();
voiceRouter.use(bearerAuth('ELEVENLABS_WEBHOOK_TOOL_SECRET'));
const envelope = z.object({ sessionId: z.string().uuid(), conversationId: z.string().min(1).max(200), operationId: z.string().uuid() });
const routes = {
  'fetch-policy': { tool: 'policy.get_details', schema: z.object({}).strict() },
  'create-claim-draft': { tool: 'claims.create_draft', schema: draftSchema },
  'approve-settlement': { tool: 'claims.approve_settlement', schema: z.object({ amount: z.number().positive() }).strict() },
} as const;
for (const [path, config] of Object.entries(routes)) {
  voiceRouter.post(`/${path}`, async (req, res) => {
    const input = envelope.extend({ args: config.schema }).strict().parse(req.body);
    const session = await resolveCapability(req.get('X-Session-Capability') ?? '', input.conversationId);
    if (session.id !== input.sessionId) throw new Problem(403, 'session_mismatch', 'Session does not match the capability.');
    res.json({ ...await forwardTool(session.id, config.tool, input.args, res.locals.correlationId, input.operationId), ok: true });
  });
}
voiceRouter.post('/submit-report', async (req, res) => {
  const input = envelope.extend({ confirmed: z.literal(true), version: z.number().int().positive(), confirmationText: z.string().min(5).max(1000) }).strict().parse(req.body);
  const session = await resolveCapability(req.get('X-Session-Capability') ?? '', input.conversationId);
  if (session.id !== input.sessionId) throw new Problem(403, 'session_mismatch', 'Session does not match the capability.');
  await confirmDraft(session.id, input.version, input.confirmationText);
  res.json({ ...await forwardTool(session.id, 'claims.submit_fnol', {}, res.locals.correlationId, input.operationId), ok: true });
});
export const postCallRouter = Router();
postCallRouter.post('/post-call', raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) throw new Problem(400, 'raw_body_required', 'Expected a raw JSON body.');
  verifyPostCall(req.body, req.get('elevenlabs-signature') ?? '');
  res.json(await archivePostCall(req.body));
});
