import express from 'express';
import { db } from '@crashline/db';
import { bearerAuth, createApp, errorHandler } from '@crashline/server';
import { claimsRouter } from './routers/claims';
import { sessionsRouter } from './routers/sessions';
import { postCallRouter, voiceRouter } from './routers/voice';
import { streamEvents } from './services/events';
import { voiceReady } from './services/configuration';

export function createApi() {
  const app = createApp(true);
  app.get('/health', async (_req, res) => {
    try { await db.$queryRaw`SELECT 1`; res.json({ service: 'api', status: 'up', database: 'connected' }); }
    catch { res.status(503).json({ service: 'api', status: 'degraded', database: 'unavailable' }); }
  });
  app.use('/api/webhooks/elevenlabs', postCallRouter);
  app.use(express.json({ limit: '128kb' }));
  app.use('/api/voice/tools', voiceRouter);
  app.get('/api/claims/:id/events', streamEvents);
  app.use('/api', bearerAuth('DEMO_ACCESS_TOKEN'));
  app.get('/api/configuration', async (_req, res) => res.json({
    armoriq: Boolean(process.env.ARMORIQ_API_KEY), model: process.env.MODEL_NAME || null,
    voice: await voiceReady(),
    mcpEndpoint: Boolean(process.env.INSURANCE_MCP_ENDPOINT), sandbox: true,
  }));
  app.use('/api/intake/sessions', sessionsRouter);
  app.use('/api', claimsRouter);
  app.use((_req, res) => res.status(404).json({ ok: false, code: 'not_found', message: 'Route not found.' }));
  app.use(errorHandler);
  return app;
}
