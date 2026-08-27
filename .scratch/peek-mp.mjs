import fs from 'node:fs';
const html = fs.readFileSync('public/index.html', 'utf8');
for (const pat of ['.matched-pairs {', '.matched-pairs-title', '.matched-pair {', '.matched-pair-word', '.matched-pair-arrow', '.matched-pair-meaning', '.matched-pair.is-new']) {
  const line = html.split('\n').find(l => l.includes(pat));
  if (!line) { console.log('NOT FOUND: ' + pat); continue; }
  const i = line.indexOf(pat);
  console.log(line.slice(Math.max(0,i-4), i + 260));
  console.log('');
}
