import { Router } from 'express';
import { z } from 'zod';
import { draftSchema } from '@crashline/contracts';
import { db } from '@crashline/db';
import { createSession, getOwnedSession, getVoiceUrl, confirmDraft } from '../services/sessions';
import { forwardTool } from '../services/orchestrator';

export const sessionsRouter = Router();
sessionsRouter.post('/', async (_req, res) => res.status(201).json(await createSession()));
sessionsRouter.get('/:id', async (req, res) => {
  const session = await getOwnedSession(String(req.params.id));
  const claim = session.claimId ? await db.claim.findUnique({ where: { id: session.claimId } }) : null;
  res.json({ sessionId: session.id, claimId: session.claimId, expiresAt: session.expiresAt, claim });
});
sessionsRouter.post('/:id/voice-url', async (req, res) => res.json(await getVoiceUrl(String(req.params.id))));
sessionsRouter.post('/:id/draft', async (req, res) => {
  const session = await getOwnedSession(String(req.params.id));
  const input = draftSchema.parse(req.body);
  const operationId = z.string().uuid().parse(req.get('idempotency-key'));
  res.json(await forwardTool(session.id, 'claims.create_draft', input, res.locals.correlationId, operationId));
});
sessionsRouter.post('/:id/confirm', async (req, res) => {
  const input = z.object({ version: z.number().int().positive(), confirmed: z.literal(true), confirmationText: z.string().min(5).max(1000) }).strict().parse(req.body);
  res.json(await confirmDraft(String(req.params.id), input.version, input.confirmationText));
});
sessionsRouter.post('/:id/submit', async (req, res) => {
  const session = await getOwnedSession(String(req.params.id));
  const operationId = z.string().uuid().parse(req.get('idempotency-key'));
  res.status(202).json(await forwardTool(session.id, 'claims.submit_fnol', {}, res.locals.correlationId, operationId));
});
