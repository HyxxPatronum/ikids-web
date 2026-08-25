import { env } from 'cloudflare:workers';
import flower from '../../../day001-flower.json';
import cactus from '../../../science-reader-100-how-a-cactus-saves-water.json';
import { createDictionaryService } from '../../../lib/dictionary/service.ts';
import { buildCatalogFromIndex, catalogCategory } from '../../../lib/catalog/catalog.ts';
import { createD1PublicationStore } from '../../../lib/catalog/d1-publication-store.ts';
import { createPublicationIndex, phraseCandidates, publicationLexeme, reviewPhraseCandidate } from '../../../lib/catalog/publication-index.ts';
import { loadPronunciationAudio, PronunciationProxyError } from '../../../lib/pronunciation/proxy-adapter.ts';

type RouteContext = { params: Promise<{ path: string[] }> };
type Card = Record<string, any>;
const seedCards: Card[] = [flower, cactus];
const normalizeWord = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, '');
const categoryFor = catalogCategory;

const DICTIONARY_TTL=7*24*60*60*1000;
const DICTIONARY_NEGATIVE_TTL=30*60*1000;
const dictionaryInflight=new Map<string,Promise<any>>();
const uniqueTerms=(values:unknown[])=>[...new Set((values||[]).map(value=>String(value||'').trim()).filter(Boolean))];
function normalizeDictionaryEntry(entry:any){
  const phonetics=entry.phonetics||[];const audioRaw=phonetics.find((item:any)=>item.audio)?.audio||'';
  const pronunciations:any[]=[];const seenRegions=new Set<string>();
  for(const item of phonetics){const raw=String(item.audio||'');if(!raw)continue;const audio=raw.startsWith('//')?`https:${raw}`:raw;const hint=`${audio} ${item.sourceUrl||''}`.toLowerCase();const region=/(?:^|[-_/])(us|usa)(?:[-_./]|$)|en[-_]us|american/.test(hint)?'us':/(?:^|[-_/])(uk|gb)(?:[-_./]|$)|en[-_](?:gb|uk)|british/.test(hint)?'uk':'other';if(seenRegions.has(region))continue;seenRegions.add(region);pronunciations.push({region,label:region==='us'?'美音':region==='uk'?'英音':'词典音频',phonetic:item.text||'',audio,sourceUrl:item.sourceUrl||'',license:item.license?.name||'',licenseUrl:item.license?.url||''});}
  const meanings=(entry.meanings||[]).slice(0,6).map((meaning:any)=>{const definitions=(meaning.definitions||[]).filter((item:any)=>item.definition).slice(0,5);return {partOfSpeech:meaning.partOfSpeech||'definition',definitions:definitions.map((item:any)=>({definition:item.definition,example:item.example||''})),synonyms:uniqueTerms([...(meaning.synonyms||[]),...definitions.flatMap((item:any)=>item.synonyms||[])]).slice(0,5),antonyms:uniqueTerms([...(meaning.antonyms||[]),...definitions.flatMap((item:any)=>item.antonyms||[])]).slice(0,3)};}).filter((group:any)=>group.definitions.length);
  return {phonetic:entry.phonetic||phonetics.find((item:any)=>item.text)?.text||'',audio:audioRaw.startsWith('//')?`https:${audioRaw}`:audioRaw,pronunciations,meanings,provider:'Free Dictionary API',providerUrl:(entry.sourceUrls||[])[0]||`https://en.wiktionary.org/wiki/${encodeURIComponent(entry.word||'')}`,license:entry.license?.name||'',licenseUrl:entry.license?.url||''};
}
async function fetchDictionary(word: string) {
  let lastError:unknown;
  for(let attempt=0;attempt<2;attempt+=1){
    try{
      const response=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,{headers:{accept:'application/json','user-agent':'FluentScienceReading/0.1'},signal:AbortSignal.timeout(attempt?6500:4000)});
      if(response.status===404)return null;
      if(!response.ok)throw new Error(`Dictionary provider returned ${response.status}`);
      const data:any=await response.json();const entry=Array.isArray(data)?data[0]:null;
      return entry?normalizeDictionaryEntry(entry):null;
    }catch(error){lastError=error;if(attempt===0)await new Promise(resolve=>setTimeout(resolve,180));}
  }
  throw lastError||new Error('Dictionary provider unavailable');
}
async function fetchDictionaryOnce(word:string){
  if(dictionaryInflight.has(word))return dictionaryInflight.get(word);
  const request=fetchDictionary(word).finally(()=>dictionaryInflight.delete(word));
  dictionaryInflight.set(word,request);return request;
}
const stripMarkup=(value:unknown)=>String(value||'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
function chineseMeaningGroups(lines:unknown[]){
  const groups=new Map<string,any[]>();
  for(const raw of uniqueTerms(lines).slice(0,10)){const line=stripMarkup(raw);if(!line)continue;const match=line.match(/^([a-z]+(?:\.[a-z]+)*\.)\s*(.+)$/i);const partOfSpeech=match?.[1]||'中文释义';const definition=match?.[2]||line;if(!groups.has(partOfSpeech))groups.set(partOfSpeech,[]);groups.get(partOfSpeech)!.push({definition,example:''});}
  return [...groups].slice(0,5).map(([partOfSpeech,definitions])=>({partOfSpeech,definitions:definitions.slice(0,3),synonyms:[],antonyms:[]}));
}
function localChineseDictionaryRow(row:any){
  if(!row)return null;const meanings=chineseMeaningGroups(String(row.translation||'').split(/\\n|\n/));if(!meanings.length)return null;
  return {phonetic:row.phonetic||'',audio:'',meanings,provider:'ECDICT 本地词典',providerUrl:'https://github.com/skywind3000/ECDICT',license:'MIT',licenseUrl:'https://github.com/skywind3000/ECDICT/blob/master/LICENSE',language:'zh',lookupSource:'ecdict'};
}
const canonicalStructures = ['Feature-Function','Cause-Effect','Process/Life cycle','Compare-Contrast','Fact/Explanation'];
const aliases = new Map([
  ['feature-function','Feature-Function'],['feature / function','Feature-Function'],['feature → function','Feature-Function'],
  ['cause-effect','Cause-Effect'],['cause / effect','Cause-Effect'],['cause → effect','Cause-Effect'],
  ['process/life cycle','Process/Life cycle'],['process / life cycle','Process/Life cycle'],
  ['compare-contrast','Compare-Contrast'],['compare / contrast','Compare-Contrast'],
  ['fact/explanation','Fact/Explanation'],['fact / explanation','Fact/Explanation'],
]);

const json = (body: unknown, status=200) => Response.json(body, { status, headers: { 'cache-control':'no-store' } });
const canonicalStructure = (value: unknown) => aliases.get(String(value||'').trim().toLowerCase()) || null;
const slugFor = (card: Card) => card.slug || `${String(card.courseId||'course').toLowerCase()}-${card.day}-${String(card.title||card.cardId).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`.replace(/-+/g,'-').replace(/^-|-$/g,'');

function validateCard(card: Card) {
  const errors: string[]=[];
  for(const field of ['cardId','courseId','topic','theme','day','level','title','paragraphs','word_bank'])if(card?.[field]==null)errors.push(`Missing required field: ${field}`);
  if(card.cardId&&!/^[a-z0-9][a-z0-9-]{1,80}$/.test(card.cardId))errors.push('cardId must be a slug-safe id');
  if(card.level&&!['L1','L2','L3'].includes(card.level))errors.push('level must be L1, L2, or L3');
  if(!canonicalStructure(card.articleStructure||card.structure))errors.push('Invalid Article Structure');
  if(!Array.isArray(card.paragraphs)||!card.paragraphs.length)errors.push('paragraphs must be a non-empty array');
  if(!Array.isArray(card.word_bank)||card.word_bank.length<5||card.word_bank.length>6)errors.push('word_bank must contain 5-6 words');
  const questions=card.comprehension?.questions;
  if(!Array.isArray(questions)||questions.length!==3)errors.push('Comprehension must contain exactly 3 questions');
  else questions.forEach((q:Card,index:number)=>{const options=Array.isArray(q.options)?q.options:Object.keys(q.options||{});if(!['A','B','C'].includes(q.answer))errors.push(`Question ${index+1} answer must be A/B/C`);if(options.length!==3)errors.push(`Question ${index+1} must contain exactly 3 options`);});
  if(!Array.isArray(card.rebuild?.steps)||card.rebuild.steps.length<3)errors.push('rebuild.steps must contain at least 3 items');
  return { valid:errors.length===0, errors };
}

async function ensureDatabase(db: D1Database) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS series (id TEXT PRIMARY KEY, name TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT \'\', description TEXT NOT NULL DEFAULT \'\', sort_order INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT \'draft\', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, series_id TEXT NOT NULL, course_id TEXT NOT NULL, topic TEXT NOT NULL, theme TEXT NOT NULL, day INTEGER NOT NULL, level TEXT NOT NULL, title TEXT NOT NULL, big_question TEXT NOT NULL DEFAULT \'\', article_structure TEXT NOT NULL, image TEXT NOT NULL, content_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'draft\', updated_at TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS learning_progress (user_id TEXT NOT NULL, card_id TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT \'{}\', completed_percent INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, card_id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS recording_submissions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, card_id TEXT NOT NULL, target_sentence TEXT NOT NULL, mime TEXT, size INTEGER, status TEXT NOT NULL DEFAULT \'uploaded\', created_at TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS dictionary_cache (word TEXT PRIMARY KEY, payload_json TEXT, status TEXT NOT NULL, expires_at TEXT NOT NULL, updated_at TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS dictionary_entries (word TEXT PRIMARY KEY, phonetic TEXT NOT NULL DEFAULT \'\', translation TEXT NOT NULL, definition TEXT NOT NULL DEFAULT \'\', pos TEXT NOT NULL DEFAULT \'\', exchange TEXT NOT NULL DEFAULT \'\', source TEXT NOT NULL DEFAULT \'ECDICT\', updated_at TEXT NOT NULL)'),
    db.prepare("CREATE TABLE IF NOT EXISTS published_vocabulary_terms (card_id TEXT NOT NULL, lexeme TEXT NOT NULL, surface_form TEXT NOT NULL, meaning TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', media_json TEXT NOT NULL DEFAULT '{}', membership TEXT NOT NULL CHECK (membership IN ('level2','level3','science')), source_slug TEXT NOT NULL, source_title TEXT NOT NULL DEFAULT '', source_theme TEXT NOT NULL DEFAULT '', source_image TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (card_id,lexeme))"),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_published_vocabulary_lexeme ON published_vocabulary_terms(lexeme)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_published_vocabulary_membership ON published_vocabulary_terms(membership,lexeme)'),
  ]);
  const publicationColumns=await db.prepare('PRAGMA table_info(published_vocabulary_terms)').all<{name:string}>();
  if(!(publicationColumns.results||[]).some(column=>column.name==='media_json'))await db.prepare("ALTER TABLE published_vocabulary_terms ADD COLUMN media_json TEXT NOT NULL DEFAULT '{}'").run();
  const now=new Date().toISOString();
  await db.prepare('INSERT OR IGNORE INTO series (id,name,subtitle,description,sort_order,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind('science-reading','Science Reading','Nature, life science, and science stories','Learn science English through reading, listening, and practice',10,'published',now,now).run();
  for(const raw of seedCards){const card:Card={...raw,articleStructure:canonicalStructure(raw.articleStructure||raw.structure),structure:canonicalStructure(raw.articleStructure||raw.structure)};await db.prepare('INSERT OR IGNORE INTO cards (id,slug,series_id,course_id,topic,theme,day,level,title,big_question,article_structure,image,content_json,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(card.cardId,slugFor(card),card.seriesId||card.courseId,card.courseId,card.topic,card.theme,card.day,card.level,card.title,card.bigQuestion||'',card.articleStructure,card.image_file||card.image,JSON.stringify(card),card.status||'published',now).run();}
  const publicationIndex=createPublicationIndex(createD1PublicationStore(db));
  const indexed:any=await db.prepare('SELECT COUNT(*) count FROM published_vocabulary_terms').first();
  if(!Number(indexed?.count||0)){
    const rows=await db.prepare("SELECT id,slug,title,theme,image,status,content_json FROM cards WHERE status='published'").all();
    for(const row of rows.results||[]){const item:any=row;await publicationIndex.synchronize({...JSON.parse(String(item.content_json)),cardId:item.id,slug:item.slug,title:item.title,theme:item.theme,image:item.image,status:item.status});}
  }
}

function requestUser(request: Request) {
  const id=request.headers.get('oai-authenticated-user-id'); const email=request.headers.get('oai-authenticated-user-email');
  return id&&email?{id,email,role:'student',createdAt:new Date().toISOString()}:null;
}
function canPreviewVocabulary(request:Request){const token=String(env.CONTENT_EDITOR_PREVIEW_TOKEN||'');return Boolean(token&&request.headers.get('authorization')===`Bearer ${token}`);}
function scopedUser(request:Request,requested:string){const user=requestUser(request);if(user)return requested==='demo'||requested===user.id?user.id:null;return requested==='demo'?'demo':null;}
const cardRecord=(row:any)=>({id:row.id,slug:row.slug,seriesId:row.series_id,courseId:row.course_id,topic:row.topic,theme:row.theme,day:row.day,level:row.level,title:row.title,articleStructure:row.article_structure,image:row.image,status:row.status,updatedAt:row.updated_at});

async function getCachedDictionary(db:D1Database,word:string){
  const now=Date.now();const cacheRow:any=await db.prepare('SELECT payload_json,status,expires_at FROM dictionary_cache WHERE word=?').bind(word).first();const cachedPayload=cacheRow?.payload_json?JSON.parse(cacheRow.payload_json):null;const currentShape=cacheRow?.status==='not_found'||Array.isArray(cachedPayload?.pronunciations);const fresh=Boolean(cacheRow&&currentShape&&Date.parse(cacheRow.expires_at)>now);let remote:any=fresh&&cacheRow.status==='found'?cachedPayload:null;let cacheStatus=fresh?'hit':'miss';let providerUnavailable=false;
  if(!fresh){try{remote=await fetchDictionaryOnce(word);const updatedAt=new Date(now).toISOString();const expiresAt=new Date(now+(remote?DICTIONARY_TTL:DICTIONARY_NEGATIVE_TTL)).toISOString();await db.prepare('INSERT INTO dictionary_cache (word,payload_json,status,expires_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(word) DO UPDATE SET payload_json=excluded.payload_json,status=excluded.status,expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(word,remote?JSON.stringify(remote):null,remote?'found':'not_found',expiresAt,updatedAt).run();}catch{providerUnavailable=true;if(cacheRow?.status==='found'&&currentShape){remote=cachedPayload;cacheStatus='stale';}}}
  return {remote,cacheStatus,providerUnavailable};
}

async function handle(request:Request,context:RouteContext){
  const db=env.DB;if(!db)return json({error:'Database binding unavailable'},503);await ensureDatabase(db);
  const publicationIndex=createPublicationIndex(createD1PublicationStore(db));
  const segments=(await context.params).path||[];const path='/'+segments.join('/');const method=request.method;const url=new URL(request.url);
  if(path==='/health'&&method==='GET')return json({ok:true,service:'fluent-sites-api'});
  if(path==='/pronunciation'&&method==='GET'){
    const word=normalizeWord(url.searchParams.get('word'));const region=String(url.searchParams.get('region')||'');
    if(!word||word.length>80||!['us','uk'].includes(region))return json({error:'请输入有效的发音词和口音'},400);
    try{
      const audio=await loadPronunciationAudio({word,region:region as 'us'|'uk',resolveEntry:fetchDictionary});
      return new Response(audio.body,{headers:{'content-type':audio.contentType,'cache-control':audio.cacheControl}});
    }catch(error){return error instanceof PronunciationProxyError?json({error:error.message},error.status):json({error:'发音服务暂时不可用'},502);}
  }
  if(path==='/auth/me'&&method==='GET'){const user=requestUser(request);if(!user)return json({error:'请先使用 ChatGPT 登录'},401);const rows=await db.prepare('SELECT payload_json,completed_percent,updated_at FROM learning_progress WHERE user_id=? ORDER BY updated_at DESC').bind(user.id).all();const recent=(rows.results||[]).map((row:any)=>({...JSON.parse(row.payload_json),completedPercent:row.completed_percent,updatedAt:row.updated_at}));const average=recent.length?Math.round(recent.reduce((sum:number,item:any)=>sum+Number(item.completedPercent||0),0)/recent.length):0;return json({user,summary:{started:recent.length,completed:recent.filter((item:any)=>item.completedPercent>=100).length,average,recent:recent.slice(0,5)}});}
  if(path==='/auth/logout'&&method==='POST')return json({ok:true,platformAuth:true});
  if((path==='/auth/login'||path==='/auth/register')&&method==='POST')return json({error:'正式站点使用 ChatGPT 登录，请通过站点登录入口继续。'},400);
  if(path==='/series'&&method==='GET'){const rows=await db.prepare("SELECT s.*, COUNT(c.id) card_count FROM series s LEFT JOIN cards c ON c.series_id=s.id AND c.status='published' WHERE s.status='published' GROUP BY s.id HAVING card_count>0 ORDER BY s.sort_order").all();return json({series:(rows.results||[]).map((row:any)=>({id:row.id,name:row.name,subtitle:row.subtitle,description:row.description,sort:row.sort_order,status:row.status,cardCount:row.card_count}))});}
  if(path==='/series'&&method==='POST'){const body:any=await request.json();if(!/^[a-z0-9][a-z0-9-]{1,80}$/.test(body.id||'')||!String(body.name||'').trim())return json({error:'id and name are required; id must be slug-safe'},400);const now=new Date().toISOString();try{await db.prepare('INSERT INTO series (id,name,subtitle,description,sort_order,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(body.id,body.name,body.subtitle||'',body.description||'',Number(body.sort||0),body.status||'draft',now,now).run();return json({...body,createdAt:now},201);}catch{return json({error:'Series already exists'},409);}}
  const seriesId=segments[0]==='series'&&segments.length===2?segments[1]:null;
  if(seriesId&&method==='DELETE'){await db.prepare("UPDATE series SET status='archived', updated_at=? WHERE id=?").bind(new Date().toISOString(),seriesId).run();return json({id:seriesId,status:'archived'});}
  if(path==='/cards'&&method==='GET'){const series=url.searchParams.get('seriesId');const query=series?db.prepare("SELECT * FROM cards WHERE series_id=? AND status='published' ORDER BY day").bind(series):db.prepare('SELECT * FROM cards ORDER BY day');const rows=await query.all();return json({cards:(rows.results||[]).map(cardRecord)});}
  if(path==='/cards/validate'&&method==='POST')return json(validateCard(await request.json() as Card));
  if(path==='/cards'&&method==='POST'){const raw:any=await request.json();const result=validateCard(raw);if(!result.valid)return json(result,422);const structure=canonicalStructure(raw.articleStructure||raw.structure);const card={...raw,articleStructure:structure,structure,status:'draft'};const now=new Date().toISOString();await db.prepare('INSERT OR REPLACE INTO cards (id,slug,series_id,course_id,topic,theme,day,level,title,big_question,article_structure,image,content_json,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(card.cardId,slugFor(card),card.seriesId||card.courseId,card.courseId,card.topic,card.theme,card.day,card.level,card.title,card.bigQuestion||'',structure,card.image_file||card.image||'day001-flower.png',JSON.stringify(card),'draft',now).run();await publicationIndex.synchronize({...card,cardId:card.cardId,slug:slugFor(card)});return json({id:card.cardId,status:'draft',validation:result},201);}
  if(segments[0]==='cards'&&segments.length===3&&['publish','unpublish','archive'].includes(segments[2])&&method==='POST'){const id=segments[1],status=segments[2]==='publish'?'published':segments[2]==='unpublish'?'unpublished':'archived';const row:any=await db.prepare('SELECT id,slug,title,theme,image,content_json FROM cards WHERE id=?').bind(id).first();if(!row)return json({error:'Card not found'},404);await db.prepare('UPDATE cards SET status=?, updated_at=? WHERE id=?').bind(status,new Date().toISOString(),id).run();await publicationIndex.synchronize({...JSON.parse(String(row.content_json)),cardId:row.id,slug:row.slug,title:row.title,theme:row.theme,image:row.image,status});return json({id,status});}
  if(segments[0]==='cards'&&segments.length===3&&segments[2]==='vocabulary-preview'&&method==='GET'){if(!canPreviewVocabulary(request))return json({error:'仅内容编辑可预览未发布词汇'},403);const id=segments[1];const row:any=await db.prepare('SELECT id,slug,title,theme,image,status,content_json FROM cards WHERE id=? OR slug=?').bind(id,id).first();if(!row)return json({error:'Card not found'},404);const card={...JSON.parse(String(row.content_json)),cardId:row.id,slug:row.slug,title:row.title,theme:row.theme,image:row.image,status:row.status};return json({cardId:row.id,status:row.status,terms:publicationIndex.preview(card)});}
  if(segments[0]==='cards'&&segments.length===3&&segments[2]==='phrase-candidates'&&['GET','PATCH'].includes(method)){
    if(!canPreviewVocabulary(request))return json({error:'仅内容编辑可审核短语候选'},403);
    const id=segments[1];const row:any=await db.prepare('SELECT id,slug,title,theme,image,status,content_json FROM cards WHERE id=? OR slug=?').bind(id,id).first();
    if(!row)return json({error:'Card not found'},404);
    let card:any={...JSON.parse(String(row.content_json)),cardId:row.id,slug:row.slug,title:row.title,theme:row.theme,image:row.image,status:row.status};
    if(method==='PATCH'){
      if(row.status==='published')return json({error:'请先取消发布，再审核短语候选'},409);
      const review:any=await request.json();
      if(!['accept','correct','reject'].includes(review.action))return json({error:'action must be accept, correct, or reject'},400);
      try{card=reviewPhraseCandidate(card,review);}catch(error:any){return json({error:error.message},400);}
      await db.prepare('UPDATE cards SET content_json=?, updated_at=? WHERE id=?').bind(JSON.stringify(card),new Date().toISOString(),row.id).run();
      await publicationIndex.synchronize(card);
    }
    return json({cardId:row.id,status:row.status,candidates:phraseCandidates(card),terms:publicationIndex.preview(card)});
  }
  if(segments[0]==='cards'&&segments.length===2&&method==='GET'){const id=segments[1];const row:any=await db.prepare('SELECT * FROM cards WHERE id=? OR slug=?').bind(id,id).first();if(!row||row.status!=='published'&&!canPreviewVocabulary(request))return json({error:'Card not found'},404);return json({...JSON.parse(row.content_json),slug:row.slug,status:row.status,articleStructure:row.article_structure,structure:row.article_structure});}
  if(path==='/words'&&method==='GET'){
    return json(buildCatalogFromIndex(await publicationIndex.entries()));
  }
  if(path==='/dictionary'&&method==='GET'){
    const requested=String(url.searchParams.get('word')||'').trim(); const lookup=normalizeWord(requested);const language=String(url.searchParams.get('lang')||'en');
    const surfaceForm=String(url.searchParams.get('surface')||requested).trim();const courseId=String(url.searchParams.get('courseId')||'').trim();const sentence=String(url.searchParams.get('sentence')||'').trim();
    const alternateScopes=(url.searchParams.getAll('alternate')||[]).map(value=>String(value).trim()).filter(Boolean);
    if(!['en','zh'].includes(language))return json({error:'词典语言只支持 en 或 zh'},400);
    if(!lookup||lookup.length>80||!/^[a-z]+(?:['-][a-z]+)*(?:\s+[a-z]+(?:['-][a-z]+)*)*$/.test(lookup))return json({error:'请输入有效的英文单词或短语'},400);
    if(surfaceForm.length>80||courseId.length>80||sentence.length>500||alternateScopes.length>16||alternateScopes.some(scope=>scope.length>80))return json({error:'查词范围、课程或句子上下文过长'},400);
    const indexed=(await publicationIndex.lookup(lookup,{courseId}))[0]||null;
    const knownCategory=categoryFor(lookup);const base={word:indexed?.english||requested.toLowerCase(),category:knownCategory||indexed?.membership||'reference',meaning:indexed?.meaning||'',image:indexed?.image||'',illustration:indexed?.illustration||null,pronunciations:indexed?.pronunciations||[],sources:indexed?.sources||[]};
    const unifiedService=createDictionaryService({
      catalog:{categoryFor:word=>categoryFor(word)||((indexed&&indexed.lexeme===publicationLexeme(word))?indexed.membership:null),courseFor:word=>indexed&&indexed.lexeme===publicationLexeme(word)?{lexeme:indexed.lexeme,meaning:base.meaning,image:base.image,illustration:base.illustration,pronunciations:base.pronunciations,sources:base.sources}:null},
      provider:async word=>language==='zh'
        ? (localChineseDictionaryRow(await db.prepare('SELECT word,phonetic,translation,definition,pos,exchange,source FROM dictionary_entries WHERE word=?').bind(word).first()) || (base.meaning&&(!indexed||word===indexed.lexeme)?{meanings:[{partOfSpeech:'课程释义',definitions:[{definition:base.meaning,example:''}],synonyms:[],antonyms:[]}],provider:'本地课程词库',language:'zh'}:null))
        : fetchDictionaryOnce(word),
      cache:{
        async get(key){const word=key.slice(key.indexOf(':')+1);const row:any=await db.prepare('SELECT payload_json,status,expires_at FROM dictionary_cache WHERE word=?').bind(word).first();if(!row)return null;return {value:row.payload_json?JSON.parse(row.payload_json):null,status:row.status==='found'&&Date.parse(row.expires_at)>Date.now()?'hit':row.status==='found'?'stale':'hit'};},
        async set(key,value,ttl){const word=key.slice(key.indexOf(':')+1);const now=new Date();await db.prepare('INSERT INTO dictionary_cache (word,payload_json,status,expires_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(word) DO UPDATE SET payload_json=excluded.payload_json,status=excluded.status,expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(word,value?JSON.stringify(value):null,value?'found':'not_found',new Date(now.getTime()+ttl).toISOString(),now.toISOString()).run();},
      },
    });
    try{return json(await unifiedService.lookup({surfaceForm,scope:lookup,alternateScopes,courseId,sentence,language}));}catch(error:any){return json({error:error.message,code:error.code},error.status||500);}
  }
  if(path==='/dashboard'&&method==='GET'){const [seriesCount,cardCount,publishedCount,progressCount,recordingCount,cards,series]=await Promise.all([db.prepare('SELECT COUNT(*) count FROM series').first<any>(),db.prepare('SELECT COUNT(*) count FROM cards').first<any>(),db.prepare("SELECT COUNT(*) count FROM cards WHERE status='published'").first<any>(),db.prepare('SELECT COUNT(*) count FROM learning_progress').first<any>(),db.prepare('SELECT COUNT(*) count FROM recording_submissions').first<any>(),db.prepare('SELECT * FROM cards ORDER BY day').all(),db.prepare('SELECT * FROM series ORDER BY sort_order').all()]);return json({counts:{series:seriesCount?.count||0,cards:cardCount?.count||0,published:publishedCount?.count||0,users:0,progress:progressCount?.count||0,recordings:recordingCount?.count||0},cards:(cards.results||[]).map(cardRecord),series:(series.results||[]).map((row:any)=>({id:row.id,name:row.name,subtitle:row.subtitle,description:row.description,sort:row.sort_order,status:row.status}))});}
  if(segments[0]==='progress'&&segments.length===2){const userId=scopedUser(request,segments[1]);if(!userId)return json({error:'无权访问该学习记录'},403);if(method==='GET'){const rows=await db.prepare('SELECT card_id,payload_json,completed_percent,updated_at FROM learning_progress WHERE user_id=?').bind(userId).all();const cards:Record<string,any>={};for(const row of rows.results||[]){const item:any=row;cards[item.card_id]={...JSON.parse(item.payload_json),completedPercent:item.completed_percent,updatedAt:item.updated_at};}return json({cards});}if(method==='PUT'||method==='POST'){const payload:any=await request.json();const percent=Math.max(0,Math.min(100,Number(payload.completedPercent||0)));const now=new Date().toISOString();await db.prepare('INSERT INTO learning_progress (user_id,card_id,payload_json,completed_percent,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,card_id) DO UPDATE SET payload_json=excluded.payload_json,completed_percent=excluded.completed_percent,updated_at=excluded.updated_at').bind(userId,payload.cardId,JSON.stringify(payload),percent,now).run();return json({...payload,completedPercent:percent,updatedAt:now});}}
  if(segments[0]==='recordings'&&segments.length===2){const userId=scopedUser(request,segments[1]);if(!userId)return json({error:'无权访问该录音记录'},403);if(method==='POST'){const payload:any=await request.json();const record={id:crypto.randomUUID(),userId,cardId:payload.cardId,targetSentence:payload.targetSentence,mime:payload.mime||null,size:Number(payload.size||0),status:'uploaded',createdAt:new Date().toISOString()};await db.prepare('INSERT INTO recording_submissions (id,user_id,card_id,target_sentence,mime,size,status,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(record.id,userId,record.cardId,record.targetSentence,record.mime,record.size,record.status,record.createdAt).run();return json(record,201);}}
  return json({error:'Not found'},404);
}

export const GET=handle;export const POST=handle;export const PUT=handle;export const PATCH=handle;export const DELETE=handle;
export async function OPTIONS(){return new Response(null,{status:204,headers:{'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type,authorization'}});}
