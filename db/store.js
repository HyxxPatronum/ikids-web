import fs from 'node:fs/promises';
import path from 'node:path';

export function createStore(root) {
  const file = path.join(root, 'data', 'app-db.json');
  const legacyUsers = path.join(root, 'data', 'users.json');
  const legacyProgress = path.join(root, 'data', 'progress.json');
  const seriesSeed = path.join(root, 'data', 'series.json');
  const empty = { users: {}, sessions: {}, progress: {}, recordings: [], cards: {}, series: [] };
  async function readJson(target, fallback) { try { return JSON.parse(await fs.readFile(target, 'utf8')); } catch { return fallback; } }
  async function load() {
    const current = await readJson(file, null); if (current) {
      const db = { ...empty, ...current };
      if (!db.series.length) { db.series = await readJson(seriesSeed, []); await save(db); }
      return db;
    }
    const u = await readJson(legacyUsers, { users: {} }); const p = await readJson(legacyProgress, { users: {} });
    const db = { ...empty, users: u.users || {}, progress: p.users || {}, series: await readJson(seriesSeed, []) }; await save(db); return db;
  }
  async function save(db) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(db, null, 2)); }
  return { load, save };
}
