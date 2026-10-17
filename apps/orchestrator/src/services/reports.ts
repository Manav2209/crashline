import { policyFindingSchema, investigationFindingSchema, reportSchema } from '@crashline/contracts';

export function mergeFindings(policy: unknown, incident: unknown) {
  const coverage = policyFindingSchema.safeParse(policy);
  const investigation = investigationFindingSchema.safeParse(incident);
  const missing = [
    ...(coverage.success ? coverage.data.missingPolicyData : ['Policy Agent review unavailable.']),
    ...(investigation.success ? investigation.data.missingInformation : ['Claims Investigator review unavailable.']),
  ];
  return reportSchema.parse({
    summary: investigation.success ? investigation.data.incidentSummary : 'The incident review is incomplete. Human follow-up is required.',
    coverageReview: coverage.success ? coverage.data : null,
    incidentReview: investigation.success ? investigation.data : null,
    missingInformation: [...new Set(missing)], partial: !coverage.success || !investigation.success,
    recommendation: 'Human insurance professional review required. No coverage, fault, or payment decision has been made.',
  });
}
