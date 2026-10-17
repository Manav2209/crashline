import { PrismaClient } from '@prisma/client';
const globalDb = globalThis as unknown as { crashlineDb?: PrismaClient };
export const db = globalDb.crashlineDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.crashlineDb = db;
export { Prisma } from '@prisma/client';
export type { Claim, IntakeSession, InvestigationRun } from '@prisma/client';
