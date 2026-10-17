import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import { createApi } from '../apps/api/src/app';

const suite = process.env.RUN_DB_TESTS === 'true' ? describe : describe.skip;
suite('HTTP access and query boundaries on the local synthetic API', () => {
  let server: Server;
  let origin: string;
  beforeAll(async () => {
    server = createApi().listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server failed to listen.');
    origin = `http://127.0.0.1:${address.port}`;
  });
  afterAll(() => server.close());
  function headers() { return { Authorization: `Bearer ${process.env.DEMO_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }; }
  test('dashboard credentials are required and provider credentials cannot replace them', async () => {
    expect((await fetch(`${origin}/api/claims`)).status).toBe(401);
    expect((await fetch(`${origin}/api/claims`, { headers: { Authorization: `Bearer ${process.env.ELEVENLABS_WEBHOOK_TOOL_SECRET}` } })).status).toBe(401);
  });
  test('unknown and unowned resources return 404', async () => {
    expect((await fetch(`${origin}/api/claims/UNKNOWN`, { headers: headers() })).status).toBe(404);
    expect((await fetch(`${origin}/api/policies/POL-1002`, { headers: headers() })).status).toBe(404);
  });
  test('unsupported statuses and invalid page numbers cannot reach an unchecked query', async () => {
    expect((await fetch(`${origin}/api/claims?status=APPROVED`, { headers: headers() })).status).toBe(400);
    expect((await fetch(`${origin}/api/claims?page=-1`, { headers: headers() })).status).toBe(400);
  });
  test('confirming a missing intake session returns 404 rather than a database error', async () => {
    const response = await fetch(`${origin}/api/intake/sessions/${crypto.randomUUID()}/confirm`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ version: 1, confirmed: true, confirmationText: 'Confirm synthetic draft.' }),
    });
    expect(response.status).toBe(404);
    expect((await response.json() as { code: string }).code).toBe('session_not_found');
  });
  test('configuration reports do not disclose provider secrets or access tokens', async () => {
    const response = await fetch(`${origin}/api/configuration`, { headers: headers() });
    const text = await response.text();
    expect(response.status).toBe(200);
    for (const key of ['ARMORIQ_API_KEY', 'ELEVENLABS_API_KEY', 'MODEL_API_KEY', 'DEMO_ACCESS_TOKEN', 'INTERNAL_SERVICE_TOKEN']) {
      if (process.env[key]) expect(text).not.toContain(process.env[key]!);
    }
  });
  test('stream access requires a one-use scoped ticket', async () => {
    expect((await fetch(`${origin}/api/claims/CLM-DEMO-1001/events`)).status).toBe(401);
  });
  test('voice tool requests require provider authentication and cannot accept arbitrary sessions', async () => {
    const request = { method: 'POST', headers: headers(), body: JSON.stringify({ sessionId: crypto.randomUUID(), conversationId: 'test', operationId: crypto.randomUUID(), args: {} }) };
    expect((await fetch(`${origin}/api/voice/tools/fetch-policy`, request)).status).toBe(401);
    request.headers.Authorization = `Bearer ${process.env.ELEVENLABS_WEBHOOK_TOOL_SECRET}`;
    expect((await fetch(`${origin}/api/voice/tools/fetch-policy`, request)).status).toBe(401);
  });
  test('malformed JSON is a client error and does not echo the raw body', async () => {
    const response = await fetch(`${origin}/api/intake/sessions`, { method: 'POST', headers: headers(), body: '{"secret":"SENSITIVE_TEST_VALUE"' });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain('SENSITIVE_TEST_VALUE');
  });
});
