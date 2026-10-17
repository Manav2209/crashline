import { expect, test } from 'bun:test';
import { JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';
import { normalizeProxyMessage } from '../apps/insurance-mcp/src/protocol';

test('real MCP schema accepts a proxy envelope after removing non-authoritative IAM metadata', () => {
  const params = { name: 'policy__get_details', arguments: { _authorization: 'signed-domain-context' } };
  const incoming = { jsonrpc: '2.0', id: 'proxy-call', method: 'tools/call', params, _iam_context: { role: 'ADMIN', allowed_tools: ['*'] } };
  expect(JSONRPCMessageSchema.safeParse(incoming).success).toBe(false);
  const normalized = normalizeProxyMessage(incoming);
  expect(JSONRPCMessageSchema.safeParse(normalized).success).toBe(true);
  expect(normalized).not.toHaveProperty('_iam_context');
  expect((normalized as { params: unknown }).params).toBe(params);
  expect(incoming).toHaveProperty('_iam_context');
});
test('proxy normalization leaves unrelated protocol errors subject to SDK validation', () => {
  expect(JSONRPCMessageSchema.safeParse(normalizeProxyMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list', unexpected: true })).success).toBe(false);
  expect(JSONRPCMessageSchema.safeParse(normalizeProxyMessage({ jsonrpc: 'invalid', id: 1, method: 'tools/list' })).success).toBe(false);
  expect(normalizeProxyMessage(null)).toBeNull();
});
