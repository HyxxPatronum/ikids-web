import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../index.html', import.meta.url).pathname;
let src = readFileSync(file, 'utf8');

const edits = [
  {
    from: `    .eliminate-pop { position: fixed; z-index: 120; left: 50%; top: 30%; transform: translate(-50%,-50%); padding: 14px 24px; border-radius: 14px; background: var(--green-soft); border: 1px solid #bfe3d2; text-align: center; box-shadow: 0 12px 30px rgba(25,54,88,.16); }
    .eliminate-pop strong { display: block; color: #216b4f; font-size: 20px; font-weight: 900; }
    .eliminate-pop span { display: block; margin-top: 4px; color: #216b4f; font-size: 15px; font-weight: 750; }
`,
    to: ``,
  },
  {
    from: `.word-tile.removed { place-content:center; padding:10px 8px; background:rgba(116,210,168,.12); color:#8fd4b8; box-shadow:inset 0 0 0 1px rgba(116,210,168,.2); pointer-events:none; animation:tile-cleared .28s cubic-bezier(.16,1,.3,1) both; }`,
    to: `.word-tile.removed { place-content:center; padding:10px 8px; color:#9fe0c4; pointer-events:none; animation:tile-cleared .28s cubic-bezier(.16,1,.3,1) both; }`,
  },
  {
    from: `translationsVisible:{}, fullTranslateOpen:false, eliminateTimer:null, comprehension:{},`,
    to: `translationsVisible:{}, fullTranslateOpen:false, comprehension:{},`,
  },
  {
    from: `    function wordTileCelebrationHtml(){const feedback=state.wordTileCelebration;if(!feedback)return '';const combo=feedback.combo||1;const messages={match:[combo>1?\`Match x${combo}!\`:'Match!','匹配正确'],eliminated:['Eliminated!','消除成功'],continue:['Continue!','继续'],combo:[\`Combo ×${combo}!\`,'Level up! · 连击升级']};const [title,subtitle]=messages[feedback.stage]||messages.continue;return \`<div class="word-match-burst ${feedback.stage}" role="status" aria-live="assertive"><strong>${title}</strong><span>${subtitle}</span></div>\`;}`,
    to: `    function wordTileCelebrationHtml(){const feedback=state.wordTileCelebration;if(!feedback||feedback.stage!=='eliminated')return '';const detail=[feedback.english,feedback.meaning].filter(Boolean).join(' · ');return \`<div class="word-match-burst eliminated" role="status" aria-live="assertive"><strong>Eliminate</strong>${detail?\`<span>${escapeHtml(detail)}</span>\`:''}</div>\`;}`,
  },
  {
    from: `if(state.wordTileMatched.includes(pair))return \`<span class="word-tile removed" aria-hidden="true"><small>${escapeHtml(item.meaning)}</small></span>\`;`,
    to: `if(state.wordTileMatched.includes(pair))return \`<span class="word-tile removed" aria-hidden="true"><small>${escapeHtml(item.english)}<br>${escapeHtml(item.meaning)}</small></span>\`;`,
  },
  {
    from: `<strong>${state.wordTileMatched.length} / ${items.length}</strong><span>MATCHED</span>`,
    to: `<strong>${state.wordTileMatched.length} / ${items.length}</strong><span>已消除</span>`,
  },
  {
    from: `      if(firstPair===pair&&firstKind!==kind){
        const combo=state.wordTileCombo+1;
        const sequence=++state.wordTileSequence;
        state.wordTileCombo=combo;
        state.wordTileFeedback=[\`clear:${first}\`,\`clear:${id}\`];
        state.wordTileCelebration={stage:'match',combo};
        playWordTileSound('match');
        renderWords();
        state.wordTileTimer=setTimeout(()=>{
          if(sequence!==state.wordTileSequence)return;
          if(!state.wordTileMatched.includes(pair))state.wordTileMatched.push(pair);
          state.wordTileSelected=null;
          state.wordTileFeedback=[];
          state.wordTileCelebration={stage:'eliminated',combo};
          playWordTileSound('eliminated');
          renderWords();
          completeWordsIfReady();
          saveProgress();
          state.wordTileTimer=setTimeout(()=>{
            if(sequence!==state.wordTileSequence)return;
            state.wordTileCelebration={stage:'continue',combo};
            state.wordTileLocked=false;
            renderWords();
            state.wordTileTimer=setTimeout(()=>{
              if(sequence!==state.wordTileSequence)return;
              if([3,5,8].includes(combo)){
                state.wordTileCelebration={stage:'combo',combo};
                playWordTileSound('combo');
                renderWords();
                state.wordTileTimer=setTimeout(()=>{if(sequence!==state.wordTileSequence)return;state.wordTileCelebration=null;renderWords();},1000);
              }else{
                state.wordTileCelebration=null;
                renderWords();
              }
            },300);
          },360);
        },320);
      }`,
    to: `      if(firstPair===pair&&firstKind!==kind){
        const combo=state.wordTileCombo+1;
        const sequence=++state.wordTileSequence;
        state.wordTileCombo=combo;
        const word=words()[Number(pair)];
        state.wordTileFeedback=[\`clear:${first}\`,\`clear:${id}\`];
        state.wordTileCelebration={stage:'eliminated',combo,english:String(word?.english||word?.word||''),meaning:String(word?.chinese||word?.meaning||'')};
        playWordTileSound('eliminated');
        renderWords();
        state.wordTileTimer=setTimeout(()=>{
          if(sequence!==state.wordTileSequence)return;
          if(!state.wordTileMatched.includes(pair))state.wordTileMatched.push(pair);
          state.wordTileSelected=null;
          state.wordTileFeedback=[];
          renderWords();
          completeWordsIfReady();
          saveProgress();
          state.wordTileTimer=setTimeout(()=>{
            if(sequence!==state.wordTileSequence)return;
            state.wordTileLocked=false;
            state.wordTileCelebration=null;
            renderWords();
          },1000);
        },430);
      }`,
  },
  {
    from: `    function closeEliminatePopup(){
      clearTimeout(state.eliminateTimer);
      const pop=document.querySelector('.eliminate-pop');
      if(pop)pop.remove();
    }
    function showEliminatePopup(meaning){
      closeEliminatePopup();
      const pop=document.createElement('div');
      pop.className='eliminate-pop';
      pop.innerHTML=\`<strong>Eliminate</strong><span>${escapeHtml(meaning||'')}</span>\`;
      document.body.appendChild(pop);
      state.eliminateTimer=setTimeout(closeEliminatePopup,900);
    }
    function tryMatch(){if(!state.selectedWord||!state.selectedMeaning)return;if(state.selectedWord===state.selectedMeaningAnswer){const matchedWord=state.selectedWord;state.matched.push(matchedWord);const pair=(state.card.wordModule?.matchPairs||words()).find(p=>p.word===matchedWord);const zh=(state.card.word_bank||[]).find(b=>String(b.english||'').toLowerCase()===matchedWord.toLowerCase())?.chinese||(pair&&(pair.chinese||pair.meaning))||'';showEliminatePopup(zh);setTimeout(completeWordsIfReady,0);}else toast('还不匹配，再想一想');state.selectedWord=null;state.selectedMeaning=null;state.selectedMeaningAnswer=null;saveProgress();}`,
    to: `    function tryMatch(){if(!state.selectedWord||!state.selectedMeaning)return;if(state.selectedWord===state.selectedMeaningAnswer){state.matched.push(state.selectedWord);toast('配对正确');setTimeout(completeWordsIfReady,0);}else toast('还不匹配，再想一想');state.selectedWord=null;state.selectedMeaning=null;state.selectedMeaningAnswer=null;saveProgress();}`,
  },
];

let missing = [];
for (const { from, to } of edits) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    missing.push({ count, snippet: from.slice(0, 60) });
    continue;
  }
  src = src.replace(from, to);
}

if (missing.length) {
  console.error('EDITS NOT APPLIED (expected each to match exactly once):');
  for (const m of missing) console.error(`  count=${m.count} : ${m.snippet}...`);
  process.exit(1);
}

writeFileSync(file, src, 'utf8');
console.log(`OK: applied ${edits.length - missing.length} edits.`);
