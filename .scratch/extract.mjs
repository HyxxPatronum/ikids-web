import fs from 'node:fs';
const s=fs.readFileSync('index.html','utf8');
const scripts=[...s.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
console.log('script blocks:',scripts.length);
let i=0;
for(const body of scripts){
  i++;
  fs.writeFileSync(`.scratch/check-${i}.js`,body);
}
console.log('written');
