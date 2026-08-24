import { env } from 'cloudflare:workers';
import flower from '../../../day001-flower.json';
import cactus from '../../../science-reader-100-how-a-cactus-saves-water.json';
import level2Words from '../../../data/vocabulary-level2.json';
import level3Words from '../../../data/vocabulary-level3.json';

type RouteContext = { params: Promise<{ path: string[] }> };
type Card = Record<string, any>;
const seedCards: Card[] = [flower, cactus];
const normalizeWord = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, '');
const aliasesForEntry = (entry: string) => {
  const match=entry.match(/^([^()]+?)(?:\s*\(([^)]*)\))?$/); const aliases=new Set<string>();
  const base=(match?.[1]||entry).trim(); base.split(/\s*\/\s*/).map(normalizeWord).filter(Boolean).forEach(word=>aliases.add(word));
  const note=(match?.[2]||'').trim();
  if(note){const variants=/\bAmE\b/i.test(note)?note.split(/\bAmE\b/i):note.split(',');variants.map(value=>normalizeWord(value.replace(/^pl\.\s*/i,'').replace(/^=\s*/,''))).filter(Boolean).forEach(word=>aliases.add(word));}
  return [...aliases].filter(Boolean);
};
const level2Aliases = new Set((level2Words as string[]).flatMap(aliasesForEntry));
const level3Aliases = new Set((level3Words as string[]).flatMap(aliasesForEntry).filter(word => !level2Aliases.has(word)));
const categoryFor = (word: unknown) => level2Aliases.has(normalizeWord(word)) ? 'level2' : level3Aliases.has(normalizeWord(word)) ? 'level3' : null;

function buildWordCatalog(cards: Card[]) {
  const science = new Map<string, any>();
  for (const card of cards) for (const word of card.word_bank || []) {
    const key = normalizeWord(word.english); if (!key || categoryFor(key)) continue;
    const entry = science.get(key) || { english:word.english, meaning:word.chinese || word.meaning || '', category:'science', sources:[] };
    if (!entry.meaning) entry.meaning = word.chinese || word.meaning || '';
    if (card.status === 'published') entry.sources.push({ cardId:card.cardId, slug:card.slug || slugFor(card), title:card.title, theme:card.theme });
    science.set(key, entry);
  }
  const level2 = (level2Words as string[]).map(english => ({ english, meaning:'', category:'level2', sources:[] }));
  const level3 = (level3Words as string[]).map(english => ({ english, meaning:'', category:'level3', sources:[] }));
  const scienceWords = [...science.values()].sort((a,b) => a.english.localeCompare(b.english));
  return { words:[...level2, ...level3, ...scienceWords], counts:{ level2:level2.length, level3:level3.length, science:scienceWords.length } };
}

