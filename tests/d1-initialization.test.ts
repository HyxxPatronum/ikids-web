import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initializeD1Production } from '../lib/infrastructure/d1-initialization.ts';

test('the real D1 initializer uses shared orchestration and all published database cards on rerun', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fluent-init-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'drizzle'));
  const calls: string[][] = [];
  const runCommand = (args: string[]) => {
    calls.push(args);
    if (args.some(argument => argument.startsWith('--command=SELECT'))) return JSON.stringify([{ results: [
      { id: 'seed', slug: 'seed', title: 'Seed', theme: '', image: '', status: 'published', content_json: JSON.stringify({ cardId: 'seed', status: 'published', word_bank: [{ english: 'flower', approved: true }] }) },
      { id: 'database-course', slug: 'database-course', title: 'Database course', theme: '', image: '', status: 'published', content_json: JSON.stringify({ cardId: 'database-course', status: 'published', word_bank: [{ english: 'microscope', approved: true }] }) },
    ] }]);
    return '';
  };
  const options = {
    root, remote: false, databaseId: 'local', databaseName: 'local', bucketName: 'media', minimumEcdictEntries: 2,
    dictionary: { source: 'ECDICT', count: 2, entries: { flower: ['', '花', '', '', ''], microscope: ['', '显微镜', '', '', ''] } },
    seedCards: [{ cardId: 'seed', courseId: 'course', status: 'published', word_bank: [{ english: 'flower', approved: true }] }],
    verify: async () => ({ ready: true }), runCommand,
  };
  const first = await initializeD1Production(options);
  const second = await initializeD1Production(options);
  assert.deepEqual(first, { status: 'ready', ecdictEntries: 2, catalogEntries: 2, mediaAssets: 0 });
  assert.deepEqual(second, first);
  const catalogSql = await fs.readFile(path.join(root, '.cache', 'catalog-production-seed.sql'), 'utf8');
  assert.match(catalogSql, /database-course/);
  assert.equal(calls.filter(args => args.includes('migrations')).length, 2);
});

test('the real D1 initializer stops before Catalog and media after an ECDICT failure', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fluent-init-failure-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'drizzle'));
  const calls: string[][] = [];
  await assert.rejects(initializeD1Production({
    root, remote: false, databaseId: 'local', databaseName: 'local', bucketName: 'media', minimumEcdictEntries: 2,
    dictionary: { source: 'ECDICT', count: 1, entries: { flower: ['', '花', '', '', ''] } }, seedCards: [],
    verify: async () => ({ ready: true }), runCommand: args => { calls.push(args); return ''; },
  }), /ecdict: data\/ecdict-compact\.json must contain at least 2/);
  assert.equal(calls.filter(args => args[0] === 'd1' && args[1] === 'execute').length, 0);
});

test('Wrangler initializes fresh D1/R2 state, reuses stored media, and recovers after a failed verification', { timeout: 120_000 }, async t => {
  const root = process.cwd();
  const persistence = await fs.mkdtemp(path.join(os.tmpdir(), 'fluent-wrangler-init-'));
  const mediaDirectory = path.join(root, '.cache', `integration-media-${process.pid}-${Date.now()}`);
  const mediaFile = path.join(mediaDirectory, 'flower.png');
  const mediaKey = path.relative(root, mediaFile).replaceAll('\\', '/');
  await fs.mkdir(mediaDirectory, { recursive: true });
  await fs.writeFile(mediaFile, new Uint8Array([137, 80, 78, 71]));
  t.after(async () => {
    await fs.rm(persistence, { recursive: true, force: true });
    await fs.rm(mediaDirectory, { recursive: true, force: true });
  });

  let verifications = 0;
  const options = {
    root, remote: false, persistArg: `--persist-to=${persistence}`,
    databaseId: 'local', databaseName: 'local', bucketName: 'media', minimumEcdictEntries: 2,
    dictionary: { source: 'ECDICT', count: 2, entries: { flower: ['', '花', '', '', ''], microscope: ['', '显微镜', '', '', ''] } },
    seedCards: [{
      cardId: 'integration-card', courseId: 'integration-course', day: 1, title: 'Integration',
      image: mediaKey, status: 'published', word_bank: [{ english: 'flower', approved: true }],
    }],
    async verify() {
      verifications += 1;
      if (verifications === 2) throw new Error('temporary readiness failure');
      return { ready: true };
    },
  };

  assert.deepEqual(await initializeD1Production(options), {
    status: 'ready', ecdictEntries: 2, catalogEntries: 1, mediaAssets: 1,
  });
  await fs.rm(mediaDirectory, { recursive: true, force: true });
  await assert.rejects(initializeD1Production(options), /verification: temporary readiness failure/);
  assert.deepEqual(await initializeD1Production(options), {
    status: 'ready', ecdictEntries: 2, catalogEntries: 1, mediaAssets: 1,
  });
});
