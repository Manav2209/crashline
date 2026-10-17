import express, { Router } from 'express';
import { z } from 'zod';
import { db } from '@crashline/db';
import { bearerAuth, createApp, errorHandler } from '@crashline/server';
import { toolsRouter } from './routers/tools';
import { startWorker } from './services/jobs';
import { retryInvestigation } from './services/investigations';

const app = createApp();
app.get('/health', (_req, res) => res.json({ service: 'orchestrator', status: 'up' }));
const internal = Router();
internal.use(bearerAuth('INTERNAL_SERVICE_TOKEN'), express.json({ limit: '128kb' }));
internal.use('/tools', toolsRouter);
internal.post('/investigations/start', async (req, res) => {
  const { claimId } = z.object({ claimId: z.string() }).strict().parse(req.body);
  res.json(await retryInvestigation(claimId));
});
internal.get('/runs/:id', async (req, res) => {
  const run = await db.investigationRun.findUniqueOrThrow({ where: { id: String(req.params.id) } });
  res.json(run);
});
app.use('/internal', internal);
app.use(errorHandler);
const stopWorker = startWorker();
const port = Number(process.env.PORT ?? process.env.ORCHESTRATOR_PORT ?? 4001);
const host = process.env.HOST ?? '127.0.0.1';
const server = app.listen(port, host, () => console.info(`orchestrator http://${host}:${port}`));
process.on('SIGTERM', () => { stopWorker(); server.close(); void db.$disconnect(); });
