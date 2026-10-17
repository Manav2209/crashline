-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'INVESTIGATING', 'PENDING_HUMAN_REVIEW', 'INVESTIGATION_FAILED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "DemoUser" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "DemoUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "coveragesJson" JSONB NOT NULL,
    "exclusionsJson" JSONB NOT NULL,
    "deductible" DECIMAL(12,2) NOT NULL,
    "limitsJson" JSONB NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "incidentAt" TIMESTAMP(3),
    "location" TEXT,
    "description" TEXT,
    "injuryStatus" TEXT NOT NULL DEFAULT 'unknown',
    "otherPartyInvolved" BOOLEAN,
    "policeReportNumber" TEXT,
    "submittedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "seeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "claimId" TEXT,
    "providerConversationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sessionTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmationClaimVersion" INTEGER,
    "confirmationText" TEXT,
    "transcriptSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationRun" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "claimVersion" INTEGER NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "policyAgentStatus" TEXT NOT NULL DEFAULT 'QUEUED',
    "investigatorStatus" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestigationReport" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "coverageReviewJson" JSONB,
    "incidentReviewJson" JSONB,
    "missingInformationJson" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "partial" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestigationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolAttempt" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "claimId" TEXT,
    "runId" TEXT,
    "sessionId" TEXT,
    "agentType" TEXT NOT NULL,
    "mcpTool" TEXT NOT NULL,
    "requestJson" JSONB NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "armorTraceId" TEXT,
    "planHash" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT,
    "runId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolExecution" (
    "operationId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolExecution_pkey" PRIMARY KEY ("operationId")
);

-- CreateTable
CREATE TABLE "McpInvocation" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoUser_email_key" ON "DemoUser"("email");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_userId_createdAt_idx" ON "Claim"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSession_providerConversationId_key" ON "IntakeSession"("providerConversationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSession_sessionTokenHash_key" ON "IntakeSession"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "IntakeSession_claimId_idx" ON "IntakeSession"("claimId");

-- CreateIndex
CREATE INDEX "InvestigationRun_claimId_idx" ON "InvestigationRun"("claimId");

-- CreateIndex
CREATE INDEX "InvestigationRun_status_leaseUntil_idx" ON "InvestigationRun"("status", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "InvestigationRun_claimId_claimVersion_key" ON "InvestigationRun"("claimId", "claimVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AgentFinding_runId_agentType_key" ON "AgentFinding"("runId", "agentType");

-- CreateIndex
CREATE UNIQUE INDEX "InvestigationReport_runId_key" ON "InvestigationReport"("runId");

-- CreateIndex
CREATE INDEX "ToolAttempt_runId_idx" ON "ToolAttempt"("runId");

-- CreateIndex
CREATE INDEX "ToolAttempt_claimId_createdAt_idx" ON "ToolAttempt"("claimId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolAttempt_sessionId_idx" ON "ToolAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "ToolAttempt_operationId_idx" ON "ToolAttempt"("operationId");

-- CreateIndex
CREATE INDEX "ActivityEvent_claimId_createdAt_id_idx" ON "ActivityEvent"("claimId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ToolExecution_tool_createdAt_idx" ON "ToolExecution"("tool", "createdAt");

-- CreateIndex
CREATE INDEX "McpInvocation_tool_createdAt_idx" ON "McpInvocation"("tool", "createdAt");

-- CreateIndex
CREATE INDEX "McpInvocation_operationId_idx" ON "McpInvocation"("operationId");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "DemoUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DemoUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession" ADD CONSTRAINT "IntakeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DemoUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession" ADD CONSTRAINT "IntakeSession_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession" ADD CONSTRAINT "IntakeSession_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationRun" ADD CONSTRAINT "InvestigationRun_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFinding" ADD CONSTRAINT "AgentFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InvestigationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationReport" ADD CONSTRAINT "InvestigationReport_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestigationReport" ADD CONSTRAINT "InvestigationReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InvestigationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolAttempt" ADD CONSTRAINT "ToolAttempt_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolAttempt" ADD CONSTRAINT "ToolAttempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InvestigationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolAttempt" ADD CONSTRAINT "ToolAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "IntakeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InvestigationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
