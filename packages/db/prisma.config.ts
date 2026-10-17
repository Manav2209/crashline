import { defineConfig } from 'prisma/config';
import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);
export default defineConfig({ schema: 'prisma/schema.prisma' });
