import { env } from 'cloudflare:workers';
import { createDictionaryService, DEFAULT_NEGATIVE_TTL_MS, DEFAULT_POSITIVE_TTL_MS, DEFAULT_STALE_TTL_MS } from '../../../lib/dictionary/service.ts';
import { createFreeDictionaryAdapter } from '../../../lib/dictionary/free-dictionary-adapter.ts';
import { buildCatalogFromIndex, catalogCategory } from '../../../lib/catalog/catalog.ts';
import { createD1PublicationStore } from '../../../lib/catalog/d1-publication-store.ts';
import { createPublicationIndex, phraseCandidates, publicationLexeme, reviewPhraseCandidate } from '../../../lib/catalog/publication-index.ts';
import { createD1DictionaryCache, createD1EcdictAdapter } from '../../../lib/infrastructure/d1-dictionary-adapters.ts';
import { createD1HealthDependencies } from '../../../lib/infrastructure/d1-adapter.ts';
import { createHealthService, liveness } from '../../../lib/infrastructure/health.ts';
import { createStructuredObserver } from '../../../lib/infrastructure/observability.ts';
import { createR2ObjectStorage } from '../../../lib/infrastructure/r2-object-storage.ts';
import { validateProductionConfig } from '../../../lib/infrastructure/config.ts';
import { canonicalStructure, cardSlug } from '../../../lib/content/card-normalization.ts';
import { createHttpPronunciationSourceAdapter, loadPronunciationAudio, PronunciationProxyError } from '../../../lib/pronunciation/proxy-adapter.ts';

type RouteContext = { params: Promise<{ path: string[] }> };
type Card = Record<string, any>;
const normalizeWord = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, '');
const categoryFor = catalogCategory;

const cacheDuration=(value:unknown,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:fallback;};
const DICTIONARY_TTL=cacheDuration(env.DICTIONARY_POSITIVE_TTL_MS,DEFAULT_POSITIVE_TTL_MS);
const DICTIONARY_NEGATIVE_TTL=cacheDuration(env.DICTIONARY_NEGATIVE_TTL_MS,DEFAULT_NEGATIVE_TTL_MS);
const DICTIONARY_STALE_TTL=cacheDuration(env.DICTIONARY_STALE_TTL_MS,DEFAULT_STALE_TTL_MS);
const externalDictionary=createFreeDictionaryAdapter();
const pronunciationSource=createHttpPronunciationSourceAdapter({hosts:['api.dictionaryapi.dev','ssl.gstatic.com']});
const observe=createStructuredObserver(record=>console.info('operational_metric',JSON.stringify(record)));
const json = (body: unknown, status=200) => Response.json(body, { status, headers: { 'cache-control':'no-store' } });

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

function requestUser(request: Request) {
  const id=request.headers.get('oai-authenticated-user-id'); const email=request.headers.get('oai-authenticated-user-email');
  return id&&email?{id,email,role:'student',createdAt:new Date().toISOString()}:null;
}
function canPreviewVocabulary(request:Request){const token=String(env.CONTENT_EDITOR_PREVIEW_TOKEN||'');return Boolean(token&&request.headers.get('authorization')===`Bearer ${token}`);}
function scopedUser(request:Request,requested:string){const user=requestUser(request);if(user)return requested==='demo'||requested===user.id?user.id:null;return requested==='demo'?'demo':null;}
const cardRecord=(row:any)=>({id:row.id,slug:row.slug,seriesId:row.series_id,courseId:row.course_id,topic:row.topic,theme:row.theme,day:row.day,level:row.level,title:row.title,articleStructure:row.article_structure,image:row.image,status:row.status,updatedAt:row.updated_at});

