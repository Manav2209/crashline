import { z } from 'zod';

export const roles = ['INTAKE', 'POLICY_AGENT', 'INVESTIGATOR', 'ORCHESTRATOR'] as const;
export const roleSchema = z.enum(roles);
export type Role = z.infer<typeof roleSchema>;
export const statuses = ['DRAFT', 'SUBMITTED', 'INVESTIGATING', 'PENDING_HUMAN_REVIEW', 'INVESTIGATION_FAILED'] as const;
export const draftSchema = z.object({
  incidentAt: z.string().datetime({ offset: true }).nullable().default(null),
  location: z.string().trim().min(2).max(500).nullable().default(null),
  description: z.string().trim().min(5).max(5000).nullable().default(null),
  injuryStatus: z.enum(['none_reported', 'reported', 'unknown']).default('unknown'),
  otherPartyInvolved: z.boolean().nullable().default(null),
  policeReportNumber: z.string().trim().max(100).nullable().default(null),
}).strict();
export type DraftInput = z.infer<typeof draftSchema>;
export const policyFindingSchema = z.object({
  policyStatusAtIncident: z.enum(['active', 'inactive', 'unknown']),
  possibleCoverages: z.array(z.string().max(500)).max(20),
  applicableDeductible: z.number().nonnegative().nullable(),
  exclusionsToReview: z.array(z.string().max(500)).max(20),
  missingPolicyData: z.array(z.string().max(500)).max(20),
  explanation: z.string().max(5000),
});
export const investigationFindingSchema = z.object({
  incidentSummary: z.string().max(5000),
  missingInformation: z.array(z.string().max(500)).max(30),
  apparentInconsistencies: z.array(z.string().max(500)).max(30),
  followUpQuestions: z.array(z.string().max(500)).max(30),
  recommendHumanReview: z.literal(true),
});
export const reportSchema = z.object({
  summary: z.string().max(10000),
  coverageReview: policyFindingSchema.nullable(),
  incidentReview: investigationFindingSchema.nullable(),
  missingInformation: z.array(z.string().max(500)).max(60),
  recommendation: z.literal('Human insurance professional review required. No coverage, fault, or payment decision has been made.'),
  partial: z.boolean(),
});
export const toolSchemas = {
  'policy.get_details': z.object({}).strict(),
  'policy.get_coverage_rules': z.object({}).strict(),
  'claims.get_details': z.object({}).strict(),
  'claims.get_intake_requirements': z.object({}).strict(),
  'claims.create_draft': draftSchema,
  'claims.submit_fnol': z.object({}).strict(),
  'claims.save_report': reportSchema,
  'claims.approve_settlement': z.object({ amount: z.number().positive().max(10000000) }).strict(),
  'policy.change_coverage': z.object({ effectiveFrom: z.string().datetime({ offset: true }) }).strict(),
} as const;
export type ToolName = keyof typeof toolSchemas;
export function armorAction(tool: ToolName) { return tool.replaceAll('.', '__'); }
export const toolNameSchema = z.enum(Object.keys(toolSchemas) as [ToolName, ...ToolName[]]);
export const toolScopes: Record<Role, readonly ToolName[]> = {
  INTAKE: ['policy.get_details', 'claims.get_details', 'claims.create_draft', 'claims.submit_fnol'],
  POLICY_AGENT: ['policy.get_details', 'policy.get_coverage_rules'],
  INVESTIGATOR: ['claims.get_details', 'claims.get_intake_requirements'],
  ORCHESTRATOR: ['policy.get_details', 'claims.get_details', 'claims.save_report'],
};
export const executionContextSchema = z.object({
  userId: z.string(), policyId: z.string(), sessionId: z.string(), claimId: z.string().nullable(),
  runId: z.string().nullable(), role: roleSchema, userEmail: z.string().email(),
  leaseOwner: z.string().nullable().default(null), leaseAttempt: z.number().int().nullable().default(null),
  correlationId: z.string(), operationId: z.string(),
});
export type ExecutionContext = z.infer<typeof executionContextSchema>;
export const toolRequestSchema = z.object({
  sessionId: z.string().uuid(), tool: toolNameSchema, args: z.record(z.unknown()),
  correlationId: z.string().uuid(), operationId: z.string().uuid(),
}).strict();
export type ClaimView = {
  id: string; policyId: string; status: typeof statuses[number]; incidentAt: string | null;
  location: string | null; description: string | null; injuryStatus: string;
  otherPartyInvolved: boolean | null; policeReportNumber: string | null; createdAt: string;
  version: number; seeded: boolean; reports?: ReportView[]; runs?: RunView[];
};
export type ReportView = {
  id: string; summary: string; coverageReviewJson: z.infer<typeof policyFindingSchema> | null;
  incidentReviewJson: z.infer<typeof investigationFindingSchema> | null;
  missingInformationJson: string[]; recommendation: string; partial: boolean;
};
export type RunView = { id: string; status: string; policyAgentStatus: string; investigatorStatus: string; error: string | null };
export type AttemptView = {
  id: string; claimId: string | null; agentType: string; mcpTool: string; decision: string;
  reason: string; executed: boolean; armorTraceId: string | null; planHash: string | null; createdAt: string;
  armorPlanId: string | null; enforcementSource: string | null; resultStatus: string; mcpInvoked: boolean;
};
export type EventView = { id: string; eventType: string; payloadJson: Record<string, unknown>; createdAt: string };
