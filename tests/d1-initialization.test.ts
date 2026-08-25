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
