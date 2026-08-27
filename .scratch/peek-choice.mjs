import fs from 'node:fs';
const html = fs.readFileSync('public/index.html', 'utf8');
for (const pat of ['--choice-bg', '--choice-border', '.match-choice {', '.matched-pair {', '.match-column']) {
  const lines = html.split('\n').filter(l => l.includes(pat));
  if (!lines.length) { console.log('NOT FOUND: ' + pat); continue; }
  console.log('--- ' + pat + ' ---');
  for (const l of lines.slice(0,3)) {
    const i = l.indexOf(pat);
    console.log(l.slice(Math.max(0,i-4), i + 200));
  }
  console.log('');
}
