import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function serveWeb(app: Express) {
  const directory = process.env.WEB_DIST_PATH;
  if (!directory) return;
  const root = resolve(directory);
  const index = resolve(root, 'index.html');
  if (!existsSync(index)) throw new Error('WEB_DIST_PATH must contain the built UI index.html.');
  app.use(express.static(root, { index: false, dotfiles: 'deny' }));
  app.get(['/', '/intake', '/claims', '/claims/:id', '/activity', '/settings'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
