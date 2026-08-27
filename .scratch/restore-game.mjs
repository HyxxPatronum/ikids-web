import fs from 'node:fs';
const file='index.html';
let s=fs.readFileSync(file,'utf8');
const original=s;

// 1. restore meanings from all pairs (remove openPairs filter)
let lines=s.split('\n');
const openIdx=lines.findIndex(l=>l.includes('const openPairs=pairs.filter'));
if(openIdx<0){console.error('openPairs not found');process.exit(1);}
const meanIdx=lines.findIndex(l=>l.includes('const meanings=[...openPairs].sort'));
if(meanIdx<0){console.error('meanings not found');process.exit(1);}
lines[openIdx]='      const meanings=[...pairs].sort((a,b)=>a.meaning.localeCompare(b.meaning));';
lines.splice(meanIdx,1);

// 2. matchBoard: show all pairs, matched get matched+disabled
const mbIdx=lines.findIndex(l=>l.includes('const matchBoard=openPairs.length'));
if(mbIdx<0){console.error('matchBoard not found');process.exit(1);}
lines[mbIdx]="      const matchBoard=`<div class=\"match-board\"><div class=\"match-column\">${pairs.map(pair=>{const done=state.matched.includes(pair.word);return `<button type=\"button\" class=\"match-choice ${state.selectedWord===pair.word?'selected':''} ${done?'matched':''}\" data-tone=\"${toneFor(pair.word)}\" data-match-word=\"${escapeHtml(pair.word)}\" ${done?'disabled':''}>${escapeHtml(pair.word)}</button>`;}).join('')}</div><div class=\"match-column\">${meanings.map(pair=>{const done=state.matched.includes(pair.word);return `<button type=\"button\" class=\"match-choice ${state.selectedMeaning===pair.meaning?'selected':''} ${done?'matched':''}\" data-tone=\"${toneFor(pair.word)}\" data-match-meaning=\"${escapeHtml(pair.meaning)}\" data-match-answer=\"${escapeHtml(pair.word)}\" ${done?'disabled':''}>${escapeHtml(pair.meaning)}</button>`;}).join('')}</div></div>`;";
s=lines.join('\n');

// 3. 消消乐 MATCHED -> Chinese
const oldTile='<span class="word-tile removed" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/></svg><small>MATCHED</small></span>';
const newTile='`<span class="word-tile removed" aria-hidden="true"><small>${escapeHtml(item.meaning)}</small></span>`';
if(!s.includes(oldTile)){console.error('tile placeholder not found');process.exit(1);}
s=s.replace(oldTile,newTile);

// 4. CSS: removed card
lines=s.split('\n');
const cssRemoved=lines.findIndex(l=>l.includes('.word-tile.removed {'));
const cssSvg=lines.findIndex(l=>l.includes('.word-tile.removed svg {'));
const cssSmall=lines.findIndex(l=>l.includes('.word-tile.removed small {'));
if(cssRemoved<0||cssSvg<0||cssSmall<0){console.error('css not found');process.exit(1);}
lines[cssRemoved]='    .word-tile.removed { place-content:center; padding:10px 8px; background:rgba(116,210,168,.12); color:#8fd4b8; box-shadow:inset 0 0 0 1px rgba(116,210,168,.2); pointer-events:none; animation:tile-cleared .28s cubic-bezier(.16,1,.3,1) both; }';
lines[cssSmall]='    .word-tile.removed small { max-width:100%; overflow-wrap:anywhere; font-size:13px; font-weight:800; line-height:1.25; text-align:center; letter-spacing:0; }';
lines.splice(cssSvg,1);
s=lines.join('\n');

// 5. media query: update svg ref to small ref
if(!s.includes('word-tile.removed svg{width:22px;height:22px}')){console.error('media svg not found');process.exit(1);}
s=s.replace('word-tile.removed svg{width:22px;height:22px}','word-tile.removed small{font-size:11px}');

if(s===original){console.error('no change');process.exit(1);}
fs.writeFileSync(file,s,'utf8');
console.log('Applied OK');