async function fetchDictionary(word: string) {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { headers:{ accept:'application/json' }, signal:AbortSignal.timeout(6000) });
  if (!response.ok) return null;
  const data:any = await response.json(); const entry = Array.isArray(data) ? data[0] : null; if (!entry) return null;
  const audio = (entry.phonetics || []).find((item:any) => item.audio)?.audio || '';
  return {
    phonetic:entry.phonetic || (entry.phonetics || []).find((item:any) => item.text)?.text || '',
    audio:audio.startsWith('//') ? `https:${audio}` : audio,
    meanings:(entry.meanings || []).slice(0,4).map((meaning:any) => ({ partOfSpeech:meaning.partOfSpeech || '', definitions:(meaning.definitions || []).slice(0,2).map((item:any) => ({ definition:item.definition || '', example:item.example || '' })) }))
  };
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
  ]);
  const now=new Date().toISOString();
  await db.prepare('INSERT OR IGNORE INTO series (id,name,subtitle,description,sort_order,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind('science-reading','Science Reading','Nature, life science, and science stories','Learn science English through reading, listening, and practice',10,'published',now,now).run();
  for(const raw of seedCards){const card={...raw,articleStructure:canonicalStructure(raw.articleStructure||raw.structure),structure:canonicalStructure(raw.articleStructure||raw.structure)};await db.prepare('INSERT OR IGNORE INTO cards (id,slug,series_id,course_id,topic,theme,day,level,title,big_question,article_structure,image,content_json,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(card.cardId,slugFor(card),card.seriesId||card.courseId,card.courseId,card.topic,card.theme,card.day,card.level,card.title,card.bigQuestion||'',card.articleStructure,card.image_file||card.image,JSON.stringify(card),card.status||'published',now).run();}
}

function requestUser(request: Request) {
  const id=request.headers.get('oai-authenticated-user-id'); const email=request.headers.get('oai-authenticated-user-email');
  return id&&email?{id,email,role:'student',createdAt:new Date().toISOString()}:null;
}
function scopedUser(request:Request,requested:string){const user=requestUser(request);if(user)return requested==='demo'||requested===user.id?user.id:null;return requested==='demo'?'demo':null;}
const cardRecord=(row:any)=>({id:row.id,slug:row.slug,seriesId:row.series_id,courseId:row.course_id,topic:row.topic,theme:row.theme,day:row.day,level:row.level,title:row.title,articleStructure:row.article_structure,image:row.image,status:row.status,updatedAt:row.updated_at});

async function handle(request:Request,context:RouteContext){
  const db=env.DB;if(!db)return json({error:'Database binding unavailable'},503);await ensureDatabase(db);
  const segments=(await context.params).path||[];const path='/'+segments.join('/');const method=request.method;const url=new URL(request.url);
  if(path==='/health'&&method==='GET')return json({ok:true,service:'fluent-sites-api'});
  if(path==='/auth/me'&&method==='GET'){const user=requestUser(request);if(!user)return json({error:'请先使用 ChatGPT 登录'},401);const rows=await db.prepare('SELECT payload_json,completed_percent,updated_at FROM learning_progress WHERE user_id=? ORDER BY updated_at DESC').bind(user.id).all();const recent=(rows.results||[]).map((row:any)=>({...JSON.parse(row.payload_json),completedPercent:row.completed_percent,updatedAt:row.updated_at}));const average=recent.length?Math.round(recent.reduce((sum:number,item:any)=>sum+Number(item.completedPercent||0),0)/recent.length):0;return json({user,summary:{started:recent.length,completed:recent.filter((item:any)=>item.completedPercent>=100).length,average,recent:recent.slice(0,5)}});}
  if(path==='/auth/logout'&&method==='POST')return json({ok:true,platformAuth:true});
  if((path==='/auth/login'||path==='/auth/register')&&method==='POST')return json({error:'正式站点使用 ChatGPT 登录，请通过站点登录入口继续。'},400);
  if(path==='/series'&&method==='GET'){const rows=await db.prepare("SELECT s.*, COUNT(c.id) card_count FROM series s LEFT JOIN cards c ON c.series_id=s.id AND c.status='published' WHERE s.status='published' GROUP BY s.id HAVING card_count>0 ORDER BY s.sort_order").all();return json({series:(rows.results||[]).map((row:any)=>({id:row.id,name:row.name,subtitle:row.subtitle,description:row.description,sort:row.sort_order,status:row.status,cardCount:row.card_count}))});}
  if(path==='/series'&&method==='POST'){const body:any=await request.json();if(!/^[a-z0-9][a-z0-9-]{1,80}$/.test(body.id||'')||!String(body.name||'').trim())return json({error:'id and name are required; id must be slug-safe'},400);const now=new Date().toISOString();try{await db.prepare('INSERT INTO series (id,name,subtitle,description,sort_order,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(body.id,body.name,body.subtitle||'',body.description||'',Number(body.sort||0),body.status||'draft',now,now).run();return json({...body,createdAt:now},201);}catch{return json({error:'Series already exists'},409);}}
  const seriesId=segments[0]==='series'&&segments.length===2?segments[1]:null;
  if(seriesId&&method==='DELETE'){await db.prepare("UPDATE series SET status='archived', updated_at=? WHERE id=?").bind(new Date().toISOString(),seriesId).run();return json({id:seriesId,status:'archived'});}
  if(path==='/cards'&&method==='GET'){const series=url.searchParams.get('seriesId');const query=series?db.prepare("SELECT * FROM cards WHERE series_id=? AND status='published' ORDER BY day").bind(series):db.prepare('SELECT * FROM cards ORDER BY day');const rows=await query.all();return json({cards:(rows.results||[]).map(cardRecord)});}
  if(path==='/cards/validate'&&method==='POST')return json(validateCard(await request.json() as Card));
  if(path==='/cards'&&method==='POST'){const raw:any=await request.json();const result=validateCard(raw);if(!result.valid)return json(result,422);const structure=canonicalStructure(raw.articleStructure||raw.structure);const card={...raw,articleStructure:structure,structure,status:'draft'};const now=new Date().toISOString();await db.prepare('INSERT OR REPLACE INTO cards (id,slug,series_id,course_id,topic,theme,day,level,title,big_question,article_structure,image,content_json,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(card.cardId,slugFor(card),card.seriesId||card.courseId,card.courseId,card.topic,card.theme,card.day,card.level,card.title,card.bigQuestion||'',structure,card.image_file||card.image||'day001-flower.png',JSON.stringify(card),'draft',now).run();return json({id:card.cardId,status:'draft',validation:result},201);}
  if(segments[0]==='cards'&&segments.length===3&&['publish','archive'].includes(segments[2])&&method==='POST'){const id=segments[1],status=segments[2]==='publish'?'published':'archived';await db.prepare('UPDATE cards SET status=?, updated_at=? WHERE id=?').bind(status,new Date().toISOString(),id).run();return json({id,status});}
  if(segments[0]==='cards'&&segments.length===2&&method==='GET'){const id=segments[1];const row:any=await db.prepare('SELECT * FROM cards WHERE id=? OR slug=?').bind(id,id).first();if(!row)return json({error:'Card not found'},404);return json({...JSON.parse(row.content_json),slug:row.slug,status:row.status,articleStructure:row.article_structure,structure:row.article_structure});}
  if(path==='/words'&&method==='GET'){
    const rows=await db.prepare("SELECT id,slug,title,theme,status,content_json FROM cards WHERE status!='archived'").all();
    const cards=(rows.results||[]).map((row:any)=>({ ...JSON.parse(String(row.content_json)), cardId:row.id, slug:row.slug, title:row.title, theme:row.theme, status:row.status }));
    return json(buildWordCatalog(cards));
  }
  if(path==='/dictionary'&&method==='GET'){
    const requested=String(url.searchParams.get('word')||'').trim(); const lookup=normalizeWord(requested);
    if(!lookup||lookup.length>80||!/^[a-z]+(?:['-][a-z]+)*(?:\s+[a-z]+(?:['-][a-z]+)*)*$/.test(lookup))return json({error:'请输入有效的英文单词或短语'},400);
    const rows=await db.prepare("SELECT id,slug,title,theme,status,content_json FROM cards WHERE status!='archived'").all();
    const cards=(rows.results||[]).map((row:any)=>({ ...JSON.parse(String(row.content_json)), cardId:row.id, slug:row.slug, title:row.title, theme:row.theme, status:row.status }));
    let local:any=null; const sources:any[]=[];
    for(const card of cards)for(const item of card.word_bank||[]){if(normalizeWord(item.english)!==lookup)continue;local ||= item;if(card.status==='published')sources.push({cardId:card.cardId,slug:card.slug,title:card.title,theme:card.theme});}
    const knownCategory=categoryFor(lookup);let remote:any=null; try{remote=await fetchDictionary(lookup);}catch{}
    if(!remote&&!local&&!knownCategory)return json({error:`暂时没有找到“${requested}”的词典结果，请检查拼写后重试。`},404);
    return json({word:local?.english||requested.toLowerCase(),category:knownCategory||(local?'science':'reference'),meaning:local?.chinese||local?.meaning||'',sources,...(remote||{phonetic:'',audio:'',meanings:[]})});
  }
  if(path==='/dashboard'&&method==='GET'){const [seriesCount,cardCount,publishedCount,progressCount,recordingCount,cards,series]=await Promise.all([db.prepare('SELECT COUNT(*) count FROM series').first<any>(),db.prepare('SELECT COUNT(*) count FROM cards').first<any>(),db.prepare("SELECT COUNT(*) count FROM cards WHERE status='published'").first<any>(),db.prepare('SELECT COUNT(*) count FROM learning_progress').first<any>(),db.prepare('SELECT COUNT(*) count FROM recording_submissions').first<any>(),db.prepare('SELECT * FROM cards ORDER BY day').all(),db.prepare('SELECT * FROM series ORDER BY sort_order').all()]);return json({counts:{series:seriesCount?.count||0,cards:cardCount?.count||0,published:publishedCount?.count||0,users:0,progress:progressCount?.count||0,recordings:recordingCount?.count||0},cards:(cards.results||[]).map(cardRecord),series:(series.results||[]).map((row:any)=>({id:row.id,name:row.name,subtitle:row.subtitle,description:row.description,sort:row.sort_order,status:row.status}))});}
  if(segments[0]==='progress'&&segments.length===2){const userId=scopedUser(request,segments[1]);if(!userId)return json({error:'无权访问该学习记录'},403);if(method==='GET'){const rows=await db.prepare('SELECT card_id,payload_json,completed_percent,updated_at FROM learning_progress WHERE user_id=?').bind(userId).all();const cards:Record<string,any>={};for(const row of rows.results||[]){const item:any=row;cards[item.card_id]={...JSON.parse(item.payload_json),completedPercent:item.completed_percent,updatedAt:item.updated_at};}return json({cards});}if(method==='PUT'||method==='POST'){const payload:any=await request.json();const percent=Math.max(0,Math.min(100,Number(payload.completedPercent||0)));const now=new Date().toISOString();await db.prepare('INSERT INTO learning_progress (user_id,card_id,payload_json,completed_percent,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,card_id) DO UPDATE SET payload_json=excluded.payload_json,completed_percent=excluded.completed_percent,updated_at=excluded.updated_at').bind(userId,payload.cardId,JSON.stringify(payload),percent,now).run();return json({...payload,completedPercent:percent,updatedAt:now});}}
  if(segments[0]==='recordings'&&segments.length===2){const userId=scopedUser(request,segments[1]);if(!userId)return json({error:'无权访问该录音记录'},403);if(method==='POST'){const payload:any=await request.json();const record={id:crypto.randomUUID(),userId,cardId:payload.cardId,targetSentence:payload.targetSentence,mime:payload.mime||null,size:Number(payload.size||0),status:'uploaded',createdAt:new Date().toISOString()};await db.prepare('INSERT INTO recording_submissions (id,user_id,card_id,target_sentence,mime,size,status,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(record.id,userId,record.cardId,record.targetSentence,record.mime,record.size,record.status,record.createdAt).run();return json(record,201);}}
  return json({error:'Not found'},404);
}

export const GET=handle;export const POST=handle;export const PUT=handle;export const PATCH=handle;export const DELETE=handle;
export async function OPTIONS(){return new Response(null,{status:204,headers:{'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type,authorization'}});}
