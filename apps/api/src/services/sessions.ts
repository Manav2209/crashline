import { randomBytes } from 'node:crypto';
import { db, Prisma } from '@crashline/db';
import { hash, Problem, required } from '@crashline/server';
import { voiceReady } from './configuration';

export async function createSession() {
  const policy = await db.policy.findFirstOrThrow({ where: { holderId: 'DEMO-001', id: 'POL-1001' } });
  const capability = randomBytes(32).toString('base64url');
  const session = await db.intakeSession.create({ data: {
    userId: policy.holderId, policyId: policy.id, sessionTokenHash: hash(capability),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  } });
  return { sessionId: session.id, sessionCapability: capability, policyId: policy.id, expiresAt: session.expiresAt };
}
export async function getOwnedSession(id: string) {
  const session = await db.intakeSession.findFirst({ where: { id, userId: 'DEMO-001', status: 'ACTIVE', expiresAt: { gt: new Date() } } });
  if (!session) throw new Problem(404, 'session_not_found', 'The intake session is missing or expired.');
  return session;
}
export async function getVoiceUrl(sessionId: string) {
  await getOwnedSession(sessionId);
  if (!await voiceReady()) throw new Problem(503, 'voice_setup_required', 'Voice intake needs the hosted agent tools and signed-session setup before it can start.');
  const agentId = required('ELEVENLABS_AGENT_ID');
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, {
    headers: { 'xi-api-key': required('ELEVENLABS_API_KEY') }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Problem(502, 'voice_unavailable', 'ElevenLabs could not start a voice session.');
  const result = await response.json() as { signed_url: string };
  return { signedUrl: result.signed_url, sessionCapability: await renewVoiceCapability(sessionId) };
}
export async function renewVoiceCapability(sessionId: string) {
  const capability = randomBytes(32).toString('base64url');
  const updated = await db.intakeSession.updateMany({
    where: { id: sessionId, userId: 'DEMO-001', status: 'ACTIVE', expiresAt: { gt: new Date() } },
    data: { sessionTokenHash: hash(capability), providerConversationId: null },
  });
  if (!updated.count) throw new Problem(404, 'session_not_found', 'The intake session is missing or expired.');
  return capability;
}
export async function confirmDraft(sessionId: string, version: number, confirmationText: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
   try { return await db.$transaction(async (tx) => {
    const session = await tx.intakeSession.findFirst({ where: { id: sessionId, userId: 'DEMO-001', status: 'ACTIVE', expiresAt: { gt: new Date() } } });
    if (!session) throw new Problem(404, 'session_not_found', 'The intake session is missing or expired.');
    if (!session.claimId) throw new Problem(409, 'draft_required', 'Save the draft first.');
    const claim = await tx.claim.findUniqueOrThrow({ where: { id: session.claimId } });
    if (claim.status !== 'DRAFT') return { confirmed: true, version: claim.version };
    if (claim.version !== version) throw new Problem(409, 'version_conflict', 'The draft changed. Review it before confirming.');
    if (session.confirmedAt && session.confirmationClaimVersion === version) return { confirmed: true, version };
    await tx.intakeSession.update({ where: { id: sessionId }, data: {
      confirmedAt: new Date(), confirmationClaimVersion: version, confirmationText,
    } });
    await tx.activityEvent.create({ data: { claimId: claim.id, eventType: 'customer.confirmed', payloadJson: { version } } });
    return { confirmed: true, version };
   }, { isolationLevel: 'Serializable' }); }
   catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === 2) throw error;
   }
  }
  throw new Problem(409, 'concurrency_conflict', 'The draft changed; review it before confirming.');
}
export async function resolveCapability(capability: string, conversationId?: string) {
  const session = await db.intakeSession.findUnique({ where: { sessionTokenHash: hash(capability) } });
  if (!session || session.status !== 'ACTIVE' || session.expiresAt.getTime() < Date.now()) throw new Problem(401, 'invalid_capability', 'Invalid or expired session capability.');
  if (conversationId && session.providerConversationId && session.providerConversationId !== conversationId) {
    throw new Problem(403, 'conversation_mismatch', 'Conversation does not match this session.');
  }
  if (conversationId && !session.providerConversationId) {
    const result = await db.intakeSession.updateMany({ where: { id: session.id, providerConversationId: null }, data: { providerConversationId: conversationId } });
    if (!result.count) return resolveCapability(capability, conversationId);
  }
  return session;
}