async function handle(request:Request,context:RouteContext){
  const segments=(await context.params).path||[];const path='/'+segments.join('/');const method=request.method;const url=new URL(request.url);
  if(path==='/live'&&method==='GET')return json(liveness());
  const configErrors=validateProductionConfig(env);
  if(configErrors.length)return json({status:'degraded',errors:configErrors},503);
  const db=env.DB;
  const storage=createR2ObjectStorage(env.FILES);
  const health=createHealthService(createD1HealthDependencies(db,storage));
  if(path==='/health'&&method==='GET'){
    const readiness=await health.readiness();
    return json(readiness,readiness.status==='ready'?200:503);
  }
  if(segments[0]==='media'&&segments.length>1){
    const key=segments.slice(1).join('/');
    if(method==='GET'){
      const asset=await storage.get(key);if(!asset)return json({error:'Media asset not found'},404);
      return new Response(asset.body.slice().buffer,{headers:{'content-type':asset.contentType,'cache-control':'public, max-age=31536000, immutable'}});
    }
    if(method==='PUT'){
      if(!canPreviewVocabulary(request))return json({error:'Media upload authorization required'},403);
      const contentType=String(request.headers.get('content-type')||'');if(!/^(?:image|audio)\//.test(contentType))return json({error:'Only image and audio assets are supported'},415);
      const body=new Uint8Array(await request.arrayBuffer());if(!body.byteLength||body.byteLength>5_000_000)return json({error:'Media asset must be between 1 byte and 5 MB'},413);
      await storage.put(key,body,{contentType});const stored=await storage.get(key);
      return json({key,contentType:stored?.contentType||contentType,size:stored?.size||0},201);
    }
  }
  const publicationIndex=createPublicationIndex(createD1PublicationStore(db));
  if(path==='/pronunciation'&&method==='GET'){
    const word=normalizeWord(url.searchParams.get('word'));const region=String(url.searchParams.get('region')||'');
    if(!word||word.length>80||!['us','uk'].includes(region))return json({error:'请输入有效的发音词和口音'},400);
    try{
      const audio=await loadPronunciationAudio({word,region:region as 'us'|'uk',resolveEntry:lexeme=>externalDictionary(lexeme,'en'),source:pronunciationSource});
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
  if(path==='/cards'&&method==='POST'){const raw:any=await request.json();const result=validateCard(raw);if(!result.valid)return json(result,422);const structure=canonicalStructure(raw.articleStructure||raw.structure);const card={...raw,articleStructure:structure,structure,status:'draft'};const now=new Date().toISOString();await db.prepare('INSERT OR REPLACE INTO cards (id,slug,series_id,course_id,topic,theme,day,level,title,big_question,article_structure,image,content_json,status,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(card.cardId,cardSlug(card),card.seriesId||card.courseId,card.courseId,card.topic,card.theme,card.day,card.level,card.title,card.bigQuestion||'',structure,card.image_file||card.image||'day001-flower.png',JSON.stringify(card),'draft',now).run();await publicationIndex.synchronize({...card,cardId:card.cardId,slug:cardSlug(card)});return json({id:card.cardId,status:'draft',validation:result},201);}
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
    const localOnly=url.searchParams.get('source')==='local';
    if(!['en','zh'].includes(language))return json({error:'词典语言只支持 en 或 zh'},400);
    if(!lookup||lookup.length>80||!/^[a-z]+(?:['-][a-z]+)*(?:\s+[a-z]+(?:['-][a-z]+)*)*$/.test(lookup))return json({error:'请输入有效的英文单词或短语'},400);
    if(surfaceForm.length>80||courseId.length>80||sentence.length>500||alternateScopes.length>16||alternateScopes.some(scope=>scope.length>80))return json({error:'查词范围、课程或句子上下文过长'},400);
    const indexed=(await publicationIndex.lookup(lookup,{courseId}))[0]||null;
    const knownCategory=categoryFor(lookup);const base={word:indexed?.english||requested.toLowerCase(),category:knownCategory||indexed?.membership||'reference',meaning:indexed?.meaning||'',image:indexed?.image||'',illustration:indexed?.illustration||null,pronunciations:indexed?.pronunciations||[],sources:indexed?.sources||[]};
    const unifiedService=createDictionaryService({
      catalog:{categoryFor:word=>categoryFor(word)||((indexed&&indexed.lexeme===publicationLexeme(word))?indexed.membership:null),courseFor:word=>indexed&&indexed.lexeme===publicationLexeme(word)?{lexeme:indexed.lexeme,meaning:base.meaning,image:base.image,illustration:base.illustration,pronunciations:base.pronunciations,sources:base.sources}:null},
      provider:localOnly?async()=>null:language==='zh'?createD1EcdictAdapter(db):externalDictionary,
      cache:localOnly?undefined:createD1DictionaryCache(db,DICTIONARY_STALE_TTL),
      positiveTtlMs:DICTIONARY_TTL,
      negativeTtlMs:DICTIONARY_NEGATIVE_TTL,
      staleTtlMs:DICTIONARY_STALE_TTL,
      observe:localOnly?undefined:metric=>observe(metric),
    });
    try{const result=await unifiedService.lookup({surfaceForm,scope:lookup,alternateScopes,courseId,sentence,language});if(localOnly&&language==='en')result.sourceStatus.blocks.externalDictionary='not_requested';return json(result);}catch(error:any){return json({error:error.message,code:error.code},error.status||500);}
  }
  if(path==='/dashboard'&&method==='GET'){const [seriesCount,cardCount,publishedCount,progressCount,recordingCount,cards,series]=await Promise.all([db.prepare('SELECT COUNT(*) count FROM series').first<any>(),db.prepare('SELECT COUNT(*) count FROM cards').first<any>(),db.prepare("SELECT COUNT(*) count FROM cards WHERE status='published'").first<any>(),db.prepare('SELECT COUNT(*) count FROM learning_progress').first<any>(),db.prepare('SELECT COUNT(*) count FROM recording_submissions').first<any>(),db.prepare('SELECT * FROM cards ORDER BY day').all(),db.prepare('SELECT * FROM series ORDER BY sort_order').all()]);return json({counts:{series:seriesCount?.count||0,cards:cardCount?.count||0,published:publishedCount?.count||0,users:0,progress:progressCount?.count||0,recordings:recordingCount?.count||0},cards:(cards.results||[]).map(cardRecord),series:(series.results||[]).map((row:any)=>({id:row.id,name:row.name,subtitle:row.subtitle,description:row.description,sort:row.sort_order,status:row.status}))});}
  if(segments[0]==='progress'&&segments.length===2){const userId=scopedUser(request,segments[1]);if(!userId)return json({error:'无权访问该学习记录'},403);if(method==='GET'){const rows=await db.prepare('SELECT card_id,payload_json,completed_percent,updated_at FROM learning_progress WHERE user_id=?').bind(userId).all();const cards:Record<string,any>={};for(const row of rows.results||[]){const item:any=row;cards[item.card_id]={...JSON.parse(item.payload_json),completedPercent:item.completed_percent,updatedAt:item.updated_at};}return json({cards});}if(method==='PUT'||method==='POST'){const payload:any=await request.json();const percent=Math.max(0,Math.min(100,Number(payload.completedPercent||0)));const now=new Date().toISOString();await db.prepare('INSERT INTO learning_progress (user_id,card_id,payload_json,completed_percent,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,card_id) DO UPDATE SET payload_json=excluded.payload_json,completed_percent=excluded.completed_percent,updated_at=excluded.updated_at').bind(userId,payload.cardId,JSON.stringify(payload),percent,now).run();return json({...payload,completedPercent:percent,updatedAt:now});}}
  if(segments[0]==='recordings'&&segments.length===2){const userId=scopedUser(request,segments[1]);if(!userId)return json({error:'无权访问该录音记录'},403);if(method==='POST'){const payload:any=await request.json();const record={id:crypto.randomUUID(),userId,cardId:payload.cardId,targetSentence:payload.targetSentence,mime:payload.mime||null,size:Number(payload.size||0),status:'uploaded',createdAt:new Date().toISOString()};await db.prepare('INSERT INTO recording_submissions (id,user_id,card_id,target_sentence,mime,size,status,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(record.id,userId,record.cardId,record.targetSentence,record.mime,record.size,record.status,record.createdAt).run();return json(record,201);}}
  return json({error:'Not found'},404);
}

export const GET=handle;export const POST=handle;export const PUT=handle;export const PATCH=handle;export const DELETE=handle;
export async function OPTIONS(){return new Response(null,{status:204,headers:{'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','access-control-allow-headers':'content-type,authorization'}});}
