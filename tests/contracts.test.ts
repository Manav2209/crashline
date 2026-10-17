import { describe, expect, test } from 'bun:test';
import { draftSchema, toolScopes } from '../packages/contracts/src';
import { mergeFindings } from '../apps/orchestrator/src/services/reports';

describe('untrusted intake and provisional findings', () => {
  test('missing fields remain explicitly unknown', () => {
    expect(draftSchema.parse({})).toEqual({ incidentAt: null, location: null, description: null, injuryStatus: 'unknown', otherPartyInvolved: null, policeReportNumber: null });
  });
  test('rejects attacker-supplied ownership and role fields', () => {
    expect(() => draftSchema.parse({ policyId: 'another-user-policy', role: 'ORCHESTRATOR' })).toThrow();
  });
  test('rejects ambiguous incident timestamps', () => {
    expect(() => draftSchema.parse({ incidentAt: '2026-10-15T09:30:00' })).toThrow();
  });
  test('no role is allowed to settle a claim or change coverage', () => {
    for (const scope of Object.values(toolScopes)) {
      expect(scope).not.toContain('claims.approve_settlement');
      expect(scope).not.toContain('policy.change_coverage');
    }
    expect(toolScopes.POLICY_AGENT).not.toContain('claims.get_details');
    expect(toolScopes.INVESTIGATOR).not.toContain('policy.get_details');
  });
  test('a missing specialist produces a partial report without inventing coverage', () => {
    const report = mergeFindings(null, { incidentSummary: 'Customer reports a rear-end collision.', missingInformation: ['Police report'], apparentInconsistencies: [], followUpQuestions: ['Was a report filed?'], recommendHumanReview: true });
    expect(report.partial).toBe(true);
    expect(report.coverageReview).toBeNull();
    expect(report.missingInformation).toContain('Policy Agent review unavailable.');
    expect(report.recommendation).toContain('Human insurance professional review required');
  });
  test('invalid findings cannot be accepted as a complete report', () => {
    const report = mergeFindings({ guaranteedCoverage: true }, { recommendHumanReview: false });
    expect(report.partial).toBe(true);
    expect(report.coverageReview).toBeNull();
    expect(report.incidentReview).toBeNull();
  });
});
