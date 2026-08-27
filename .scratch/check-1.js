
    import { $, $$, api, currentUserId, escapeHtml, nav, speak, toast, formatDate } from '/shared.js';
    $('#nav').innerHTML = nav();
    const lessonApp=$('#app');if(lessonApp){lessonApp.addEventListener('contextmenu',e=>e.preventDefault());}
    const modules = [
      ['reading','Listen and Read','阅读与练习',['reading','listening']],['words','Words','核心词'],
      ['comprehension','Comprehension',''],['rebuild','Rebuild','重建'],['result','Result','结果']
    ];
    const state = { card:null, active:'reading', rate:1, current:-1, playbackProgress:0, speechToken:0, singlePlaying:false, previewIndex:null, dragWasPlaying:false, resumePosition:null, practiceCurrent:-1, playing:false, wordBankReviewed:false, selectedWord:null, selectedMeaning:null, matched:[], matchAnimationWord:null, wordTileOrder:[], wordTileSelected:null, wordTileMatched:[], wordTileFeedback:[], wordTileLocked:false, wordTileTimer:null, wordTileCombo:0, wordTileCelebration:null, wordTileSequence:0, context:{}, contextSelected:null, contextChecked:false, contextWrong:[], contextReturned:[], contextFeedbackTimer:null, translationsVisible:{}, fullTranslateOpen:false, eliminateTimer:null, comprehension:{}, comprehensionChecked:false, rebuild:[], rebuildSelected:null, rebuildBankOrder:[], rebuildChecked:false, moduleStatus:{}, recording:null, recordingIndex:-1, recordingStartedAt:null, recordingTimer:null, recordingUrls:{}, recordingDataUrls:{}, recordingBlobs:{}, submittedPractice:[],scoring:{},scores:{},unrecognized:{} };
    let wordTileAudioContext=null;
    const SCORE_ENDPOINT=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?'http://127.0.0.1:8787/score':'/api/score';
    const slug = location.pathname.startsWith('/lesson/') ? decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()) : new URLSearchParams(location.search).get('lesson') || 'day001-flower';
    const sentences = () => (state.card.paragraphs || []).flatMap(p => typeof p === 'string' ? (p.match(/[^.!?]+[.!?]+/g) || [p]) : (p.sentences || []).map(s => s.text || s));
    const practiceSentences = () => state.card.listenRead?.sentences?.length ? state.card.listenRead.sentences : sentences().slice(0,2).map((sentence,index)=>({sentence,role:index?'Structure':'Science Core'}));
    const practiceDemoIndex = item => {
      const text = String(typeof item === 'string' ? item : item?.sentence || '').replace(/\s+/g, ' ').trim();
      const all = sentences();
      for (let i = 0; i < all.length; i++) {
        if (String(all[i]).replace(/\s+/g, ' ').trim() === text) return i;
      }
      return -1;
    };
    const words = () => state.card.word_bank || [];
    const contextQuestions = () => state.card.wordModule?.contextQuestions || [];
    const compQuestions = () => state.card.comprehension?.questions || [];
    const rebuildSteps = () => state.card.rebuild?.steps || [];
    const isDone = name => Boolean(typeof state.moduleStatus[name] === 'object' ? state.moduleStatus[name].completed : state.moduleStatus[name]);
    const scoreOf = name => Number(typeof state.moduleStatus[name] === 'object' ? state.moduleStatus[name].score || 0 : 0);
    const completedCount = () => modules.filter(([id,,,members=[id]]) => members.every(isDone)).length;

    function highlightSentence(text, index, translation) {
      const visible = Boolean(state.translationsVisible[index]);
      const words = String(text).split(/(\s+)/).map(part => {
        if (!part.trim()) return escapeHtml(part);
        const word = part.replace(/[^A-Za-z'-]/g, '').toLowerCase();
        return `<span class="lookup-word" data-word="${escapeHtml(word)}" data-sentence-index="${index}">${escapeHtml(part)}</span>`;
      }).join('');
      return `<span class="sentence-line"><span class="sentence-controls"><button type="button" class="sentence-speaker" data-sentence="${index}" aria-label="播放句子 ${index+1}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5-.5a1 1 0 0 0-1.4 1.4A4.97 4.97 0 0 1 15.5 12c0 .83-.2 1.6-.55 2.1a1 1 0 1 0 1.4 1.4A6.96 6.96 0 0 0 17.5 12c0-1.34-.38-2.58-1-3.5Zm2.8-2.3a1 1 0 0 0-1.4 1.4A7.97 7.97 0 0 0 18.5 12c0 1.67-.5 3.2-1.35 4.4a1 1 0 1 0 1.4 1.4A9.97 9.97 0 0 0 20.5 12c0-2.1-.65-4.05-1.8-5.8Z"/></svg></button></span><span class="sentence-content"><span class="sentence ${(state.previewIndex ?? state.current) === index ? 'current' : ''}" data-sentence-index="${index}">${words}</span><small class="sentence-translation ${visible?'':'is-hidden'}" aria-label="中文翻译">${escapeHtml(translation || '暂无中文翻译')}</small></span><span class="translation-row"><button type="button" class="translation-toggle" data-translation="${index}">${visible?'收起翻译':'翻译'}</button></span></span>`;
    }

    function sentenceTranslation(paragraph, sentence, sentenceIndex, globalIndex) {
      if (typeof paragraph === 'object') {
        const item = paragraph.sentences?.[sentenceIndex];
        if (item && typeof item === 'object') return item.translation || item.chinese || item.zh || '';
        return paragraph.translations?.[sentenceIndex] || '';
      }
      const translations = state.card.translations || state.card.paragraphTranslations;
      return translations?.[globalIndex] || ({
        'A flower starts as a tight bud.':'花朵从一个紧实的花蕾开始。',
        'Roots take in water from the soil.':'根从土壤中吸收水分。',
        'Warm sunlight helps the stem and petals grow.':'温暖的阳光帮助茎和花瓣生长。',
        'The petals slowly unfold and open.':'花瓣慢慢展开并开放。',
        'Now the bloom can catch light and welcome bees.':'现在花朵可以接收阳光并迎来蜜蜂。',
        'A cactus lives in a hot, dry desert.':'仙人掌生活在炎热干燥的沙漠中。',
        'Its thick stem stores water for a long time.':'它粗厚的茎能长时间储存水分。',
        'A waxy skin keeps water from escaping.':'蜡质表皮防止水分流失。',
        'Tiny spines protect the plant from hungry animals.':'细小的刺保护植物免受饥饿动物的伤害。',
        'These features help the cactus survive with very little rain.':'这些特征帮助仙人掌在少雨的环境中生存。'
      })[sentence] || '';
    }

    function renderNav() {
      $('#moduleNav').innerHTML = modules.map(([id,en,zh,members=[id]],idx) => {
        const unlocked = modules.slice(0,idx).every(entry => (entry[3] || [entry[0]]).every(isDone));
        const done = members.every(isDone);
        const active = members.includes(state.active);
        return `<button type="button" class="module-tab ${active?'active':''} ${done?'done':''} ${unlocked?'':'locked'}" data-open="${id}" ${unlocked?'':'disabled'} aria-selected="${active}"><span></span>${en}</button>`;
      }).join('');
      $$('[data-open]').forEach(button => button.onclick = () => openModule(button.dataset.open));
      const done = completedCount();
      $('#progressLabel').textContent = `${done} / 5 模块完成`;
      $('#topProgress').style.width = `${Math.round(done/5*100)}%`;
    }

    function openModule(name, save = true) {
      if (name === 'listening') name = 'reading';
      state.active = name;
      $$('.module').forEach(node => node.classList.toggle('active', node.dataset.module === name));
      renderNav();
      if (name === 'result') renderResult();
      if (save) saveProgress();
      window.scrollTo({top:0,behavior:'smooth'});
    }

    function closeLookup(){
      const pop=document.querySelector('.lookup-pop');
      if(pop)pop.remove();
      window.removeEventListener('scroll',closeLookup);
    }
    function showLookup(el,html){
      closeLookup();
      const pop=document.createElement('div');
      pop.className='lookup-pop';
      pop.innerHTML=html;
      document.body.appendChild(pop);
      const r=el.getBoundingClientRect();
      pop.style.left=Math.max(8,Math.min(r.left,window.innerWidth-260))+'px';
      pop.style.top=(r.bottom+6)+'px';
      window.addEventListener('scroll',closeLookup,{once:true});
      setTimeout(()=>{document.addEventListener('click',closeLookup,{once:true});},0);
      return pop;
    }
    async function lookupWord(word,el){
      if(!word)return;
      const card=state.card;
      const params=new URLSearchParams({word});
      if(card){params.set('courseId',String(card.courseId||card.cardId||''));const sIndex=Number(el.dataset.sentenceIndex||-1);if(sIndex>=0){const s=sentences()[sIndex];if(s)params.set('sentence',s);}}
      const pop=showLookup(el,'<span class="lookup-loading">正在查词…</span>');
      try{
        const res=await fetch(`/api/dictionary?${params}`);
        const data=res.ok?await res.json():{};
        const bank=(card?.word_bank||[]).find(b=>{
          const forms=[b.english,b.paragraph_form].filter(Boolean).map(v=>String(v).toLowerCase());
          return forms.includes(word)||forms.includes(word.replace(/s$/,''));
        });
        const meaning=data.meaning||(bank&&bank.chinese)||'';
        const phonetic=data.phonetic||data.accents?.[0]?.phonetic||'';
        const category=data.category||'';
        pop.innerHTML=`<strong>${escapeHtml(word)}</strong>${phonetic?`<em>${escapeHtml(phonetic)}</em>`:''}${category?`<span class="lookup-tag">${escapeHtml(category)}</span>`:''}${meaning?`<p>${escapeHtml(meaning)}</p>`:'<p class="muted">暂无释义</p>'}`;
      }catch{
        pop.innerHTML=`<strong>${escapeHtml(word)}</strong><p class="muted">查词失败，请稍后再试</p>`;
      }
    }
    function renderReading() {
      let cursor = 0;
      const translationTexts = {};
      const paragraphs = (state.card.paragraphs || []).map(paragraph => {
        const ss = typeof paragraph === 'string' ? (paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph]) : (paragraph.sentences || []).map(s => s.text || s);
        const html = ss.map((text, sentenceIndex) => { const index = cursor++; const translation = sentenceTranslation(paragraph, text, sentenceIndex, index); translationTexts[index] = translation || ''; return `<span class="reading-sentence">${highlightSentence(text, index, translation)}</span>`; }).join('');
        return `<p>${html}</p>`;
      }).join('');
      const image = state.card.image_file || state.card.image || 'day001-flower.png';
      const imageSrc = /^(?:https?:|data:|\/)/i.test(image) ? image : `/${image}`;
      $('#readingModule').innerHTML = `<div class="panel lesson-card"><div class="lesson-card-image"><img class="cover" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(state.card.title)} 科普阅读卡片" draggable="false"></div><div class="article-copy"><div class="article-head"><h2 class="section-title task-title"><span class="task-tag">Task 1</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Listen</span></h2><p class="muted">点击"▶"播放，听音跟读</p></div><section class="combined-listening" id="listenReadSection"></section><div style="margin:18px 0">${paragraphs}</div></div><div class="full-translate"><button class="btn" data-full-translate type="button">${state.fullTranslateOpen?'收起全文翻译':'全文翻译'}</button><div class="full-translate-panel" data-full-translate-panel ${state.fullTranslateOpen?'':'hidden'}><p class="ft-zh">${escapeHtml(sentences().map((s,i)=>translationTexts[i]||'').filter(Boolean).join('')||'暂无中文翻译')}</p></div></div></div><section class="practice-section" id="practiceSection"></section>${moduleCompleteBox('reading')}`;
      $$('.sentence-speaker').forEach(node => { node.onclick = () => playSingleSentence(Number(node.dataset.sentence)); });
      $$('.lookup-word').forEach(node => { node.onclick = e => { e.stopPropagation(); lookupWord(node.dataset.word, node); }; });
      $$('[data-translation]').forEach(node => { node.onclick = () => { const index = Number(node.dataset.translation); state.translationsVisible[index] = !state.translationsVisible[index]; renderReading(); }; });
      const ftBtn=document.querySelector('[data-full-translate]');if(ftBtn)ftBtn.onclick=()=>{state.fullTranslateOpen=!state.fullTranslateOpen;renderReading();};
      renderListenBar();
      renderListeningPractice();
      bindNext();
    }

    function playSingleSentence(index) {
      const text = sentences()[index];
      if (!text) return;
      if (audioEnabled()) { playAudioSentence(index); return; }
      if (state.playing) pausePlayback();   // 全文朗读在播：先停在当前位置
      speechSynthesis.cancel();
      const token = ++state.speechToken;
      state.playing = false;
      state.singlePlaying = true;
      state.previewIndex = index;           // 仅试听，进度条不动
      renderReading();
      speak(text, state.rate, () => {
        if (token !== state.speechToken) return;
        state.singlePlaying = false;
        state.previewIndex = null;
        renderReading();
      });
    }

    let playbackOnfinish = null;
    function startPlayback(startIndex) {
      speechSynthesis.cancel();
      const token = ++state.speechToken;
      state.singlePlaying = false;
      state.playing = true;
      state.previewIndex = null;
      let i = startIndex;
      const total = sentences().length;
      const next=()=>{ if(token!==state.speechToken)return; if(!state.playing||i>=total){state.playing=false;state.current=-1;state.playbackProgress=100;state.resumePosition=null;renderReading();const done=playbackOnfinish;playbackOnfinish=null;done?.();return;} state.current=i; state.playbackProgress=Math.round((i/Math.max(total,1))*100); renderReading(); const sentenceIndex=i++; speak(sentences()[sentenceIndex],state.rate,()=>{if(token===state.speechToken)setTimeout(()=>{if(token===state.speechToken)next();},600);},event=>{if(token!==state.speechToken||event.name!=='word')return;const ratio=(event.charIndex||0)/Math.max(sentences()[sentenceIndex].length,1);state.playbackProgress=Math.min(99,Math.round(((sentenceIndex+ratio)/Math.max(total,1))*100));const seek=$('#playbackSeek');if(seek){seek.value=Math.round(state.playbackProgress*10);seek.style.setProperty('--seek-fill',`${state.playbackProgress}%`);}const meta=$('.playback-meta span:last-child');if(meta)meta.textContent=`${state.playbackProgress}%`;}); };
      next();
    }
    function pausePlayback() {
      ++state.speechToken;
      speechSynthesis.cancel();
      state.playing = false;
      state.singlePlaying = false;
      state.previewIndex = null;
      playbackOnfinish = null;
      if (state.current >= 0) {
        state.resumePosition = (state.current / Math.max(sentences().length, 1)) * 100;
        state.playbackProgress = Math.round(state.resumePosition);
      }
      renderReading();
    }
    function playAll(onfinish) {
      if (state.playing) { if (audioEnabled()) pauseAudioPlayback(); else pausePlayback(); return; }
      playbackOnfinish = onfinish || null;
      const total = sentences().length;
      const done = state.playbackProgress >= 100;
      const position = done ? 0 : ((state.resumePosition ?? state.playbackProgress) / 100) * total;
      const start = Math.min(total - 1, Math.floor(position));
      const fraction = done ? 0 : position - start;
      state.resumePosition = null;
      if (audioEnabled()) startAudioPlayback(start, fraction);
      else startPlayback(start);
    }
    function seekTo(ratio) {
      const total = sentences().length; if (!total) return;
      const position = Math.max(0, Math.min(1, ratio)) * total;
      const index = Math.min(total - 1, Math.floor(position));
      const wasPlaying = state.dragWasPlaying;
      state.dragWasPlaying = false;
      if (wasPlaying) {
        startPlayback(index);
      } else {
        ++state.speechToken;
        speechSynthesis.cancel();
        state.playing = false;
        state.singlePlaying = false;
        state.current = index;
        state.resumePosition = Math.max(0, Math.min(1, ratio)) * 100;
        state.playbackProgress = Math.round(state.resumePosition);
        renderReading();
      }
    }
    function updatePlaybackUI(index, total, ratio) {
      $$('.sentence[data-sentence-index]').forEach(node => node.classList.toggle('current', Number(node.dataset.sentenceIndex) === index));
      const first = $('.playback-meta span:first-child'); if (first) first.textContent = index >= 0 ? `第 ${index + 1} / ${total} 句` : '准备播放';
      const last = $('.playback-meta span:last-child'); if (last) last.textContent = `${Math.round(ratio * 100)}%`;
      const seek = $('#playbackSeek'); if (seek) { seek.value = Math.round(ratio * 1000); seek.style.setProperty('--seek-fill', `${Math.round(ratio * 100)}%`); }
    }
    let audioManifest = null;
    let currentAudio = null;
    const audioPool = {};
    const audioEnabled = () => audioManifest && Array.isArray(audioManifest.sentences) && audioManifest.sentences.length === sentences().length;
    const audioFileFor = index => (audioManifest?.sentences?.[index]?.file) || `${String(index + 1).padStart(2, '0')}.mp3`;
    const audioUrlFor = index => `/audio/${encodeURIComponent(slug)}/${audioFileFor(index)}`;
    const audioFor = index => {
      if (!audioPool[index]) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = audioUrlFor(index);
        audioPool[index] = audio;
      }
      return audioPool[index];
    };
    function stopAllAudio() {
      Object.values(audioPool).forEach(audio => { try { audio.pause(); } catch {} });
      currentAudio = null;
    }
    async function loadAudioManifest() {
      try {
        const res = await fetch(`/audio/${encodeURIComponent(slug)}/manifest.json`);
        if (!res.ok) return;
        audioManifest = await res.json();
      } catch { audioManifest = null; }
    }
    function updateAudioProgress(index, total, audio) {
      const duration = audio.duration || 0;
      const fraction = duration ? Math.min(1, audio.currentTime / duration) : 0;
      state.playbackProgress = Math.min(Math.round(((index + fraction) / total) * 100), 99);
      const seek = $('#playbackSeek');
      if (seek) { seek.value = Math.round(state.playbackProgress * 10); seek.style.setProperty('--seek-fill', `${state.playbackProgress}%`); }
      const last = $('.playback-meta span:last-child');
      if (last) last.textContent = `${state.playbackProgress}%`;
    }
    function startAudioPlayback(startIndex, fraction = 0) {
      stopAllAudio();
      const token = ++state.speechToken;
      state.singlePlaying = false;
      state.playing = true;
      state.previewIndex = null;
      const total = sentences().length;
      const playSequence = index => {
        if (token !== state.speechToken || !state.playing) return;
        if (index >= total) {
          state.playing = false;
          state.current = -1;
          state.playbackProgress = 100;
          state.resumePosition = null;
          renderReading();
          const done = playbackOnfinish; playbackOnfinish = null; done?.();
          return;
        }
        state.current = index;
        state.playbackProgress = (index === startIndex && fraction > 0)
          ? Math.round((index + fraction) / total * 100)
          : Math.round(index / total * 100);
        renderReading();
        const audio = audioFor(index);
        currentAudio = audio;
        audio.playbackRate = state.rate;
        audio.currentTime = 0;
        if (index === startIndex && fraction > 0) {
          const seekToFraction = () => { if (token === state.speechToken && audio.duration) audio.currentTime = Math.min(fraction * audio.duration, audio.duration - 0.05); };
          if (audio.readyState >= 1 && audio.duration) seekToFraction();
          else audio.onloadedmetadata = seekToFraction;
        }
        audio.ontimeupdate = () => { if (token === state.speechToken && state.playing) updateAudioProgress(index, total, audio); };
        audio.onended = () => { if (token !== state.speechToken || !state.playing) return; setTimeout(() => { if (token === state.speechToken && state.playing) playSequence(index + 1); }, 600); };
        audio.play().catch(() => { if (token === state.speechToken) playSequence(index + 1); });
      };
      playSequence(startIndex);
    }
    function playAudioSentence(index) {
      if (state.playing) pauseAudioPlayback();   // 全文朗读在播：先停在当前位置
      const token = ++state.speechToken;
      state.playing = false;
      state.singlePlaying = true;
      state.previewIndex = index;               // 仅试听，进度条不动
      renderReading();
      const audio = audioFor(index);
      currentAudio = audio;
      audio.playbackRate = state.rate;
      audio.currentTime = 0;
      audio.ontimeupdate = null;
      audio.onended = () => {
        if (token !== state.speechToken) return;
        state.singlePlaying = false;
        state.previewIndex = null;
        renderReading();
      };
      audio.play().catch(() => { state.singlePlaying = false; state.previewIndex = null; renderReading(); });
    }
    function pauseAudioPlayback() {
      const audio = currentAudio;
      const total = sentences().length;
      ++state.speechToken;
      if (audio && state.playing && total) {
        const duration = audio.duration || 0;
        const fraction = duration ? Math.min(1, audio.currentTime / duration) : 0;
        state.resumePosition = ((state.current + fraction) / total) * 100;
        state.playbackProgress = Math.round(state.resumePosition);
      }
      stopAllAudio();
      state.playing = false;
      state.singlePlaying = false;
      state.previewIndex = null;
      playbackOnfinish = null;
      renderReading();
    }
    function seekAudio(ratio) {
      const total = sentences().length; if (!total) return;
      const position = Math.max(0, Math.min(1, ratio)) * total;
      const index = Math.min(total - 1, Math.floor(position));
      const fraction = position - index;
      const wasPlaying = state.dragWasPlaying;
      state.dragWasPlaying = false;
      if (wasPlaying) {
        startAudioPlayback(index, fraction);
      } else {
        // 暂停状态下拖动：只移动位置，不自动播放
        ++state.speechToken;
        stopAllAudio();
        state.playing = false;
        state.singlePlaying = false;
        state.current = index;
        state.resumePosition = Math.max(0, Math.min(1, ratio)) * 100;
        state.playbackProgress = Math.round(state.resumePosition);
        renderReading();
      }
    }

    function renderListenBar() {
      const target=$('#listenReadSection');
      if(!target)return;
      const total=sentences().length; const progress=state.playing||state.playbackProgress>0?state.playbackProgress:0;
      const rate=Math.min(1.1,Math.max(0.6,state.rate)); const rateFill=((rate-0.6)/0.5)*100;
      const playbackStatus=state.previewIndex!=null?`试听 · 第 ${state.previewIndex+1} 句`:state.playing?`正在播放第 ${state.current+1} 句`:state.singlePlaying?`单句播放 · 第 ${state.current+1} 句`:state.playbackProgress>=100?'已读完':state.current>=0?`已暂停 · 第 ${state.current+1} 句`:'全文朗读';
      target.innerHTML=`<div class="listen-stage"><div class="player" aria-label="全文朗读播放控制"><button id="playAll" class="play-round" type="button" aria-label="${state.playing?'暂停全文朗读':(state.current>=0&&state.playbackProgress<100?'继续播放全文朗读':'播放全文朗读')}" title="${state.playing?'暂停':(state.current>=0&&state.playbackProgress<100?'继续播放':'播放全文朗读')}">${state.playing?'<svg class="pi pi-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>':'<svg class="pi pi-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'}</button><div class="player-main"><div class="player-top"><strong class="player-status">${playbackStatus}</strong><div class="speed-control"><label for="speedSlider">语速</label><input id="speedSlider" class="speed-slider" style="--speed-fill:${rateFill}%" type="range" min="0.6" max="1.1" step="0.1" value="${rate}" aria-label="调整朗读倍速"><span class="speed-value" id="speedValue">${rate.toFixed(1)}x</span></div></div><input id="playbackSeek" class="playback-seek" type="range" min="0" max="1000" step="1" value="${Math.round(progress*10)}" style="--seek-fill:${progress}%" aria-label="朗读进度，可拖动跳转"><div class="playback-meta"><span>${state.current>=0?`第 ${state.current+1} / ${total} 句`:'准备播放'}</span><span>${progress}%</span></div></div></div></div>`;
      $('#playAll').onclick=()=>playAll(()=>complete('reading',100,'全文朗读完成'));
      $('#speedSlider').oninput=event=>{state.rate=Number(event.target.value);event.target.style.setProperty('--speed-fill',`${((state.rate-0.6)/0.5)*100}%`);$('#speedValue').textContent=`${state.rate.toFixed(1)}x`;if(currentAudio)currentAudio.playbackRate=state.rate;};
      const seekBar=$('#playbackSeek');
      if(seekBar){
        seekBar.addEventListener('pointerdown',()=>{ state.dragWasPlaying = state.playing; });
        seekBar.addEventListener('keydown',()=>{ state.dragWasPlaying = state.playing; });
        seekBar.addEventListener('input',()=>{
          const ratio=Number(seekBar.value)/1000;
          const total=sentences().length; if(!total)return;
          const position=Math.max(0,Math.min(1,ratio))*total;
          const index=Math.min(total-1,Math.floor(position));
          const fraction=position-index;
          ++state.speechToken; speechSynthesis.cancel();
          state.singlePlaying=true; state.playing=false;
          state.current=index; state.playbackProgress=Math.round(ratio*100);
          if(audioEnabled()){
            stopAllAudio();
            const audio=audioFor(index);
            currentAudio=audio;
            audio.ontimeupdate=null; audio.onended=null;
            const startPreview=()=>{ audio.playbackRate=state.rate; audio.currentTime=0; if(audio.duration&&fraction>0)audio.currentTime=Math.min(fraction*audio.duration,audio.duration-0.05); audio.play().catch(()=>{}); };
            if(audio.readyState>=1)startPreview(); else audio.onloadedmetadata=startPreview;
          }else{
            speak(sentences()[index],state.rate);
          }
          updatePlaybackUI(index,total,ratio);
        });
        seekBar.addEventListener('change',()=>{
          const ratio=Number(seekBar.value)/1000;
          if(audioEnabled())seekAudio(ratio); else seekTo(ratio);
        });
      }
    }

    function scoreFeedbackHtml(result){
      const praise=result.overall>=85?'发音很标准，太棒了！':result.overall>=70?'大部分词都读对了，继续加油！':'别灰心，多听几遍示范再试一次！';
      const chips=result.words.map(w=>{
        const label=({ok:'读得好',low:'需改进',wrong:'读错',missing:'漏读'})[w.status]||'';
        const title=w.status==='wrong'?` title="读成了 ${escapeHtml(w.heard||'？')}"`:'';
        return `<span class="word-chip ${w.status}"${title}><i aria-hidden="true"></i>${escapeHtml(w.word)}<em>${label}</em></span>`;
      }).join('');
      return `<details class="ai-details" open><summary>AI 评价</summary><div class="ai-body"><div class="score-words">${chips}</div><p class="ai-note"><strong>${praise}</strong><span>${buildAdvice(result)}</span></p></div></details>`;
    }
    function buildAdvice(result){
      const okCount=result.words.filter(w=>w.status==='ok').length;
      const total=result.words.length;
      const items=[];
      for(const w of result.words){
        if(w.status==='wrong')items.push(`「${w.word}」可能读成了${w.heard?`「${w.heard}」`:'别的词'}`);
        else if(w.status==='low')items.push(`「${w.word}」发音可能还不够清楚`);
        else if(w.status==='missing')items.push(`「${w.word}」好像没有读出来`);
      }
      if(!items.length)return '每个词都读得很棒，继续保持！';
      const sentence=items.join('，');
      if(okCount===0)return `${sentence}。也可能只是识别没听清，跟着示范再读一遍试试吧！`;
      if(okCount/total>=0.6)return `${sentence}。其它词听起来都很棒！`;
      return `${sentence}。再听几遍示范，读慢一点可能会更清楚！`;
    }
    function confettiHtml(){
      const colors=['#f47b63','#f2b64a','#2f8b68','#3979d8','#c94d4d'];
      let bits='';
      for(let i=0;i<14;i++){
        bits+=`<i style="left:${(i*7+3)%95}%;background:${colors[i%colors.length]};animation-delay:${(i%4)*0.12}s"></i>`;
      }
      return `<span class="confetti" aria-hidden="true">${bits}</span>`;
    }
    function waveBars(){
      let out='';
      for(let k=1;k<=16;k++)out+=`<i data-pct="${Math.round(k/16*100)}"></i>`;
      return out;
    }
    function fmtTime(secs){
      const s=Math.max(0,Math.floor(secs||0));
      return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    }
    function scoreBand(score){return score>=85?'high':score>=70?'mid':'low';}
    function voiceBarHtml(i,isRecording){
      if(isRecording){
        const secs=state.recordingStartedAt?Math.floor((Date.now()-state.recordingStartedAt)/1000):0;
        return `<div class="voice-bar recording" data-voice-bar="${i}"><span class="rec-dot" aria-hidden="true"></span><div class="voice-wave playing" aria-hidden="true">${waveBars()}</div><b class="rec-timer" data-rec-timer>${fmtTime(secs)}</b><span class="rec-label">录音中</span><span class="voice-stop">■ 停止</span></div>`;
      }
      if(!state.recordingUrls[i]&&!state.scores[i]){
        return `<div class="voice-bar empty" data-voice-bar="${i}" role="button" tabindex="0"><span class="voice-empty-text">0:00 / 0:00 · 点击开始录音哦~</span></div>`;
      }
      const score=state.scores[i]?state.scores[i].overall:null;
      const badge=score!=null?`<span class="voice-score ${scoreBand(score)}">${score}<i>分</i></span>`:'';
      const rerecord=`<button class="voice-rerecord" data-voice-rerecord="${i}" type="button">重录</button>`;
      return `<div class="voice-bar" data-voice-bar="${i}" role="button" tabindex="0"><button class="voice-play" data-voice-play="${i}" type="button" aria-label="播放">▶</button><div class="voice-wave" data-voice-wave="${i}" aria-hidden="true">${waveBars()}</div><span class="voice-time" data-voice-time="${i}">0:00 / 0:00</span>${rerecord}${badge}<audio data-record-audio="${i}" hidden preload="auto"></audio></div>`;
    }
    function toggleRecordPlay(i){
      const audio=document.querySelector(`[data-record-audio="${i}"]`);
      if(!audio||!state.recordingUrls[i])return;
      if(audio.src!==state.recordingUrls[i])audio.src=state.recordingUrls[i];
      if(audio.paused){audio.play().catch(()=>{});}else{audio.pause();}
    }
    function updateVoiceWave(i,audio,reset){
      const wave=document.querySelector(`[data-voice-wave="${i}"]`);
      const time=document.querySelector(`[data-voice-time="${i}"]`);
      const dur=audio.duration||0;
      const cur=reset?0:audio.currentTime||0;
      const pct=dur?Math.min(1,cur/dur):0;
      if(wave){
        wave.querySelectorAll('i').forEach(bar=>{
          bar.classList.toggle('played',Number(bar.dataset.pct)<=pct*100);
        });
      }
      if(time)time.textContent=`${fmtTime(cur)} / ${fmtTime(dur)}`;
    }
    function saveRecordingState(){
      try{
        if(!state.card)return;
        const data={};
        practiceSentences().forEach((_,i)=>{
          const audio=state.recordingDataUrls[i]||null;
          if(state.scores[i]||audio)data[i]={score:state.scores[i]||null,audio};
        });
        localStorage.setItem('fsr:rec:'+state.card.cardId,JSON.stringify(data));
      }catch{}
    }
    function loadRecordingState(){
      try{
        if(!state.card)return;
        const raw=localStorage.getItem('fsr:rec:'+state.card.cardId);
        if(!raw)return;
        const data=JSON.parse(raw);
        for(const k in data){
          const i=Number(k);
          if(data[i].audio){state.recordingUrls[i]=data[i].audio;state.recordingDataUrls[i]=data[i].audio;}
          if(data[i].score){state.scores[i]=data[i].score;state.scoring[i]=false;}
          if(data[i].score&&!state.submittedPractice.includes(i))state.submittedPractice.push(i);
        }
      }catch{}
    }
    function animateScoreRings(){
      $$('.score-ring[data-score]').forEach(el=>{
        const target=Number(el.dataset.score)||0;
        const num=el.querySelector('b');
        const start=performance.now();
        const dur=900;
        const step=now=>{
          const t=Math.min(1,(now-start)/dur);
          const val=Math.round(target*(1-Math.pow(1-t,3)));
          el.style.setProperty('--score',String(val));
          if(num)num.textContent=String(val);
          if(t<1)requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }
    function renderListeningPractice() {
      const practice=practiceSentences();
      const target=$('#practiceSection');
      if(!target)return;
      const completedCount=state.submittedPractice.length;
      target.innerHTML=`<div class="panel practice-shell"><div class="practice-intro"><div><h2 class="section-title task-title"><span class="task-tag">Task 2</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Read</span></h2><p class="muted">点击“听示范”熟悉语音，再开始录音。</p></div><span class="badge ${isDone('listening')?'success':''}">${isDone('listening')?'已完成':`${completedCount} / ${practice.length} 已提交`}</span></div><div class="practice-card-list">${practice.map((item,i)=>{const isRecording=Boolean(state.recording)&&state.recordingIndex===i;const isSubmitted=state.submittedPractice.includes(i)||isDone('listening');return `<article class="record-box ${isRecording?'recording':''} ${isSubmitted?'complete':''}"><div class="practice-card-number">第 ${i+1} / ${practice.length} 句${isSubmitted?' · 已评分':''}</div><div class="practice-sentence-row"><blockquote>${escapeHtml(item.sentence)}</blockquote><button class="btn demo" data-demo-sentence="${i}" type="button">听示范</button></div>${voiceBarHtml(i,isRecording)}${state.unrecognized[i]?`<p class="ai-note unrecognized">好像没有听清你的声音，请点击「重录」再试一次。</p>`:''}${state.scoring[i]?`<div class="score-result loading">正在评分…</div>`:''}${state.scores[i]?scoreFeedbackHtml(state.scores[i]):''}</article>`;}).join('')}</div></div>`;
      $$('[data-demo-sentence]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.demoSentence);state.practiceCurrent=index;const item=practice[index];if(audioEnabled()){const demoIndex=practiceDemoIndex(item);if(demoIndex>=0){if(state.playing)pauseAudioPlayback();else if(state.singlePlaying){++state.speechToken;state.singlePlaying=false;state.previewIndex=null;stopAllAudio();renderReading();}const audio=audioFor(demoIndex);currentAudio=audio;audio.currentTime=0;audio.playbackRate=state.rate;audio.ontimeupdate=null;audio.onended=null;audio.play().catch(()=>{});return;}}speak(practice[index].sentence,state.rate);});
      $$('[data-voice-rerecord]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();toggleRecording(Number(btn.dataset.voiceRerecord));});
      $$('[data-voice-bar]').forEach(el=>{
        const index=Number(el.dataset.voiceBar);
        const act=()=>{
          if(state.recording&&state.recordingIndex===index){toggleRecording(index);return;}
          if(!state.recordingUrls[index]&&!state.scores[index]){toggleRecording(index);return;}
          toggleRecordPlay(index);
        };
        el.onclick=act;
        el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}};
      });
      $$('[data-voice-play]').forEach(btn=>btn.onclick=e=>{e.stopPropagation();toggleRecordPlay(Number(btn.dataset.voicePlay));});
      $$('[data-record-audio]').forEach(audio=>{
        const index=Number(audio.dataset.recordAudio);
        audio.src=state.recordingUrls[index]||'';
        audio.ontimeupdate=()=>updateVoiceWave(index,audio);
        audio.onloadedmetadata=()=>updateVoiceWave(index,audio,true);
        audio.onplay=()=>{const b=document.querySelector(`[data-voice-play="${index}"]`);if(b)b.textContent='⏸';document.querySelector(`[data-voice-wave="${index}"]`)?.classList.add('playing');};
        audio.onpause=()=>{const b=document.querySelector(`[data-voice-play="${index}"]`);if(b)b.textContent='▶';document.querySelector(`[data-voice-wave="${index}"]`)?.classList.remove('playing');};
        audio.onended=()=>{const b=document.querySelector(`[data-voice-play="${index}"]`);if(b)b.textContent='▶';updateVoiceWave(index,audio,true);document.querySelector(`[data-voice-wave="${index}"]`)?.classList.remove('playing');};
      });
    }

    async function toggleRecording(index){
      if(state.recording){if(state.recordingIndex===index)state.recording.stop();return;}
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('当前浏览器不支持录音，可通过全文朗读完成本模块');return;}
      try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const chunks=[];const recorder=new MediaRecorder(stream);state.recording=recorder;state.recordingIndex=index;state.recordingStartedAt=Date.now();state.recordingTimer=setInterval(()=>{$$('[data-rec-timer]').forEach(el=>{el.textContent=fmtTime((Date.now()-state.recordingStartedAt)/1000);});},250);recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>{clearInterval(state.recordingTimer);state.recordingTimer=null;state.recordingStartedAt=null;stream.getTracks().forEach(track=>track.stop());const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});if(state.recordingUrls[index])URL.revokeObjectURL(state.recordingUrls[index]);state.recordingUrls[index]=URL.createObjectURL(blob);state.recordingBlobs[index]=blob;delete state.scores[index];delete state.scoring[index];delete state.unrecognized[index];state.submittedPractice=state.submittedPractice.filter(x=>x!==index);state.recording=null;state.recordingIndex=-1;const reader=new FileReader();reader.onload=()=>{state.recordingDataUrls[index]=reader.result;saveRecordingState();};reader.readAsDataURL(blob);renderListeningPractice();saveRecordingState();const pItem=practiceSentences()[index];submitRecording(typeof pItem==='string'?pItem:(pItem&&pItem.sentence)||'',index,practiceSentences().length);};recorder.start();renderListeningPractice();}catch{state.recordingIndex=-1;toast('没有获得麦克风权限，请在浏览器设置中允许录音');}
    }
    async function submitRecording(sentence,index,total){try{const blob=state.recordingBlobs[index];if(!blob)return;state.scoring[index]=true;state.scores[index]=null;renderListeningPractice();const form=new FormData();form.append('audio',blob,`rec-${index}.webm`);form.append('text',sentence);const res=await fetch(SCORE_ENDPOINT,{method:'POST',body:form});if(!res.ok)throw new Error('评分服务暂时不可用，请稍后再试');const result=await res.json();state.scoring[index]=false;if(result.recognized===false){state.scores[index]=null;state.unrecognized[index]=true;}else{state.scores[index]=result;state.unrecognized[index]=false;if(!state.submittedPractice.includes(index))state.submittedPractice.push(index);if(state.submittedPractice.length===total)complete('listening',100,'全部跟读录音已评分');}renderListeningPractice();saveProgress();saveRecordingState();}catch(error){state.scoring[index]=false;renderListeningPractice();toast(error.message);}}

    function shuffled(items){const result=[...items];for(let index=result.length-1;index>0;index--){const swap=Math.floor(Math.random()*(index+1));[result[index],result[swap]]=[result[swap],result[index]];}return result;}
    function wordTileWords(){return words().slice(0,6).map((word,index)=>({index:String(index),word,english:String(word.english||word.word||''),meaning:String(word.chinese||word.meaning||'')}));}
    function ensureWordTileOrder(items){const expected=items.flatMap(item=>[`${item.index}:word`,`${item.index}:image`]);if(state.wordTileOrder.length!==expected.length||state.wordTileOrder.some(id=>!expected.includes(id))){if(!state.wordTileMatched.length){clearTimeout(state.wordTileTimer);state.wordTileSequence+=1;state.wordTileCombo=0;state.wordTileCelebration=null;state.wordTileLocked=false;}state.wordTileOrder=shuffled(expected);}}
    function wordTileImageSource(word){const value=word.image_file||word.image||word.illustration||'';return value?(/^(?:https?:|data:|\/)/i.test(value)?value:`/${value}`):'';}
    function wordTileIllustration(item){
      const image=wordTileImageSource(item.word);
      if(image)return `<span class="word-tile-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(item.meaning||item.english)}"></span><span class="word-tile-caption">图片卡</span>`;
      const key=item.english.toLowerCase();
      const illustrations={
        bud:['花蕾','<path d="M32 54V35"/><path d="M32 37c-10-5-13-15-7-22 5 1 8 4 9 9 2-5 5-8 10-9 6 8 2 17-8 22"/><path d="M32 45c-7 0-12 4-14 9"/>'],
        roots:['根','<path d="M32 10v19"/><path d="M18 25c7 3 21 3 28 0"/><path d="M32 29v25"/><path d="M32 38 22 49"/><path d="M32 42 43 54"/><path d="m26 45-7 9"/><path d="m39 47 5 7"/>'],
        soil:['土壤','<path d="M10 22c8-5 15 5 23 0s15 5 21 0"/><path d="M9 31h46"/><path d="M12 41h40"/><path d="M16 50h32"/><circle cx="20" cy="36" r="1.5"/><circle cx="42" cy="45" r="1.5"/>'],
        sunlight:['阳光','<circle cx="32" cy="32" r="11"/><path d="M32 8v9M32 47v9M8 32h9M47 32h9M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6"/>'],
        petals:['花瓣','<circle cx="32" cy="32" r="5"/><path d="M32 27c-8-5-8-15 0-19 8 4 8 14 0 19ZM37 31c3-9 13-11 19-4-2 9-11 12-19 4ZM35 36c9 1 13 11 7 18-9 0-14-9-7-18ZM29 36c6 7 1 17-8 18-6-7-2-17 8-18ZM27 31c-8 8-17 4-19-4 6-7 16-5 19 4Z"/>'],
        unfold:['展开','<path d="M32 52V33"/><path d="M32 36c-12 0-19-8-18-18 10-1 18 5 18 18ZM32 36c12 0 19-8 18-18-10-1-18 5-18 18Z"/><path d="M32 30c-5-8-4-16 0-22 5 6 5 14 0 22Z"/>']
      };
      const [label,drawing]=illustrations[key]||['图片占位','<rect x="11" y="13" width="42" height="38" rx="6"/><circle cx="24" cy="26" r="4"/><path d="m16 44 11-10 8 7 6-5 7 8"/>'];
      const caption=illustrations[key]?label:(item.meaning||item.english);
      return `<span class="word-tile-image"><svg viewBox="0 0 64 64" aria-hidden="true">${drawing}</svg></span><span class="word-tile-caption">${escapeHtml(caption)}</span>`;
    }
    function wordTileIsClearing(){return state.wordTileFeedback.some(value=>value.startsWith('clear:'));}
    function wordTileStatus(items){if(!items.length)return '暂无可配对的核心词';if(state.wordTileMatched.length===items.length)return '挑战完成！六组核心词全部解锁';if(wordTileIsClearing())return '匹配成功，正在消除这组卡片';if(state.wordTileFeedback.length)return '差一点，这两张不是搭档，再看仔细些';if(state.wordTileSelected)return '已经锁定一张，现在找出它的搭档';return '先选一张卡，再找出对应的单词或图片';}
    function wordTileStatusIcon(complete){if(complete||wordTileIsClearing())return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9"/></svg>';if(state.wordTileFeedback.length)return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>';return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4"/></svg>';}
    function playWordTileSound(kind){
      try{
        const AudioContextClass=window.AudioContext||window.webkitAudioContext;
        if(!AudioContextClass)return;
        wordTileAudioContext??=new AudioContextClass();
        if(wordTileAudioContext.state==='suspended')wordTileAudioContext.resume().catch(()=>{});
        const now=wordTileAudioContext.currentTime+.01;
        const tone=(frequency,delay,duration,endFrequency=frequency,type='sine',volume=.055)=>{const oscillator=wordTileAudioContext.createOscillator();const gain=wordTileAudioContext.createGain();const start=now+delay;oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency,1),start+duration);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain).connect(wordTileAudioContext.destination);oscillator.start(start);oscillator.stop(start+duration+.02);};
        if(kind==='match'){tone(740,0,.09,1040,'sine',.06);tone(1120,.065,.085,1320,'sine',.045);}
        if(kind==='eliminated')tone(460,0,.1,150,'triangle',.065);
        if(kind==='combo'){tone(660,0,.12,720,'triangle',.05);tone(880,.09,.12,960,'triangle',.055);tone(1175,.18,.16,1320,'sine',.06);}
      }catch{}
    }
    function wordTileCelebrationHtml(){const feedback=state.wordTileCelebration;if(!feedback)return '';const combo=feedback.combo||1;const messages={match:[combo>1?`Match x${combo}!`:'Match!','匹配正确'],eliminated:['Eliminated!','消除成功'],continue:['Continue!','继续'],combo:[`Combo ×${combo}!`,'Level up! · 连击升级']};const [title,subtitle]=messages[feedback.stage]||messages.continue;return `<div class="word-match-burst ${feedback.stage}" role="status" aria-live="assertive"><strong>${title}</strong><span>${subtitle}</span></div>`;}
    function renderWordTileGame(items){
      ensureWordTileOrder(items);
      const cards=state.wordTileOrder.map(id=>{const [pair,kind]=id.split(':');const item=items.find(entry=>entry.index===pair);if(!item)return '';if(state.wordTileMatched.includes(pair))return `<span class="word-tile removed" aria-hidden="true"><small>${escapeHtml(item.meaning)}</small></span>`;const selected=state.wordTileSelected===id;const feedback=state.wordTileFeedback.includes(id);const clearing=state.wordTileFeedback.includes(`clear:${id}`);const label=kind==='word'?`单词卡：${item.english}`:`图片卡：${item.meaning||item.english}`;return `<button type="button" class="word-tile ${kind} ${selected?'selected':''} ${feedback?'mismatch':''} ${clearing?'clearing':''}" data-word-tile="${id}" aria-pressed="${selected}" aria-label="${escapeHtml(label)}" ${state.wordTileLocked?'disabled':''}><span class="word-tile-kind">${kind==='word'?'WORD':'PICTURE'}</span>${kind==='word'?`<strong>${escapeHtml(item.english)}</strong>`:wordTileIllustration(item)}${selected?'<span class="word-tile-pick" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m4 10 4 4 8-9"/></svg></span>':''}</button>`;}).join('');
      const complete=items.length>0&&state.wordTileMatched.length===items.length;
      const progress=items.map((_,index)=>`<span class="${index<state.wordTileMatched.length?'done':''}"></span>`).join('');
      return `<section class="subsection word-tile-game" aria-labelledby="wordTileTitle"><div class="word-game-shell ${complete?'complete':''}">${wordTileCelebrationHtml()}<div class="word-game-hud"><div class="word-game-title"><span class="word-game-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="8" height="8" rx="2"/><rect x="13" y="11" width="8" height="8" rx="2"/><path d="m8 17 3 3 5-6"/></svg></span><div><h2 id="wordTileTitle">Word Match</h2><p>一词一图，找出 ${items.length} 组科学搭档</p></div></div><div class="word-game-score"><strong>${state.wordTileMatched.length} / ${items.length}</strong><span>MATCHED</span></div></div><div class="word-game-progress" style="grid-template-columns:repeat(${Math.max(items.length,1)},1fr)" aria-hidden="true">${progress}</div><div class="word-tile-board" role="group" aria-label="单词与图片配对棋盘，共 ${items.length*2} 张卡">${cards}</div><div class="word-tile-status" aria-live="polite"><div class="word-tile-status-copy"><span class="word-tile-status-icon">${wordTileStatusIcon(complete)}</span><p class="${complete?'success-copy':''}">${wordTileStatus(items)}</p></div><button class="word-game-reset" id="resetWordTiles" type="button">重新洗牌</button></div></div></section>`;
    }
    function handleWordTile(id){
      if(state.wordTileLocked)return;
      if(state.wordTileCelebration){state.wordTileSequence+=1;clearTimeout(state.wordTileTimer);state.wordTileCelebration=null;}
      const [pair,kind]=id.split(':');
      if(state.wordTileMatched.includes(pair))return;
      if(state.wordTileSelected===id){state.wordTileSelected=null;renderWords();return;}
      if(!state.wordTileSelected){state.wordTileSelected=id;renderWords();return;}
      const first=state.wordTileSelected;
      const [firstPair,firstKind]=first.split(':');
      state.wordTileLocked=true;
      clearTimeout(state.wordTileTimer);
      if(firstPair===pair&&firstKind!==kind){
        const combo=state.wordTileCombo+1;
        const sequence=++state.wordTileSequence;
        state.wordTileCombo=combo;
        state.wordTileFeedback=[`clear:${first}`,`clear:${id}`];
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
      }else{
        state.wordTileSequence+=1;
        state.wordTileCombo=0;
        state.wordTileCelebration=null;
        state.wordTileFeedback=[first,id];
        renderWords();
        state.wordTileTimer=setTimeout(()=>{state.wordTileSelected=null;state.wordTileFeedback=[];state.wordTileLocked=false;renderWords();},650);
      }
    }
    function resetWordTiles(){clearTimeout(state.wordTileTimer);state.wordTileSequence+=1;state.wordTileOrder=[];state.wordTileSelected=null;state.wordTileMatched=[];state.wordTileFeedback=[];state.wordTileLocked=false;state.wordTileCombo=0;state.wordTileCelebration=null;state.moduleStatus.words={completed:false,score:0};renderWords();saveProgress();}
    function contextPracticeIsCorrect(){const qs=contextQuestions();return !qs.length||(state.contextChecked&&!state.contextWrong.length&&qs.every((q,index)=>state.context[index]===contextAnswer(q)));}
    function completeWordsIfReady(){const pairs=state.card.wordModule?.matchPairs||words();const tiles=wordTileWords();if(state.matched.length===pairs.length&&state.wordTileMatched.length===tiles.length&&contextPracticeIsCorrect()){complete('words',100,'词汇练习全部正确！');return true;}return false;}

    function renderWords(){
      const pairs=state.card.wordModule?.matchPairs||words().map(word=>({word:word.english,meaning:word.chinese||word.meaning}));
      const tileWords=wordTileWords();

      const meanings=[...pairs].sort((a,b)=>a.meaning.localeCompare(b.meaning));
      const bankSlots=Array.from({length:6},(_,index)=>words()[index]||null);
      const toneFor=word=>(state.matched.includes(word)?state.matched.indexOf(word):state.matched.length)%6;
      const matchBoard=`<div class="match-board"><div class="match-column">${pairs.map(pair=>{const done=state.matched.includes(pair.word);return `<button type="button" class="match-choice ${state.selectedWord===pair.word?'selected':''} ${done?'matched':''}" data-tone="${toneFor(pair.word)}" data-match-word="${escapeHtml(pair.word)}" ${done?'disabled':''}>${escapeHtml(pair.word)}</button>`;}).join('')}</div><div class="match-column">${meanings.map(pair=>{const done=state.matched.includes(pair.word);return `<button type="button" class="match-choice ${state.selectedMeaning===pair.meaning?'selected':''} ${done?'matched':''}" data-tone="${toneFor(pair.word)}" data-match-meaning="${escapeHtml(pair.meaning)}" data-match-answer="${escapeHtml(pair.word)}" ${done?'disabled':''}>${escapeHtml(pair.meaning)}</button>`;}).join('')}</div></div>`;

      $('#wordsModule').innerHTML=`<div class="panel practice-shell"><section aria-labelledby="wordBankTitle"><h2 class="section-title task-title" id="wordBankTitle"><span class="task-tag">Task 3</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Words</span></h2><p class="muted words-guide">${state.wordBankReviewed?'练习时点右上角「回看单词」可回到词卡复习。':'先记住这些单词，再开始配对练习。'}</p><div class="word-bank-box" id="wordBankBox" ${state.wordBankReviewed?'hidden':''}>${bankSlots.map(word=>word?`<article class="word-card"><span class="word-card-image" aria-hidden="true"></span><span class="word-card-copy"><strong>${escapeHtml(word.english||word.word||'')}</strong><small>${escapeHtml(word.chinese||word.meaning||'')}</small></span></article>`:'<span class="word-card empty" aria-hidden="true"></span>').join('')}</div><div class="btn-row word-bank-actions">${state.wordBankReviewed?'':`<button class="btn primary" id="toggleWordBank" type="button">开始配对 →</button>`}</div></section><div class="words-practice" id="wordsPractice" ${state.wordBankReviewed?'':'hidden'}><div class="practice-intro"><div><p class="eyebrow">Word Match</p><h2 class="section-title">把核心词和含义连起来</h2><p class="muted">先选左边的单词，再选右边的含义。正确配对会被锁定。</p></div><div class="intro-actions"><span class="badge ${state.matched.length===pairs.length?'success':''}">${state.matched.length} / ${pairs.length} 已配对</span>${state.wordBankReviewed?`<button class="link-btn" id="toggleWordBank" type="button">回看单词</button>`:''}</div></div>${matchBoard}<div class="btn-row" style="margin-top:12px"><button class="btn" id="resetMatch" type="button">重置配对</button></div>${renderWordTileGame(tileWords)}<section class="subsection" id="contextPractice"></section></div></div>${moduleCompleteBox('words')}`;
      $('#toggleWordBank').onclick=()=>{state.wordBankReviewed=!state.wordBankReviewed;renderWords();saveProgress();};
      $$('[data-match-word]').forEach(button=>button.onclick=()=>{state.selectedWord=button.dataset.matchWord;tryMatch();renderWords();});
      $$('[data-match-meaning]').forEach(button=>button.onclick=()=>{state.selectedMeaning=button.dataset.matchMeaning;state.selectedMeaningAnswer=button.dataset.matchAnswer;tryMatch();renderWords();});
      $('#resetMatch').onclick=()=>{state.matched=[];state.selectedWord=null;state.selectedMeaning=null;renderWords();saveProgress();};
      $$('[data-word-tile]').forEach(button=>button.onclick=()=>handleWordTile(button.dataset.wordTile));
      $('#resetWordTiles').onclick=resetWordTiles;
      renderContextPractice();
      bindNext();
    }
    function contextAnswer(q){const options=normalizeOptions(q);return options[q.answer]||q.answer;}
    function contextWordPool(){return [...new Set(contextQuestions().map(q=>String(contextAnswer(q))))];}
    function contextQuestionImage(q){const image=q.image_file||q.image||'';return image?(/^(?:https?:|data:|\/)/i.test(image)?image:`/${image}`):'';}
    function contextDropHtml(index){return `<span class="context-drop ${state.context[index]?'filled':''}" data-context-drop="${index}" role="button" tabindex="0" aria-label="第 ${index+1} 题填空">${state.context[index]?escapeHtml(state.context[index]):'________'}</span>`;}
    function contextSentenceText(q,index){const raw=String(q.sentence||q.prompt||q.text||'').trim();const drop=contextDropHtml(index);const escaped=escapeHtml(raw);if(/_{2,}|…{2,}|□/.test(raw))return escaped.replace(/_{2,}|…{2,}|□/,drop);const answer=escapeHtml(contextAnswer(q));if(answer){const tokenPattern=new RegExp(answer.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');if(tokenPattern.test(escaped))return escaped.replace(tokenPattern,drop);}const describes=raw.match(/^Which word describes (.+)\?$/i);if(describes)return `${escapeHtml(describes[1])} is ${drop}.`;const punctuation=raw.match(/^(.+?)([.!?])$/);if(punctuation)return `${escapeHtml(punctuation[1])} ${drop}${punctuation[2]}`;return `${escaped} ${drop}`;}
    function renderContextPractice(){
      const qs=contextQuestions();
      const pool=contextWordPool();
      Object.values(state.context).forEach(word=>{const index=pool.indexOf(String(word));if(index>=0)pool.splice(index,1);});
      const section=$('#contextPractice');
      if(!section)return;
      section.innerHTML=`<div class="context-practice"><div><p class="eyebrow">Word in context</p><h2 class="section-title">把词拖进句子里</h2><p class="muted">从上方备选词中拖动单词，放入对应句子的空格。</p></div><div class="context-word-bank" id="contextWordBank" aria-label="备选词">${pool.length?pool.map(word=>`<button type="button" class="context-word ${state.contextSelected===word?'selected':''} ${state.contextReturned.includes(word)?'returned':''}" draggable="true" data-context-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join(''):'<span class="muted">所有备选词都已放入句子。</span>'}</div><div class="context-sentences">${qs.map((q,i)=>{const image=contextQuestionImage(q);const wrong=state.contextWrong.includes(i);const correct=state.contextChecked&&!state.contextWrong.length&&state.context[i]===contextAnswer(q);return `<article class="context-sentence ${correct?'correct':''} ${wrong?'wrong':''}" data-context-sentence="${i}"><div class="context-sentence-copy">${contextSentenceText(q,i)}</div><div class="context-image-frame">${image?`<img src="${escapeHtml(image)}" alt="第 ${i+1} 题配图">`:'图片框'}</div></article>`;}).join('')}</div><div class="context-check-row"><button class="btn primary" id="checkContext" type="button">检查</button></div></div>`;
      bindContextPractice();
    }
    function bindContextPractice(){
      $$('[data-context-word]').forEach(word=>{word.addEventListener('dragstart',event=>{event.dataTransfer?.setData('text/plain',word.dataset.contextWord);state.contextSelected=word.dataset.contextWord;});word.onclick=()=>{state.contextSelected=state.contextSelected===word.dataset.contextWord?null:word.dataset.contextWord;renderContextPractice();};});
      $$('[data-context-drop]').forEach(drop=>{drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('drag-over');});drop.addEventListener('dragleave',()=>drop.classList.remove('drag-over'));drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('drag-over');const word=event.dataTransfer?.getData('text/plain')||state.contextSelected;if(word)fillContextDrop(Number(drop.dataset.contextDrop),word);});drop.onclick=()=>{const index=Number(drop.dataset.contextDrop);if(state.contextSelected)fillContextDrop(index,state.contextSelected);else if(state.context[index])returnContextWord(index);};drop.onkeydown=event=>{if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();const index=Number(drop.dataset.contextDrop);if(state.contextSelected)fillContextDrop(index,state.contextSelected);else if(state.context[index])returnContextWord(index);};});
      $('#checkContext').onclick=checkContext;
    }
    function fillContextDrop(index,word){const previous=state.context[index];if(previous===word)return;if(previous)state.contextReturned.push(previous);state.context[index]=word;state.contextSelected=null;state.contextChecked=false;state.contextWrong=[];state.contextReturned=[...new Set(state.contextReturned.filter(value=>value!==word))];renderContextPractice();state.contextReturned=[];saveProgress();}
    function returnContextWord(index){const word=state.context[index];if(!word)return;delete state.context[index];state.contextReturned=[word];state.contextChecked=false;renderContextPractice();state.contextReturned=[];saveProgress();}
    function checkContext(){const qs=contextQuestions();if(Object.keys(state.context).length<qs.length){toast('请先填完所有句子的空格');return;}const wrong=qs.map((q,i)=>state.context[i]===contextAnswer(q)?-1:i).filter(index=>index>=0);state.contextChecked=true;state.contextWrong=wrong;if(wrong.length){wrong.forEach(index=>{const word=state.context[index];if(word)state.contextReturned.push(word);delete state.context[index];});state.contextReturned=[...new Set(state.contextReturned)];renderContextPractice();state.contextReturned=[];clearTimeout(state.contextFeedbackTimer);state.contextFeedbackTimer=setTimeout(()=>{state.contextWrong=[];renderContextPractice();},2000);toast('有些词还不匹配，请再试一次');}else{renderContextPractice();if(!completeWordsIfReady())toast(state.matched.length<(state.card.wordModule?.matchPairs||words()).length?'语境题全部正确，请继续完成上方连线':'语境题全部正确，请继续完成图片配对');}saveProgress();}
    function closeEliminatePopup(){
      clearTimeout(state.eliminateTimer);
      const pop=document.querySelector('.eliminate-pop');
      if(pop)pop.remove();
    }
    function showEliminatePopup(meaning){
      closeEliminatePopup();
      const pop=document.createElement('div');
      pop.className='eliminate-pop';
      pop.innerHTML=`<strong>Eliminate</strong><span>${escapeHtml(meaning||'')}</span>`;
      document.body.appendChild(pop);
      state.eliminateTimer=setTimeout(closeEliminatePopup,900);
    }
    function tryMatch(){if(!state.selectedWord||!state.selectedMeaning)return;if(state.selectedWord===state.selectedMeaningAnswer){const matchedWord=state.selectedWord;state.matched.push(matchedWord);const pair=(state.card.wordModule?.matchPairs||words()).find(p=>p.word===matchedWord);const zh=(state.card.word_bank||[]).find(b=>String(b.english||'').toLowerCase()===matchedWord.toLowerCase())?.chinese||(pair&&(pair.chinese||pair.meaning))||'';showEliminatePopup(zh);setTimeout(completeWordsIfReady,0);}else toast('还不匹配，再想一想');state.selectedWord=null;state.selectedMeaning=null;state.selectedMeaningAnswer=null;saveProgress();}

    function normalizeOptions(q){return Array.isArray(q.options)?Object.fromEntries(q.options.map((value,i)=>[String.fromCharCode(65+i),value])):q.options||{};}
    function answerKey(q){if(['A','B','C'].includes(q.answer))return q.answer;return Object.entries(normalizeOptions(q)).find(([,value])=>value===q.answer)?.[0]||q.answer;}
    function renderQuestions(qs,answers,prefix,checked=false){return qs.map((q,i)=>{const correctKey=answerKey(q);return `<article class="question"><h3>${i+1}、${escapeHtml(q.prompt)}</h3><div class="options">${Object.entries(normalizeOptions(q)).map(([key,value])=>{const selected=answers[i]===key;const result=checked&&selected?(key===correctKey?'correct':'wrong'):checked&&key===correctKey?'correct':'';return `<button type="button" class="option ${selected?'selected':''} ${result}" data-answer-group="${prefix}" data-question="${i}" data-answer="${key}"><strong>${key}.</strong> ${escapeHtml(value)}</button>`;}).join('')}</div>${checked?`<div class="feedback">${answers[i]===correctKey?'✓ 回答正确':`需要复习，正确答案是 ${correctKey}`}</div>`:''}</article>`}).join('');}
    function bindQuestionOptions(prefix,answers,qs,rerender){$$(`[data-answer-group="${prefix}"]`).forEach(button=>button.onclick=()=>{answers[button.dataset.question]=button.dataset.answer;rerender();saveProgress();});}

    function renderComprehension(){const qs=compQuestions();$('#comprehensionModule').innerHTML=`<div class="panel practice-shell"><div class="practice-intro"><div><h2 class="section-title task-title"><span class="task-tag">Task 4</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Comprehension</span></h2></div><span class="badge">${Object.keys(state.comprehension).length} / 3 已作答</span></div>${renderQuestions(qs,state.comprehension,'comp',state.comprehensionChecked)}<div class="btn-row"><button class="btn primary" id="checkComp" type="button">${state.comprehensionChecked?'重新检查':'检查答案'}</button><button class="btn" id="retryComp" type="button">再试一次</button></div></div>${moduleCompleteBox('comprehension')}`;bindQuestionOptions('comp',state.comprehension,qs,()=>{state.comprehensionChecked=false;renderComprehension();});$('#checkComp').onclick=()=>{if(Object.keys(state.comprehension).length<qs.length){toast('请先回答全部三道题');return;}state.comprehensionChecked=true;const correct=qs.filter((q,i)=>state.comprehension[i]===answerKey(q)).length;complete('comprehension',Math.round(correct/qs.length*100),`阅读理解完成：${correct}/3 正确`);renderComprehension();};$('#retryComp').onclick=()=>{state.comprehension={};state.comprehensionChecked=false;state.moduleStatus.comprehension={completed:false,score:0};renderComprehension();saveProgress();};bindNext();}

    function rebuildKind(){const value=String(state.card.rebuild?.type||state.card.articleStructure||state.card.structure||'').toLowerCase().replace(/[–—]/g,'-').replace(/\s+/g,' ');if(value.includes('feature')&&value.includes('function'))return 'feature-function';if(value.includes('fact')&&value.includes('explanation'))return 'fact-explanation';if(value.includes('cause')&&value.includes('effect'))return 'cause-effect';if(value.includes('compare')&&value.includes('contrast'))return 'compare-contrast';return value==='life cycle'||(value.includes('cycle')&&!value.includes('process'))?'cycle':'process';}
    function rebuildPairLabels(kind){return { 'feature-function':['Features','Functions'], 'fact-explanation':['Facts / Features','Explanations'], 'cause-effect':['Causes','Effects'], 'compare-contrast':['Compare','Contrast'] }[kind]||['Left','Right'];}
    function splitRebuildStatement(step){const text=String(step||'').trim();const explicit=text.split(/\s*(?:→|->|\||::)\s*/);if(explicit.length>1)return [explicit[0],explicit.slice(1).join(' ')];const match=text.match(/^(.*?\b(?:stem|skin|spines?|roots?|feathers?|shell|muscles?|bristles?|leaves?|surface|cap|threads?|plant|cactus|moss|desert))\s+(.+)$/i);if(match)return [match[1],match[2]];const verb=text.match(/^(.+?)\s+(is|are|has|have|stores?|keeps?|protects?|collects?|slows?|gives?|blocks?|pulls?|pushes?|takes?|traps?|spreads?|turns?|helps?|survives?|grows?|forms?|makes?)\s+(.+)$/i);return verb?[verb[1],`${verb[2]} ${verb[3]}`]:[text,''];}
    function rebuildPairs(kind){const configured=state.card.rebuild?.pairs||state.card.rebuild?.rows||state.card.rebuild?.table;if(Array.isArray(configured)&&configured.length)return configured.map(row=>{if(Array.isArray(row))return [String(row[0]||''),String(row[1]||'')];if(typeof row==='string')return splitRebuildStatement(row);const left=row.left??row.feature??row.fact??row.cause??row.compare??row.itemA??row.first??'';const right=row.right??row.function??row.job??row.explanation??row.effect??row.contrast??row.itemB??row.second??'';return [String(left),String(right)];});const steps=rebuildSteps().map(String);const explicit=steps.map(splitRebuildStatement);if(explicit.every(pair=>pair[1]))return explicit;if(kind==='feature-function')return explicit.filter(pair=>pair[1]);if(kind==='cause-effect')return steps.slice(0,-1).map((step,index)=>[step,steps[index+1]]);const pairs=[];for(let i=0;i<steps.length;i+=2)pairs.push([steps[i]||'',steps[i+1]||'']);return pairs.filter(pair=>pair[0]&&pair[1]);}
    function rebuildOrderFromState(steps){const valid=Array.isArray(state.rebuild)&&state.rebuild.length===steps.length&&state.rebuild.every(index=>index===null||(Number.isInteger(index)&&index>=0&&index<steps.length))&&new Set(state.rebuild.filter(index=>index!==null)).size===state.rebuild.filter(index=>index!==null).length;return valid?[...state.rebuild]:Array(steps.length).fill(null);}
    function ensureRebuildBankOrder(steps){const expected=[...steps.keys()];const valid=state.rebuildBankOrder.length===expected.length&&state.rebuildBankOrder.every(index=>expected.includes(index))&&new Set(state.rebuildBankOrder).size===expected.length;if(valid)return;state.rebuildBankOrder=shuffled(expected);if(expected.length>1&&state.rebuildBankOrder.every((value,index)=>value===expected[index]))state.rebuildBankOrder.push(state.rebuildBankOrder.shift());}
    function rebuildDiagramHtml(steps,order,kind){return `<div class="rebuild-diagram ${kind}">${order.map((stepIndex,pos)=>`<div class="rebuild-slot ${stepIndex===null?'empty':''}" data-rebuild-slot="${pos}" data-position="${pos}" draggable="${stepIndex!==null}" tabindex="0" role="button" aria-label="第 ${pos+1} 个位置，${stepIndex===null?'空白':escapeHtml(steps[stepIndex])}"><span class="rebuild-slot-number">${pos+1}</span><strong>${stepIndex===null?'选择备选句后点这里':escapeHtml(steps[stepIndex])}</strong><span class="move-buttons"><button type="button" data-move="${pos}" data-dir="-1" aria-label="向上移动" ${pos===0?'disabled':''}>↑</button><button type="button" data-move="${pos}" data-dir="1" aria-label="向下移动" ${pos===order.length-1?'disabled':''}>↓</button></span></div>${pos<order.length-1?`<div class="rebuild-connector" aria-hidden="true">${kind==='cycle'?'→':'↓'}</div>`:''}`).join('')}${kind==='cycle'&&order.length>1?'<div class="rebuild-connector" aria-hidden="true">↻</div>':''}</div>`;}
    function rebuildTableState(kind,pairs){const signature=JSON.stringify(pairs);const valid=state.rebuild&&!Array.isArray(state.rebuild)&&state.rebuild.mode==='pair-bank'&&state.rebuild.kind===kind&&state.rebuild.signature===signature;if(!valid){const reveals=pairs.map((_,row)=>row%2===0?'left':'right');const optionOrder=shuffled(pairs.map((_,row)=>`${row}-${reveals[row]==='left'?'right':'left'}`));state.rebuild={mode:'pair-bank',kind,signature,reveals,optionOrder,cells:{},selected:null};}return state.rebuild;}
    function rebuildTableOptionText(optionId,pairs){const [row,side]=String(optionId).split('-');return pairs[Number(row)]?.[side==='left'?0:1]||'';}
    function rebuildTableDropHtml(row,side,label,pairs,tableState){const slotId=`${row}-${side}`,optionId=tableState.cells[slotId]||'',value=optionId?rebuildTableOptionText(optionId,pairs):'拖入备选内容';const result=state.rebuildChecked?(optionId===slotId?'correct':'wrong'):'';return `<div class="rebuild-table-value drop ${optionId?'filled':''} ${result} ${tableState.selected?'selected':''}" data-rebuild-table-slot="${slotId}" tabindex="0" role="button" aria-label="第 ${row+1} 行 ${label}，${optionId?escapeHtml(value):'空白'}" ${state.rebuildChecked&&optionId!==slotId?'aria-invalid="true"':''}>${escapeHtml(value)}</div>`;}
    function placeRebuildTableOption(optionId,slotId,kind,pairs){const tableState=state.rebuild;const previousSlot=Object.keys(tableState.cells).find(key=>tableState.cells[key]===optionId);const displaced=tableState.cells[slotId]||null;if(previousSlot&&previousSlot!==slotId)tableState.cells[previousSlot]=displaced;tableState.cells[slotId]=optionId;tableState.selected=null;state.rebuildChecked=false;renderRebuildTable(kind);saveProgress();}
    function renderRebuildTable(kind){const pairs=rebuildPairs(kind);if(!pairs.length){$('#rebuildModule').innerHTML='<div class="panel practice-shell"><div class="state-box"><strong>暂无表格答案</strong>这张卡片需要在 rebuild.pairs 中配置左右两列内容。</div></div>';return}const tableState=rebuildTableState(kind,pairs);const [leftLabel,rightLabel]=rebuildPairLabels(kind);const correct=()=>pairs.filter((_,row)=>{const hidden=tableState.reveals[row]==='left'?'right':'left',slotId=`${row}-${hidden}`;return tableState.cells[slotId]===slotId;}).length;const choices=tableState.optionOrder.map(optionId=>{const used=Object.values(tableState.cells).includes(optionId),selected=tableState.selected===optionId;return `<button type="button" class="rebuild-table-option ${used?'used':''} ${selected?'selected':''}" draggable="true" data-rebuild-table-option="${optionId}" aria-pressed="${selected}"><span>${escapeHtml(rebuildTableOptionText(optionId,pairs))}</span><small>${used?'已放入':'拖入'}</small></button>`;}).join('');const rows=pairs.map((pair,row)=>{const revealed=tableState.reveals[row];const left=revealed==='left'?`<div class="rebuild-table-value given">${escapeHtml(pair[0])}</div>`:rebuildTableDropHtml(row,'left',leftLabel,pairs,tableState);const right=revealed==='right'?`<div class="rebuild-table-value given">${escapeHtml(pair[1])}</div>`:rebuildTableDropHtml(row,'right',rightLabel,pairs,tableState);return `<tr><td>${left}</td><td class="connector" aria-hidden="true">→</td><td>${right}</td></tr>`;}).join('');const currentCorrect=correct();$('#rebuildModule').innerHTML=`<div class="panel practice-shell"><div class="practice-intro"><div><h2 class="section-title task-title"><span class="task-tag">Task 5</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Rebuild</span></h2><p class="muted">每组关系已给出一侧。把上方备选内容拖入对应空格；手机上可先点备选，再点空格。</p></div><span class="badge ${isDone('rebuild')?'success':''}">${isDone('rebuild')?'已提交':'等待检查'}</span></div><section class="rebuild-choice-bank" aria-labelledby="rebuildChoiceTitle"><h3 class="rebuild-choice-bank-title" id="rebuildChoiceTitle">备选内容</h3><div class="rebuild-choice-list">${choices}</div></section><div class="rebuild-table-wrap"><table class="rebuild-table"><thead><tr><th scope="col">${leftLabel}</th><th class="connector" aria-label="对应关系"></th><th scope="col">${rightLabel}</th></tr></thead><tbody>${rows}</tbody></table></div>${state.rebuildChecked?`<p class="rebuild-table-feedback" aria-live="polite">${currentCorrect===pairs.length?'全部对应正确，你已经抓住了文章结构。':`已完成 ${currentCorrect} / ${pairs.length} 组正确配对；红色位置需要更换。`}</p>`:''}<div class="btn-row"><button class="btn primary" id="checkRebuild" type="button">检查结构</button><button class="btn" id="resetRebuild" type="button">重新开始</button></div></div>${moduleCompleteBox('rebuild')}`;$$('[data-rebuild-table-option]').forEach(button=>{button.onclick=()=>{tableState.selected=tableState.selected===button.dataset.rebuildTableOption?null:button.dataset.rebuildTableOption;renderRebuildTable(kind);};button.addEventListener('dragstart',event=>event.dataTransfer?.setData('text/plain',button.dataset.rebuildTableOption));});$$('[data-rebuild-table-slot]').forEach(slot=>{const place=()=>{if(tableState.selected)placeRebuildTableOption(tableState.selected,slot.dataset.rebuildTableSlot,kind,pairs);};slot.onclick=place;slot.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();place();}};slot.addEventListener('dragover',event=>{event.preventDefault();slot.classList.add('drag-over');});slot.addEventListener('dragleave',()=>slot.classList.remove('drag-over'));slot.addEventListener('drop',event=>{event.preventDefault();slot.classList.remove('drag-over');const optionId=event.dataTransfer?.getData('text/plain');if(optionId)placeRebuildTableOption(optionId,slot.dataset.rebuildTableSlot,kind,pairs);});});$('#checkRebuild').onclick=()=>{const slots=pairs.map((_,row)=>`${row}-${tableState.reveals[row]==='left'?'right':'left'}`);if(slots.some(slotId=>!tableState.cells[slotId])){toast('请先填满所有空格');return}const score=Math.round(correct()/pairs.length*100);state.rebuildChecked=true;complete('rebuild',score,score===100?'结构重建正确':'已保存本次表格答案');renderRebuildTable(kind);};$('#resetRebuild').onclick=()=>{state.rebuild=null;state.rebuildChecked=false;renderRebuildTable(kind);saveProgress();};bindNext();}
    function renderRebuild(){const steps=rebuildSteps();const kind=rebuildKind();if(['feature-function','fact-explanation','cause-effect','compare-contrast'].includes(kind)){renderRebuildTable(kind);return}if(!steps.length){$('#rebuildModule').innerHTML='<div class="panel practice-shell"><div class="state-box"><strong>暂无结构步骤</strong>这张卡片还没有配置重建题目。</div></div>';return}const order=rebuildOrderFromState(steps);state.rebuild=order;const label=kind==='cycle'?'循环结构':'流程结构';$('#rebuildModule').innerHTML=`<div class="panel practice-shell"><div class="practice-intro"><div><h2 class="section-title task-title"><span class="task-tag">Task 5</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Rebuild</span></h2><p class="muted">${label}：拖动右侧句子到左侧图中；在手机或键盘上，也可以先选句子，再选择位置。</p></div><span class="badge ${isDone('rebuild')?'success':''}">${isDone('rebuild')?'已提交':'等待检查'}</span></div><div class="rebuild-workspace"><section class="rebuild-canvas" aria-labelledby="rebuildCanvasTitle"><h3 class="rebuild-panel-title" id="rebuildCanvasTitle">${kind==='cycle'?'循环图':'顺序图'}</h3>${rebuildDiagramHtml(steps,order,kind)}<p class="rebuild-drop-hint">可拖放、点选，或用每个方块上的上下箭头调整顺序。</p></section><aside class="rebuild-bank" aria-labelledby="rebuildBankTitle"><h3 class="rebuild-panel-title" id="rebuildBankTitle">备选句</h3><div class="rebuild-bank-list">${steps.map((text,index)=>`<button type="button" class="rebuild-option ${state.rebuildSelected===index?'selected':''}" draggable="true" data-rebuild-option="${index}" aria-pressed="${state.rebuildSelected===index}"><span aria-hidden="true">⋮⋮</span><span>${escapeHtml(text)}</span><small>${order.includes(index)?'已放入':'点选或拖入'}</small></button>`).join('')}</div></aside></div>${state.rebuildChecked?`<div class="alert ${scoreOf('rebuild')===100?'success':'error'}">${scoreOf('rebuild')===100?'结构正确！你已经抓住了文章关系。':'顺序还需要调整。看看信息是怎样一步步发生或相互作用的。'}</div>`:''}<div class="btn-row" style="margin-top:14px"><button class="btn primary" id="checkRebuild" type="button">检查结构</button><button class="btn" id="resetRebuild" type="button">清空并重排</button></div></div>${moduleCompleteBox('rebuild')}`;bindRebuildDrag();$$('[data-rebuild-option]').forEach(button=>button.onclick=()=>{state.rebuildSelected=state.rebuildSelected===Number(button.dataset.rebuildOption)?null:Number(button.dataset.rebuildOption);renderRebuild();});$$('[data-rebuild-slot]').forEach(slot=>{const place=()=>{if(state.rebuildSelected===null)return;placeRebuildOption(state.rebuildSelected,Number(slot.dataset.position));};slot.addEventListener('click',event=>{if(!event.target.closest('button'))place();});slot.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&!event.target.closest('button')){event.preventDefault();place();}});});$$('[data-move]').forEach(button=>button.onclick=()=>{const from=Number(button.dataset.move),to=from+Number(button.dataset.dir);if(to<0||to>=state.rebuild.length)return;[state.rebuild[from],state.rebuild[to]]=[state.rebuild[to],state.rebuild[from]];state.rebuildChecked=false;renderRebuild();saveProgress();});$('#checkRebuild').onclick=()=>{if(state.rebuild.includes(null)){toast('请先填满所有位置');return}const expected=[...steps.keys()];const correct=state.rebuild.filter((value,i)=>value===expected[i]).length;state.rebuildChecked=true;complete('rebuild',Math.round(correct/steps.length*100),correct===steps.length?'结构重建正确':'已保存本次结构答案');renderRebuild();};$('#resetRebuild').onclick=()=>{state.rebuild=Array(steps.length).fill(null);state.rebuildSelected=null;state.rebuildChecked=false;renderRebuild();saveProgress();};bindNext();}
    function placeRebuildOption(source,target){const sourcePosition=state.rebuild.indexOf(source);if(sourcePosition>=0&&sourcePosition!==target)[state.rebuild[sourcePosition],state.rebuild[target]]=[state.rebuild[target],state.rebuild[sourcePosition]];else if(sourcePosition<0)state.rebuild[target]=source;state.rebuildSelected=null;state.rebuildChecked=false;renderRebuild();saveProgress();}
    function syncRebuildBank(){const bank=$('.rebuild-bank-list');if(!bank)return;const steps=rebuildSteps();const order=Array.isArray(state.rebuild)?state.rebuild:[];ensureRebuildBankOrder(steps);const options=new Map($$('[data-rebuild-option]').map(option=>[Number(option.dataset.rebuildOption),option]));const available=state.rebuildBankOrder.filter(index=>!order.includes(index));bank.innerHTML='';if(!available.length){bank.innerHTML='<p class="rebuild-option-empty" aria-live="polite">所有备选句都已放入图中。</p>';return}available.forEach(index=>{const option=options.get(index);if(option)bank.append(option);});}
    function bindRebuildDrag(){syncRebuildBank();let dragged=null;$$('[data-rebuild-option],[data-rebuild-slot]').forEach(node=>{node.addEventListener('dragstart',event=>{dragged=node;node.classList.add('dragging');event.dataTransfer?.setData('text/plain',node.dataset.rebuildOption??node.dataset.position??'');});node.addEventListener('dragend',()=>{node.classList.remove('dragging');dragged=null;$$('[data-rebuild-slot]').forEach(slot=>slot.classList.remove('drag-over'));});});$$('[data-rebuild-slot]').forEach(slot=>{slot.addEventListener('dragover',event=>{event.preventDefault();slot.classList.add('drag-over');});slot.addEventListener('dragleave',()=>slot.classList.remove('drag-over'));slot.addEventListener('drop',event=>{event.preventDefault();slot.classList.remove('drag-over');const target=Number(slot.dataset.position);const source=Number(event.dataTransfer?.getData('text/plain'));if(!Number.isInteger(source)||!Number.isInteger(target))return;if(dragged?.dataset.rebuildOption!==undefined)placeRebuildOption(source,target);else if(source!==target){[state.rebuild[source],state.rebuild[target]]=[state.rebuild[target],state.rebuild[source]];state.rebuildChecked=false;renderRebuild();saveProgress();}});});}

    function renderResult(){if(['reading','listening','words','comprehension','rebuild'].every(isDone)&&!isDone('result')){state.moduleStatus.result={completed:true,score:100,completedAt:new Date().toISOString()};setTimeout(saveProgress,0);}const done=completedCount();const percent=Math.round(done/5*100);const items=[['reading','Listen and Read','阅读与练习',['reading','listening']],['words','Words','连线、图片配对与语境'],['comprehension','Comprehension','阅读理解'],['rebuild','Rebuild','结构重建'],['result','Result','学习汇总']];$('#resultModule').innerHTML=`<div class="result-grid"><section class="panel score-card"><h2 class="section-title task-title"><span class="task-tag">Task 6</span><span class="task-divider" aria-hidden="true"></span><span class="task-name">Result</span></h2><div class="score-ring" style="--score:${percent}%"><div><strong>${percent}%</strong><span>${done} / 5 完成</span></div></div><p>${percent===100?'所有模块都完成了，做得很棒！':percent>=50?'已经过半，完成剩余模块就能点亮整课。':'从任意模块开始，系统会为你保存进度。'}</p></section><section class="panel result-list"><div><p class="eyebrow">Module details</p><h2 class="section-title">模块明细</h2></div>${items.map(([id,en,zh,members=[id]])=>`<div class="result-row"><div><strong>${en} · ${zh}</strong><small>${members.every(isDone)?`已完成${['words','comprehension','rebuild'].includes(id)?` · 得分 ${scoreOf(id)}`:''}`:'尚未完成'}</small></div><button class="btn ${members.every(isDone)?'':'primary'}" type="button" data-result-open="${id}">${members.every(isDone)?'查看':'继续'}</button></div>`).join('')}<div class="btn-row"><button class="btn" id="restart" type="button">再学一次</button></div></section></div>${moduleCompleteBox('result')}`;$$('[data-result-open]').forEach(button=>button.onclick=()=>openModule(button.dataset.resultOpen));$('#restart').onclick=()=>{if(!confirm('要清空本课页面中的答案并重新开始吗？'))return;clearTimeout(state.wordTileTimer);clearInterval(state.recordingTimer);state.recordingTimer=null;state.recordingStartedAt=null;state.playing=false;state.singlePlaying=false;state.current=-1;state.playbackProgress=0;state.wordBankReviewed=false;state.context={};state.contextSelected=null;state.contextChecked=false;state.contextWrong=[];state.comprehension={};state.matched=[];state.wordTileOrder=[];state.wordTileSelected=null;state.wordTileMatched=[];state.wordTileFeedback=[];state.wordTileLocked=false;state.rebuild=[];state.submittedPractice=[];state.moduleStatus={};renderAll();openModule('reading');saveProgress();};renderNav();}

    function bindNext(){$$('[data-next]').forEach(button=>button.onclick=()=>openModule(button.dataset.next));}
    function moduleCompleteBox(id){const index=modules.findIndex(([moduleId])=>moduleId===id);const[,en,,members=[id]]=modules[index];const done=members.every(isDone);const isResult=id==='result';const next=modules[index+1];const title=isResult?(done?'恭喜你完成本课全部学习内容！':'本课学习还在进行中'):(done?'恭喜你完成本关，让我们进入下一关':'完成本板块后将解锁下一关');const note=isResult?(done?'5 个板块全部完成，做得很棒！':'继续完成其余板块，即可点亮整课学习结果'):(done?`「${en}」已全部完成，继续加油！`:`先完成「${en}」里的全部任务`);const action=isResult?`<a class="btn primary" href="/syllabus.html">返回课程</a>`:`<button type="button" class="btn primary" data-next="${next[0]}" ${done?'':'disabled'}>进入下一关</button>`;return `<div class="module-complete ${done?'done':''}" data-module-complete="${id}"><div><strong>${title}</strong><small>${note}</small></div>${action}</div>`;}
function complete(module,score,message){state.moduleStatus[module]={completed:true,score,completedAt:new Date().toISOString()};renderNav();saveProgress();const boxModule=module==='listening'?'reading':module;const box=document.querySelector(`[data-module-complete="${boxModule}"]`);if(box)box.outerHTML=moduleCompleteBox(boxModule);bindNext();}
    async function saveProgress(){if(!state.card)return;const completedPercent=Math.round(completedCount()/5*100);try{await api(`/api/progress/${encodeURIComponent(currentUserId())}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({cardId:state.card.cardId,lastModule:state.active,wordBankReviewed:state.wordBankReviewed,answers:{context:state.context,comprehension:state.comprehension},matched:state.matched,wordTileMatched:state.wordTileMatched,rebuild:state.rebuild,submittedPractice:state.submittedPractice,moduleStatus:state.moduleStatus,completedPercent})});}catch{}}
    async function loadProgress(){try{const data=await api(`/api/progress/${encodeURIComponent(currentUserId())}`);const saved=data.cards?.[state.card.cardId];if(!saved)return;state.wordBankReviewed=Boolean(saved.wordBankReviewed);state.context=saved.answers?.context||{};contextQuestions().forEach((q,i)=>{const options=normalizeOptions(q);if(options[state.context[i]])state.context[i]=options[state.context[i]];});state.comprehension=saved.answers?.comprehension||saved.answers||{};state.matched=saved.matched||[];state.wordTileMatched=(saved.wordTileMatched||[]).map(String);state.rebuild=saved.rebuild||saved.steps||[];state.submittedPractice=saved.submittedPractice||[];state.moduleStatus=saved.moduleStatus||{};state.active=saved.lastModule||'reading';}catch{}}
    function renderAll(){renderReading();renderWords();renderComprehension();renderRebuild();renderResult();renderNav();}

    async function boot(){try{state.card=await api(`/api/cards/${encodeURIComponent(slug)}`);await loadProgress();await loadAudioManifest();loadRecordingState();document.title=`${state.card.title} · Fluent Science Reading`;$('#meta').innerHTML=`<span class="badge">DAY ${String(state.card.day).padStart(3,'0')}</span><span class="badge">${escapeHtml(state.card.level||'L1')}</span><span class="badge">${escapeHtml(state.card.theme||'')}</span><span class="badge warning">${escapeHtml(state.card.articleStructure||state.card.structure||'Science Reading')}</span>`;$('#title').textContent=state.card.title;$('#bigQuestionLabel').textContent=state.card.bigQuestion||'';$('#loading').classList.add('hidden');$('#app').classList.remove('hidden');renderAll();openModule(state.active,false);}catch(error){$('#loading').classList.add('hidden');$('#fatal').classList.remove('hidden');$('#fatalMessage').textContent=error.message;}}
    boot();
  