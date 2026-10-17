import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../.env', import.meta.url);
let content: string;
try { content = await readFile(path, 'utf8'); }
catch { content = await readFile(new URL('../.env.example', import.meta.url), 'utf8'); }
const names = ['INTERNAL_SERVICE_TOKEN', 'DEMO_ACCESS_TOKEN', 'MCP_ACCESS_TOKEN', 'ELEVENLABS_WEBHOOK_TOOL_SECRET'];
const generated: string[] = [];
for (const name of names) {
  const pattern = new RegExp(`^${name}=([^\\r\\n]*)`, 'm');
  const match = content.match(pattern);
  if (match?.[1]?.trim()) continue;
  const entry = `${name}=${randomBytes(32).toString('hex')}`;
  content = match ? content.replace(pattern, entry) : `${content.trimEnd()}\n${entry}\n`;
  generated.push(name);
}
await writeFile(path, content);
console.info(JSON.stringify({ configured: generated, values: 'omitted', note: 'Add provider API keys locally. Existing non-empty values were preserved.' }));
