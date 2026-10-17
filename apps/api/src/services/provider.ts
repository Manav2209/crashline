import { createHmac } from 'node:crypto';
import { db } from '@crashline/db';
import { required, secureEqual, Problem } from '@crashline/server';
import { z } from 'zod';

export function verifyPostCall(raw: Buffer, signatureHeader: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim().split('='));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v0').map(([, value]) => value ?? '');
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Problem(401, 'webhook_expired', 'Invalid webhook timestamp.');
  }
  const expected = createHmac('sha256', required('ELEVENLABS_POSTCALL_WEBHOOK_SECRET')).update(`${timestamp}.`).update(raw).digest('hex');
  if (!signatures.some((signature) => secureEqual(signature, expected))) throw new Problem(401, 'webhook_signature', 'Invalid webhook signature.');
}
export async function archivePostCall(raw: Buffer) {
  const input = z.object({
    type: z.string(), data: z.object({ conversation_id: z.string(), analysis: z.object({ transcript_summary: z.string().max(20000).optional() }).passthrough().optional() }).passthrough(),
  }).parse(JSON.parse(raw.toString('utf8')));
  if (input.type !== 'post_call_transcription') return { received: true, archived: false };
  const session = await db.intakeSession.findUnique({ where: { providerConversationId: input.data.conversation_id } });
  if (!session) return { received: true, archived: false };
  await db.intakeSession.update({ where: { id: session.id }, data: { transcriptSummary: (input.data.analysis?.transcript_summary ?? '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]') } });
  return { received: true, archived: true };
}
