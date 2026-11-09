import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const account = process.env.CLOUDFLARE_ACCOUNT_ID || 'c59e71abfb131f5a984a17c911fcf794';
const worker = 'sotw-website';
const api = `https://api.cloudflare.com/client/v4/accounts/${account}`;
const manifest = {};
const files = new Map();
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(path.join(root, 'dist'), absolute);
    // Media is already delivered by the dedicated R2 asset service.
    if (relative.split(path.sep)[0] === 'media') continue;
    if (entry.isDirectory()) { await collect(absolute); continue; }
    if (!entry.isFile()) continue;
    const bytes = await readFile(absolute);
    const extension = path.extname(absolute);
    const base64 = bytes.toString('base64');
    const hash = createHash('sha256').update(base64 + extension.slice(1)).digest('hex').slice(0, 32);
    manifest['/' + relative.split(path.sep).join('/')] = { hash, size: bytes.length };
    files.set(hash, { base64, type: types[extension] || 'application/octet-stream' });
  }
}
await collect(path.join(root, 'dist'));
if (!manifest['/index.html'] || !manifest['/contact/index.html']) throw new Error('Build the homepage and contact page before deploying.');
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ account, worker, files: Object.keys(manifest).length, bytes: Object.values(manifest).reduce((n, file) => n + file.size, 0), manifest }, null, 2));
  process.exit(0);
}
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required. Set it as a CI secret, never in source code.');
async function request(url, body, bearer = token) {
  const form = body instanceof FormData;
  const response = await fetch(url, { method: url.endsWith(`/scripts/${worker}`) ? 'PUT' : 'POST', headers: { Authorization: `Bearer ${bearer}`, ...(form ? {} : { 'Content-Type': 'application/json' }) }, body: form ? body : JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(`Cloudflare request failed (${response.status}): ${JSON.stringify(result.errors)}`);
  return result.result;
}
const session = await request(`${api}/workers/scripts/${worker}/assets-upload-session`, { manifest });
let completion = session.jwt;
for (const [i, bucket] of session.buckets.entries()) {
  const form = new FormData();
  for (const hash of bucket) {
    const file = files.get(hash);
    if (!file) throw new Error('Cloudflare requested an unknown asset hash.');
    form.append(hash, new Blob([file.base64], { type: file.type }), hash);
  }
  const result = await request(`${api}/workers/assets/upload?base64=true`, form, session.jwt);
  if (result.jwt) completion = result.jwt;
  console.log(`Uploaded asset batch ${i + 1}/${session.buckets.length}`);
}
const metadata = JSON.parse(await readFile(path.join(root, 'cloudflare/website-worker-metadata.json'), 'utf8'));
delete metadata.keep_assets;
metadata.assets.jwt = completion;
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
form.append('worker.js', new Blob([await readFile(path.join(root, 'cloudflare/website-worker.js'), 'utf8')], { type: 'application/javascript+module' }), 'worker.js');
await request(`${api}/workers/scripts/${worker}`, form);
console.log('Deployed sotw-website to https://offthewall.studio');
