import { type ExecutionContext, draftSchema, reportSchema } from '@crashline/contracts';
import { Prisma } from '@crashline/db';
import { Problem } from '@crashline/server';

type Tx = Prisma.TransactionClient;
export async function createDraft(tx: Tx, ctx: ExecutionContext, input: unknown) {
  const data = draftSchema.parse(input);
  const session = await tx.intakeSession.findUniqueOrThrow({ where: { id: ctx.sessionId } });
  const fields = { ...data, incidentAt: data.incidentAt ? new Date(data.incidentAt) : null };
  if (session.claimId) {
    const current = await tx.claim.findUniqueOrThrow({ where: { id: session.claimId } });
    if (current.status !== 'DRAFT') throw new Problem(409, 'stage_conflict', 'Submitted claims cannot be edited.');
    const updated = await tx.claim.updateMany({
      where: { id: current.id, version: current.version, status: 'DRAFT' },
      data: { ...fields, version: { increment: 1 } },
    });
    if (!updated.count) throw new Problem(409, 'version_conflict', 'Claim changed; review it again.');
  } else {
    const claim = await tx.claim.create({ data: { ...fields, policyId: ctx.policyId, userId: ctx.userId } });
    await tx.intakeSession.update({ where: { id: session.id }, data: { claimId: claim.id } });
  }
  const linked = await tx.intakeSession.update({
    where: { id: session.id }, data: { confirmedAt: null, confirmationClaimVersion: null, confirmationText: null },
  });
  const claim = await tx.claim.findUniqueOrThrow({ where: { id: linked.claimId! } });
  await tx.activityEvent.create({ data: { claimId: claim.id, eventType: 'draft.saved', payloadJson: { version: claim.version } } });
  return { ok: true, claimId: claim.id, status: claim.status, version: claim.version, messageForAgent: 'The draft has been saved. Ask for explicit confirmation before submission.' };
}
export async function submitClaim(tx: Tx, ctx: ExecutionContext) {
  const session = await tx.intakeSession.findUniqueOrThrow({ where: { id: ctx.sessionId } });
  if (!session.claimId) throw new Problem(409, 'draft_required', 'Create a draft first.');
  const claim = await tx.claim.findUniqueOrThrow({ where: { id: session.claimId } });
  if (claim.status !== 'DRAFT') return { ok: true, claimId: claim.id, status: claim.status, messageForAgent: 'The report has already been submitted.' };
  if (!session.confirmedAt || session.confirmationClaimVersion !== claim.version) {
    throw new Problem(409, 'confirmation_required', 'Explicit confirmation of the current draft is required.');
  }
  if (!claim.incidentAt || !claim.location || !claim.description) {
    throw new Problem(422, 'incomplete_draft', 'Incident date with timezone, location, and narrative are required before submission.');
  }
  const changed = await tx.claim.updateMany({
    where: { id: claim.id, status: 'DRAFT', version: claim.version },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });
  if (!changed.count) throw new Problem(409, 'version_conflict', 'Claim changed before submission.');
  const run = await tx.investigationRun.upsert({
    where: { claimId_claimVersion: { claimId: claim.id, claimVersion: claim.version } }, update: {},
    create: { claimId: claim.id, claimVersion: claim.version },
  });
  await tx.activityEvent.create({ data: { claimId: claim.id, runId: run.id, eventType: 'claim.submitted', payloadJson: { runId: run.id } } });
  return { ok: true, claimId: claim.id, status: 'SUBMITTED', investigationStatus: 'QUEUED', messageForAgent: 'The report was submitted. A preliminary investigation is queued for human review.' };
}
export async function saveReport(tx: Tx, ctx: ExecutionContext, input: unknown) {
  const report = reportSchema.parse(input);
  if (!ctx.claimId || !ctx.runId) throw new Problem(403, 'run_required', 'An investigation run is required.');
  const existing = await tx.investigationReport.findUnique({ where: { runId: ctx.runId } });
  if (existing) return { ok: true, claimId: ctx.claimId, reportId: existing.id };
  const claim = await tx.claim.findUniqueOrThrow({ where: { id: ctx.claimId } });
  if (claim.status !== 'INVESTIGATING') throw new Problem(409, 'stage_conflict', 'Claim is not under investigation.');
  const lease = await tx.investigationRun.updateMany({
    where: { id: ctx.runId, claimId: ctx.claimId, claimVersion: claim.version, status: 'RUNNING', leaseOwner: ctx.leaseOwner, attempt: ctx.leaseAttempt ?? -1, leaseUntil: { gt: new Date() } },
    data: { leaseUntil: new Date(Date.now() + 120000) },
  });
  if (!lease.count) throw new Problem(409, 'lease_changed', 'The report belongs to an expired or reassigned investigation.');
  const saved = await tx.investigationReport.create({ data: {
    claimId: ctx.claimId, runId: ctx.runId, summary: report.summary,
    coverageReviewJson: report.coverageReview ?? Prisma.DbNull,
    incidentReviewJson: report.incidentReview ?? Prisma.DbNull,
    missingInformationJson: report.missingInformation, recommendation: report.recommendation, partial: report.partial,
  } });
  await tx.claim.update({ where: { id: ctx.claimId }, data: { status: report.partial ? 'INVESTIGATION_FAILED' : 'PENDING_HUMAN_REVIEW' } });
  await tx.investigationRun.update({ where: { id: ctx.runId }, data: { status: report.partial ? 'PARTIAL' : 'COMPLETED', finishedAt: new Date(), leaseUntil: null, leaseOwner: null } });
  await tx.activityEvent.create({ data: { claimId: ctx.claimId, runId: ctx.runId, eventType: 'report.saved', payloadJson: { reportId: saved.id, partial: report.partial } } });
  return { ok: true, claimId: ctx.claimId, reportId: saved.id };
}
