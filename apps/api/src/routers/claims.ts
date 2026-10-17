import { Router } from 'express';
import { z } from 'zod';
import { db } from '@crashline/db';
import { roles, statuses } from '@crashline/contracts';
import { listClaims, getClaim, getPolicy, securityAttempts, requestRetry } from '../services/queries';
import { createEventTicket } from '../services/events';

export const claimsRouter = Router();
const filters = z.object({
  status: z.enum(statuses).optional(), search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
claimsRouter.get('/claims', async (req, res) => {
  const query = filters.parse(req.query);
  res.json(await listClaims(query.status, query.search, query.page));
});
claimsRouter.get('/claims/:id', async (req, res) => res.json(await getClaim(String(req.params.id))));
claimsRouter.get('/claims/:id/security', async (req, res) => {
  await getClaim(String(req.params.id));
  res.json(await securityAttempts(String(req.params.id)));
});
claimsRouter.post('/claims/:id/investigate', async (req, res) => res.status(202).json(await requestRetry(String(req.params.id))));
claimsRouter.post('/claims/:id/event-ticket', async (req, res) => res.json(await createEventTicket(String(req.params.id))));
claimsRouter.get('/claims/:id/events-snapshot', async (req, res) => {
  await getClaim(String(req.params.id));
  res.json(await db.activityEvent.findMany({ where: { claimId: String(req.params.id) }, orderBy: { createdAt: 'desc' }, take: 100 }));
});
claimsRouter.get('/security', async (req, res) => {
  const query = z.object({ role: z.enum(roles).optional(), decision: z.enum(['ALLOW', 'BLOCK', 'HOLD', 'UNAVAILABLE']).optional(), tool: z.string().max(100).optional(), claimId: z.string().max(100).optional() }).parse(req.query);
  res.json(await securityAttempts(query.claimId, query.role, query.decision, query.tool));
});
claimsRouter.get('/policies/:id', async (req, res) => {
  res.json(await getPolicy(String(req.params.id)));
});
