import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { bearerAuth, createApp, errorHandler } from '@crashline/server';
import { createInsuranceServer } from './server';
import { normalizeProxyMessage } from './protocol';

const app = createApp();
app.get('/health', (_req, res) => res.json({ service: 'insurance-mcp', status: 'up' }));
app.post('/mcp', bearerAuth('MCP_ACCESS_TOKEN'), express.json({ limit: '128kb' }), async (req, res) => {
  const server = createInsuranceServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: false });
  res.on('close', () => { void transport.close(); void server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, normalizeProxyMessage(req.body));
});
app.all('/mcp', bearerAuth('MCP_ACCESS_TOKEN'), (_req, res) => res.status(405).json({ error: 'Use POST with Streamable HTTP.' }));
app.use(errorHandler);
app.listen(Number(process.env.MCP_PORT ?? 4002), '127.0.0.1', () => console.info('insurance-mcp http://127.0.0.1:4002/mcp'));
