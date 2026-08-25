import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, 'public');
const files = [
  'index.html', 'syllabus.html', 'account.html', 'admin.html',
  'styles.css', 'shared.js', 'day001-flower.png', 'day001-flower.json',
  'science-reader-100-how-a-cactus-saves-water.json'
];

await fs.mkdir(publicDir, { recursive: true });
await fs.rm(path.join(publicDir, 'words.html'), { force: true });
for (const file of files) await fs.copyFile(path.join(root, file), path.join(publicDir, file));
console.log(`Prepared ${files.length} public assets.`);
