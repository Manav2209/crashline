import { db } from './index';

async function seed() {
  await db.demoUser.upsert({
    where: { id: 'DEMO-001' }, update: {},
    create: { id: 'DEMO-001', displayName: 'Alex Morgan', email: 'alex@example.test' },
  });
  await db.policy.upsert({
    where: { id: 'POL-1001' }, update: {},
    create: {
      id: 'POL-1001', holderId: 'DEMO-001', status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveTo: new Date('2027-01-01T00:00:00Z'),
      coveragesJson: ['Collision damage subject to policy terms', 'Third-party liability subject to policy terms'],
      exclusionsJson: ['Intentional damage', 'Use outside the permitted vehicle class'],
      deductible: 500, limitsJson: { collision: 25000, liability: 100000, currency: 'USD' },
    },
  });
  await db.claim.upsert({
    where: { id: 'CLM-DEMO-1001' }, update: {},
    create: {
      id: 'CLM-DEMO-1001', policyId: 'POL-1001', userId: 'DEMO-001', seeded: true,
      incidentAt: new Date('2026-10-15T09:30:00+05:30'), location: 'Demo City · Main Street signal',
      description: 'Synthetic example: rear-ended while stationary at a traffic signal.',
      injuryStatus: 'none_reported', otherPartyInvolved: true,
    },
  });
  console.info('Seeded synthetic user, policy, and one clearly labeled example draft. No enforcement evidence was seeded.');
}

try { await seed(); } finally { await db.$disconnect(); }
