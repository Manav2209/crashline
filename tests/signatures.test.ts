import { afterEach, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { z } from '../packages/contracts/node_modules/zod';
import { secureEqual, signContext, verifyContext } from '../packages/server/src';
import { verifyPostCall } from '../apps/api/src/services/provider';

const oldInternal = process.env.INTERNAL_SERVICE_TOKEN;
const oldWebhook = process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET;
afterEach(() => {
  if (oldInternal) process.env.INTERNAL_SERVICE_TOKEN = oldInternal; else delete process.env.INTERNAL_SERVICE_TOKEN;
  if (oldWebhook) process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET = oldWebhook; else delete process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET;
});
describe('signed context and provider webhook verification', () => {
  test('accepts signed context and rejects a modified payload', () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'test-only-internal-key';
    const token = signContext({ role: 'POLICY_AGENT' });
    expect(verifyContext(token, z.object({ role: z.literal('POLICY_AGENT') }))).toEqual({ role: 'POLICY_AGENT' });
    const [, signature] = token.split('.');
    const changed = Buffer.from(JSON.stringify({ payload: { role: 'ORCHESTRATOR' }, expiresAt: Date.now() + 1000 })).toString('base64url');
    expect(() => verifyContext(`${changed}.${signature}`, z.unknown())).toThrow();
  });
  test('rejects expired signed contexts', () => {
    process.env.INTERNAL_SERVICE_TOKEN = 'test-only-internal-key';
    const data = Buffer.from(JSON.stringify({ payload: {}, expiresAt: Date.now() - 1000 })).toString('base64url');
    const signature = createHmac('sha256', process.env.INTERNAL_SERVICE_TOKEN).update(data).digest('base64url');
    expect(() => verifyContext(`${data}.${signature}`, z.unknown())).toThrow('expired');
  });
  test('verifies the exact raw body, not reserialized JSON', () => {
    process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET = 'test-only-postcall-key';
    const raw = Buffer.from('{"type": "post_call_transcription"}');
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = createHmac('sha256', process.env.ELEVENLABS_POSTCALL_WEBHOOK_SECRET).update(`${timestamp}.`).update(raw).digest('hex');
    expect(() => verifyPostCall(raw, `t=${timestamp},v0=${digest}`)).not.toThrow();
    expect(() => verifyPostCall(Buffer.from('{"type":"post_call_transcription"}'), `t=${timestamp},v0=${digest}`)).toThrow();
    expect(() => verifyPostCall(raw, `t=${timestamp - 1000},v0=${digest}`)).toThrow();
  });
  test('empty secrets never compare as authenticated', () => {
    expect(secureEqual('', '')).toBe(false);
    expect(secureEqual('a', 'b')).toBe(false);
  });
});
