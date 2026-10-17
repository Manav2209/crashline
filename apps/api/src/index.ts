import { createApi } from './app';
import { db } from '@crashline/db';
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const host = process.env.HOST ?? '127.0.0.1';
const server = createApi().listen(port, host, () => console.info(`api http://${host}:${port}`));
process.on('SIGTERM', () => { server.close(); void db.$disconnect(); });
