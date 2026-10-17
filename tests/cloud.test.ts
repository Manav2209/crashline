import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createApp } from '../packages/server/src';
import type { Server } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveWeb } from '../apps/api/src/services/web';

let server: Server;
let origin: string;
let directory: string;
const previous = process.env.WEB_DIST_PATH;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'crashline-web-test-'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>CrashLine</title>');
  await writeFile(join(directory, '.env'), 'PRIVATE_TEST_VALUE');
  process.env.WEB_DIST_PATH = directory;
  const app = createApp();
  app.use('/api', (_req, res) => res.status(401).json({ code: 'unauthorized' }));
  serveWeb(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to listen.');
  origin = `http://127.0.0.1:${address.port}`;
  if (previous === undefined) delete process.env.WEB_DIST_PATH;
  else process.env.WEB_DIST_PATH = previous;
});
afterAll(async () => {
  server?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});
test('hosted deep links serve the SPA while API routes retain authentication', async () => {
  const page = await fetch(`${origin}/claims/demo`);
  expect(page.status).toBe(200);
  expect(await page.text()).toContain('<title>CrashLine</title>');
  expect((await fetch(`${origin}/api/claims`)).status).toBe(401);
});
test('static hosting does not expose dotfiles or convert unknown routes into the app', async () => {
  const response = await fetch(`${origin}/.env`);
  expect(response.status).toBe(404);
  expect(await response.text()).not.toContain('PRIVATE_TEST_VALUE');
  expect((await fetch(`${origin}/unknown`)).status).toBe(404);
});
