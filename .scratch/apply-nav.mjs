import fs from 'node:fs';
const file = 'public/index.html';
let html = fs.readFileSync(file, 'utf8');
const norm = s => s.replace(/\r\n/g, '\n').replace(/\n$/, '');
const search = norm(fs.readFileSync('.scratch/nav/old-nav.txt', 'utf8'));
const replace = norm(fs.readFileSync('.scratch/nav/new-nav.txt', 'utf8'));
const oldCount = html.split(search).length - 1;
const newCount = html.split(replace).length - 1;
if (oldCount === 1) { html = html.split(search).join(replace); console.log('applied: nav'); }
else if (newCount >= 1) { console.log('already'); }
else throw new Error('nav neither found');
// CSS：锁定 tab 样式
const cssSearch = '    .module-tab.done span { border-color: var(--green); background: var(--green); }';
const cssRepl = '    .module-tab.done span { border-color: var(--green); background: var(--green); }\n    .module-tab.locked { color: #c2ccd8; cursor: not-allowed; }';
const cc = html.split(cssSearch).length - 1;
if (cc !== 1) throw new Error('css expected 1, found ' + cc);
html = html.split(cssSearch).join(cssRepl);
fs.writeFileSync(file, html);
console.log('done');
