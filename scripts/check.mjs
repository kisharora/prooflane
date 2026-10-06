import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const files = [];
async function walk(dir) { for (const item of await readdir(dir, { withFileTypes: true })) { if (item.name.startsWith('.') || ['node_modules', 'recordings'].includes(item.name)) continue; const p = resolve(dir, item.name); if (item.isDirectory()) await walk(p); else files.push(p); } }
await walk(root);
for (const file of files.filter(f => /\.(?:m?js)$/.test(f))) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status) { console.error(result.stderr); process.exit(1); } }
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)) await readFile(resolve(root, 'dist', match[1]));
const forbidden = ['SERPAPI_API_KEY=', 'api_key='];
for (const file of files.filter(f => f.includes('/dist/'))) { const text = await readFile(file, 'utf8'); for (const word of forbidden) if (text.includes(word)) throw new Error(`Secret-like assignment is forbidden in public assets: ${file}`); }
console.log(`Checked JavaScript syntax, asset references, and public credential boundaries (${files.length} files).`);
