import { createApi } from './app';
import { db } from '@crashline/db';
const server = createApi().listen(Number(process.env.API_PORT ?? 4000), '127.0.0.1', () => console.info('api http://127.0.0.1:4000'));
process.on('SIGTERM', () => { server.close(); void db.$disconnect(); });
