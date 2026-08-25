import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import flower from '../day001-flower.json' with { type: 'json' };
import cactus from '../science-reader-100-how-a-cactus-saves-water.json' with { type: 'json' };
import { initializeD1Production } from '../lib/infrastructure/d1-initialization.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local');
if (remote === local) throw new Error('Pass exactly one of --local or --remote');
const baseUrl = String(process.argv.find(argument => argument.startsWith('--url='))?.slice(6) || '').replace(/\/$/, '');
const skipApplication = process.argv.includes('--skip-application');
if (!baseUrl && !skipApplication) throw new Error('Pass --url=<deployed application URL> or --skip-application');
if (!String(process.env.CONTENT_EDITOR_PREVIEW_TOKEN || '').trim()) throw new Error('CONTENT_EDITOR_PREVIEW_TOKEN is required');
const databaseId = remote ? String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim() : '00000000-0000-4000-8000-000000000000';
if (!databaseId) throw new Error('CLOUDFLARE_D1_DATABASE_ID is required for --remote');
const dictionary = JSON.parse(await fs.readFile(path.join(root, 'data', 'ecdict-compact.json'), 'utf8'));

const result = await initializeD1Production({
  root, remote, databaseId, dictionary, seedCards: [flower, cactus],
  databaseName: String(process.env.CLOUDFLARE_D1_DATABASE_NAME || 'fluent-science-reading'),
  bucketName: String(process.env.CLOUDFLARE_R2_BUCKET_NAME || 'fluent-science-reading-media'),
  persistArg: process.argv.find(argument => argument.startsWith('--persist-to=')),
  async verify() {
    if (skipApplication) return { ready: true };
    const response = await fetch(`${baseUrl}/api/health`);
    if (!response.ok) throw new Error(`Application readiness failed: ${await response.text()}`);
    return { ready: true };
  },
});
process.stdout.write(`${JSON.stringify(result)}\n`);
