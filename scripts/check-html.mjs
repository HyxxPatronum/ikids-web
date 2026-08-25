import fs from 'node:fs';

const files = ['syllabus.html', 'index.html', 'account.html', 'admin.html'];

for (const file of files) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const match = source.match(/<script type="module">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`Missing module script: ${file}`);
  const script = match[1].replace(/^\s*import[^\n]+$/m, '');
  new Function(script);
  console.log(`${file}: script syntax ok`);
}
