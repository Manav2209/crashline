import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (['node_modules', '.tools', '.turbo', 'dist', 'generated', '.git'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) files.push(path);
  }
  return files;
}
let max = { lines: 0, file: '', name: '' };
const violations: string[] = [];
for (const file of await sourceFiles('.')) {
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    if (ts.isFunctionLike(node) && 'body' in node && node.body) {
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      const end = source.getLineAndCharacterOfPosition(node.end).line;
      const lines = end - start + 1;
      const name = node.name?.getText(source) ?? '(callback)';
      if (lines > max.lines) max = { lines, file, name };
      if (lines > 100) violations.push(`${file}:${start + 1} ${name}: ${lines} lines`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.info(JSON.stringify({ maximumAllowed: 100, longestFunction: max, violations }, null, 2));
if (violations.length) process.exitCode = 1;
