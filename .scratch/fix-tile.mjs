import fs from 'node:fs';
const file='index.html';
let s=fs.readFileSync(file,'utf8');
const broken="return '`<span class=\"word-tile removed\" aria-hidden=\"true\"><small>${escapeHtml(item.meaning)}</small></span>`'";
const fixed='return `<span class="word-tile removed" aria-hidden="true"><small>${escapeHtml(item.meaning)}</small></span>`';
if(!s.includes(broken)){console.error('broken tile string not found');process.exit(1);}
s=s.replace(broken,fixed);
fs.writeFileSync(file,s,'utf8');
console.log('fixed OK');
