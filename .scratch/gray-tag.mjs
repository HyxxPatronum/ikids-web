import fs from 'node:fs';
const file = 'public/index.html';
let html = fs.readFileSync(file, 'utf8');
function edit(name, search, replace) {
  const c = html.split(search).length - 1;
  if (c !== 1) throw new Error(`[${name}] expected 1, found ${c}`);
  html = html.split(search).join(replace);
  console.log('applied:', name);
}
edit('tag-gray',
  '    .task-title .task-tag { color: var(--blue); }',
  '    .task-title .task-tag { color: var(--muted); }');
edit('divider-gray',
  '    .task-title .task-divider { width: 2px; height: 15px; border-radius: 2px; background: var(--blue); }',
  '    .task-title .task-divider { width: 2px; height: 15px; border-radius: 2px; background: var(--line); }');
fs.writeFileSync(file, html);
console.log('done');
