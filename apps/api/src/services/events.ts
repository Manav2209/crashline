import { db } from '@crashline/db';
import { hash, Problem } from '@crashline/server';
import type { Request, Response } from 'express';
import { getClaim } from './queries';

const tickets = new Map<string, { claimId: string; expiresAt: number }>();
export async function createEventTicket(claimId: string) {
  await getClaim(claimId);
  for (const [key, entry] of tickets) if (entry.expiresAt < Date.now()) tickets.delete(key);
  const ticket = crypto.randomUUID();
  tickets.set(hash(ticket), { claimId, expiresAt: Date.now() + 60000 });
  return { ticket };
}
export async function streamEvents(req: Request, res: Response) {
  const claimId = String(req.params.id);
  const key = hash(String(req.query.ticket ?? ''));
  const ticket = tickets.get(key);
  if (!ticket || ticket.claimId !== claimId || ticket.expiresAt < Date.now()) throw new Problem(401, 'invalid_ticket', 'Request a new event stream ticket.');
  tickets.delete(key);
  await getClaim(claimId);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  let cursor: { createdAt: Date; id: string } | undefined;
  let busy = false;
  let closed = false;
  async function send() {
    if (busy || closed) return;
    busy = true;
    try {
      const events = await db.activityEvent.findMany({
        where: { claimId, ...(cursor ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] } : {}) },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 100,
      });
      for (const event of events) {
        if (closed) break;
        res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
        cursor = { createdAt: event.createdAt, id: event.id };
      }
      if (!closed) res.write(': heartbeat\n\n');
    } catch { if (!closed) res.write('event: stream-error\ndata: {}\n\n'); }
    finally { busy = false; }
  }
  const timer = setInterval(() => { void send(); }, 1500);
  const expiry = setTimeout(() => res.end(), 15 * 60 * 1000);
  res.on('close', () => { closed = true; clearInterval(timer); clearTimeout(expiry); });
  await send();
}
