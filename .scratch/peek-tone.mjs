import fs from 'node:fs';
const html = fs.readFileSync('public/index.html', 'utf8');
for (const line of html.split('\n')) {
  if (line.includes('--choice-bg:')) {
    const i = line.indexOf('[data-tone');
    console.log(line.slice(i, i + 200));
  }
}
