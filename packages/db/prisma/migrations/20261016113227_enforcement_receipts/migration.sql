-- AlterTable
ALTER TABLE "ToolAttempt" ADD COLUMN     "armorPlanId" TEXT,
ADD COLUMN     "enforcementSource" TEXT,
ADD COLUMN     "mcpInvoked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resultStatus" TEXT NOT NULL DEFAULT 'NOT_EXECUTED';
