import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './db/store.js';
import { createHash, randomUUID } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const progressFile = path.join(root, 'data', 'progress.json');
const usersFile = path.join(root, 'data', 'users.json');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.css':'text/css; charset=utf-8' };
const store = createStore(root);
const cardDataFiles = async () => (await fs.readdir(root)).filter(x => x.endsWith('.json') && !['package.json'].includes(x));
async function readCards() { const cards=[]; for (const name of await cardDataFiles()) { try { const card=JSON.parse(await fs.readFile(path.join(root,name),'utf8')); if(card.cardId) cards.push(card); } catch {} } return cards; }
async function readSeriesSeed() { try { return JSON.parse(await fs.readFile(path.join(root, 'data', 'series.json'), 'utf8')); } catch { return []; } }
const cardSlug = card => card.slug || `${String(card.courseId || 'course').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${String(card.day || card.cardId).toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${String(card.title || card.cardId).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`.replace(/-+/g,'-').replace(/^-|-$/g,'');
async function syncCardCatalog(cards) {
  const db = await store.load(); let changed = false;
  for (const card of cards) {
    const id = card.cardId; const existing = db.cards[id] || {};
    const record = { id, slug: cardSlug(card), seriesId: card.seriesId || card.courseId, courseId: card.courseId, topic: card.topic, theme: card.theme, day: card.day, level: card.level, title: card.title, articleStructure: normalizeStructure(card.articleStructure || card.structure), image: card.image_file || card.image, status: card.status || 'draft', contentFile: `${id}.json`, updatedAt: card.updatedAt || new Date().toISOString() };
    if (JSON.stringify(existing) !== JSON.stringify(record)) { db.cards[id] = record; changed = true; }
  }
  if (changed) await store.save(db); return db;
}

async function readProgress() {
  try { return JSON.parse(await fs.readFile(progressFile, 'utf8')); }
  catch { return { users: {} }; }
}
async function writeProgress(data) {
  await fs.mkdir(path.dirname(progressFile), { recursive: true });
  await fs.writeFile(progressFile, JSON.stringify(data, null, 2));
}
async function readUsers() { try { return JSON.parse(await fs.readFile(usersFile, 'utf8')); } catch { return { users: {} }; } }
async function writeUsers(data) { await fs.mkdir(path.dirname(usersFile), { recursive: true }); await fs.writeFile(usersFile, JSON.stringify(data, null, 2)); }
function json(res, status, body) { res.writeHead(status, { 'content-type': mime['.json'], 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization' }); res.end(JSON.stringify(body)); }
const passwordHash = value => createHash('sha256').update(String(value)).digest('hex');
const publicUser = user => user ? { id:user.id, email:user.email, role:user.role, createdAt:user.createdAt } : null;
function bearer(req) { const value=String(req.headers.authorization||''); return value.startsWith('Bearer ') ? value.slice(7) : ''; }
async function authenticated(req, db=null) {
  const data=db||await store.load(); const session=data.sessions?.[bearer(req)];
  if(!session)return null; return Object.values(data.users||{}).find(user=>user.id===session.userId)||null;
}
async function scopedUser(req, requested, db=null) {
  if(requested==='demo')return 'demo'; const user=await authenticated(req,db); return user?.id===requested ? requested : null;
}
const ARTICLE_STRUCTURES = new Set(['Feature-Function','Cause-Effect','Process/Life cycle','Compare-Contrast','Fact/Explanation']);
const STRUCTURE_ALIASES = new Map([
  ['feature / function','Feature-Function'],['feature → function','Feature-Function'],['feature-function','Feature-Function'],
  ['cause / effect','Cause-Effect'],['cause → effect','Cause-Effect'],['cause-effect','Cause-Effect'],
  ['process / life cycle','Process/Life cycle'],['process/life cycle','Process/Life cycle'],
  ['compare / contrast','Compare-Contrast'],['compare-contrast','Compare-Contrast'],
  ['fact / explanation','Fact/Explanation'],['fact/explanation','Fact/Explanation']
]);
function normalizeStructure(value) { return STRUCTURE_ALIASES.get(String(value||'').trim().toLowerCase()) || null; }
function validateCard(card) {
  const errors = [];
  for (const field of ['cardId','courseId','topic','theme','day','level','title','paragraphs','word_bank']) if (card?.[field] == null) errors.push(`Missing required field: ${field}`);
  if (card?.cardId && !/^[a-z0-9][a-z0-9-]{1,80}$/.test(card.cardId)) errors.push('cardId must be a slug-safe id');
  if (card?.level && !['L1','L2','L3'].includes(card.level)) errors.push('level must be L1, L2, or L3');
  const structure = card?.articleStructure || card?.structure;
  if (!structure || !normalizeStructure(structure) || !ARTICLE_STRUCTURES.has(normalizeStructure(structure))) errors.push('Invalid Article Structure');
  if (card?.paragraphs && (!Array.isArray(card.paragraphs) || card.paragraphs.length === 0)) errors.push('paragraphs must be a non-empty array');
  if (card?.word_bank && (!Array.isArray(card.word_bank) || card.word_bank.length < 5 || card.word_bank.length > 6)) errors.push('word_bank must contain 5-6 words');
  if (card?.comprehension?.questions) {
    if (card.comprehension.questions.length !== 3) errors.push('Comprehension must contain exactly 3 questions');
    const types=['Whole','Connection','Transfer'];
    card.comprehension.questions.forEach((q, i) => {
      const options=Array.isArray(q.options)?q.options:Object.keys(q.options||{});
      if (!['A','B','C'].includes(q.answer)) errors.push(`Question ${i + 1} answer must be A/B/C`);
      if (options.length !== 3) errors.push(`Question ${i + 1} must contain exactly 3 options`);
      if (q.type && q.type !== types[i]) errors.push(`Question ${i + 1} type must be ${types[i]}`);
    });
  }
  else errors.push('Comprehension must contain exactly 3 questions');
  if (!Array.isArray(card?.rebuild?.steps) || card.rebuild.steps.length < 3) errors.push('rebuild.steps must contain at least 3 items');
  return { valid: errors.length === 0, errors };
}
async function body(req) { let raw=''; for await (const chunk of req) raw += chunk; return raw ? JSON.parse(raw) : {}; }

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin':'*', 'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-allow-headers':'content-type, authorization' }); return res.end(); }
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok:true, service:'fluent-api' });
    if (req.method === 'POST' && (url.pathname === '/api/auth/register' || url.pathname === '/api/auth/login')) {
      const payload = await body(req); const email = String(payload.email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email) || String(payload.password || '').length < 6) return json(res, 400, { error:'请输入有效邮箱和至少 6 位密码' });
      const db = await store.load(); const users = { users: db.users };
      if (url.pathname.endsWith('register') && users.users[email]) return json(res, 409, { error:'该邮箱已经注册' });
      if (url.pathname.endsWith('login') && (!users.users[email] || users.users[email].passwordHash !== passwordHash(payload.password))) return json(res, 401, { error:'邮箱或密码不正确' });
      users.users[email] ||= { id: randomUUID(), email, passwordHash: passwordHash(payload.password), role:'student', createdAt: new Date().toISOString() };
      const token=randomUUID(); db.users = users.users; db.sessions||={}; db.sessions[token]={userId:users.users[email].id,createdAt:new Date().toISOString()}; await store.save(db);
      return json(res, 200, { user: publicUser(users.users[email]), token });
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/me') {
      const db=await store.load(); const user=await authenticated(req,db); if(!user)return json(res,401,{error:'请先登录'});
      const records=Object.values(db.progress[user.id]?.cards||{}); const completed=records.filter(item=>Number(item.completedPercent||0)>=100).length;
      const average=records.length?Math.round(records.reduce((sum,item)=>sum+Number(item.completedPercent||0),0)/records.length):0;
      return json(res,200,{user:publicUser(user),summary:{started:records.length,completed,average,recent:records.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,5)}});
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') { const db=await store.load(); const token=bearer(req); if(token&&db.sessions?.[token]){delete db.sessions[token];await store.save(db);} return json(res,200,{ok:true}); }
    if (req.method === 'GET' && url.pathname === '/api/series') {
      const cards = await readCards(); const db = await syncCardCatalog(cards); const definitions = (db.series && db.series.length ? db.series : await readSeriesSeed());
      const catalog = Object.values(db.cards || {}); const series = definitions.map(s => ({ ...s, cardCount: catalog.filter(c => String(c.seriesId || c.courseId) === String(s.id) && String(c.status).toLowerCase() === 'published').length })).filter(s => String(s.status).toLowerCase() === 'published' && s.cardCount > 0).sort((a,b) => (a.sort || 0) - (b.sort || 0));
      return json(res, 200, { series });
    }
    if (req.method === 'POST' && url.pathname === '/api/series') {
      const payload = await body(req); const id = String(payload.id || '').trim(); const name = String(payload.name || '').trim();
      if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(id) || !name) return json(res, 400, { error:'id and name are required; id must be slug-safe' });
      const db = await store.load(); if (db.series.some(s => s.id === id)) return json(res, 409, { error:'Series already exists' });
      const series = { id, name, subtitle: payload.subtitle || '', description: payload.description || '', sort: Number(payload.sort || 0), status: payload.status || 'draft', createdAt: new Date().toISOString() }; db.series.push(series); await store.save(db); return json(res, 201, series);
    }
    const seriesMatch = url.pathname.match(/^\/api\/series\/([A-Za-z0-9_-]+)$/);
    if (seriesMatch && (req.method === 'PUT' || req.method === 'PATCH')) {
      const db = await store.load(); const series = db.series.find(s => s.id === seriesMatch[1]); if (!series) return json(res, 404, { error:'Series not found' });
      const payload = await body(req); Object.assign(series, { ...payload, id: series.id, updatedAt: new Date().toISOString() }); await store.save(db); return json(res, 200, series);
    }
    if (seriesMatch && req.method === 'DELETE') {
      const db = await store.load(); const index = db.series.findIndex(s => s.id === seriesMatch[1]); if (index < 0) return json(res, 404, { error:'Series not found' });
      db.series[index].status = 'archived'; db.series[index].updatedAt = new Date().toISOString(); await store.save(db); return json(res, 200, db.series[index]);
    }
    if (req.method === 'GET' && url.pathname === '/api/cards') {
      const db = await syncCardCatalog(await readCards()); const cards = Object.values(db.cards);
      const seriesId = url.searchParams.get('seriesId');
      return json(res, 200, { cards: seriesId ? cards.filter(c => c.seriesId === seriesId && c.status === 'published') : cards });
    }
    if (req.method === 'GET' && url.pathname === '/api/words') {
      const cards=(await readCards()).filter(card=>card.status==='published'); const map=new Map();
      for(const card of cards) for(const word of card.word_bank||[]){const key=String(word.english||'').toLowerCase();if(!key)continue;const entry=map.get(key)||{english:word.english,meaning:word.chinese||word.meaning||'',sources:[]};entry.sources.push({cardId:card.cardId,slug:cardSlug(card),title:card.title,theme:card.theme});map.set(key,entry);}
      return json(res,200,{words:[...map.values()].sort((a,b)=>a.english.localeCompare(b.english))});
    }
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const cards=await readCards(); const db=await syncCardCatalog(cards); const progress=Object.values(db.progress||{}).flatMap(user=>Object.values(user.cards||{}));
      return json(res,200,{counts:{series:db.series.length,cards:cards.length,published:cards.filter(card=>card.status==='published').length,users:Object.keys(db.users||{}).length,progress:progress.length,recordings:db.recordings.length},series:db.series,cards:Object.values(db.cards),recordings:db.recordings.slice(-10).reverse()});
    }
    if (req.method === 'POST' && url.pathname === '/api/cards/validate') { const payload = await body(req); return json(res, 200, validateCard(payload)); }
    if (req.method === 'POST' && url.pathname === '/api/cards') {
      const payload = await body(req); const result = validateCard(payload); if (!result.valid) return json(res, 422, result);
      const id = payload.cardId; const articleStructure=normalizeStructure(payload.articleStructure||payload.structure); const card={...payload,articleStructure,structure:articleStructure,status:'draft',updatedAt:new Date().toISOString()}; await fs.writeFile(path.join(root, `${id}.json`), JSON.stringify(card, null, 2));
      const db = await syncCardCatalog([card]); await store.save(db);
      return json(res, 201, { id, status: 'draft', validation: result });
    }
    const publishMatch = url.pathname.match(/^\/api\/cards\/([A-Za-z0-9_-]+)\/(publish|archive)$/);
    if (publishMatch && (req.method === 'POST' || req.method === 'PUT')) {
      const id = publishMatch[1]; const file = path.join(root, `${id}.json`); const card = JSON.parse(await fs.readFile(file, 'utf8')); const canonical=normalizeStructure(card.articleStructure||card.structure); if(canonical){card.articleStructure=canonical;card.structure=canonical;} const result = validateCard(card);
      if (publishMatch[2] === 'publish' && !result.valid) return json(res, 422, result);
      card.status = publishMatch[2] === 'publish' ? 'published' : 'archived'; card.updatedAt = new Date().toISOString(); await fs.writeFile(file, JSON.stringify(card, null, 2));
      const db = await syncCardCatalog([card]); db.cards[id].status = card.status; db.cards[id].updatedAt = card.updatedAt; await store.save(db);
      return json(res, 200, { id, status: card.status });
    }
    const cardMatch = url.pathname.match(/^\/api\/cards\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && cardMatch) {
      const card = (await readCards()).find(c => c.cardId === cardMatch[1] || cardSlug(c) === cardMatch[1]);
      if (!card) return json(res, 404, { error:'Card not found' }); return json(res, 200, { ...card, slug:cardSlug(card) });
    }
    const lessonMatch = url.pathname.match(/^\/lesson\/([A-Za-z0-9_-]+)$/);
    if (req.method === 'GET' && lessonMatch) {
      const card = (await readCards()).find(c => c.cardId === lessonMatch[1] || cardSlug(c) === lessonMatch[1]);
      if (!card) return json(res, 404, { error:'Lesson not found' });
      const content = await fs.readFile(path.join(root, 'index.html')); res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(content);
    }
    const progressMatch = url.pathname.match(/^\/api\/progress\/([A-Za-z0-9_-]+)$/);
    if (progressMatch && req.method === 'GET') {
      const data = await store.load(); const userId=await scopedUser(req,progressMatch[1],data); if(!userId)return json(res,403,{error:'无权访问该学习记录'}); return json(res, 200, data.progress[userId] || { cards:{} });
    }
    if (progressMatch && (req.method === 'PUT' || req.method === 'POST')) {
      const data = await store.load(); const userId=await scopedUser(req,progressMatch[1],data); if(!userId)return json(res,403,{error:'无权修改该学习记录'}); data.progress[userId] ||= { cards:{} };
      const payload = await body(req); const cardId = payload.cardId || 'day001-flower';
      if(!data.cards[cardId] && !(await readCards()).some(card=>card.cardId===cardId))return json(res,404,{error:'Card not found'});
      const completedPercent=Math.max(0,Math.min(100,Number(payload.completedPercent||0)));
      data.progress[userId].cards[cardId] = { ...(data.progress[userId].cards[cardId] || {}), ...payload, completedPercent, updatedAt:new Date().toISOString() };
      await store.save(data); return json(res, 200, data.progress[userId].cards[cardId]);
    }
    const recordingMatch = url.pathname.match(/^\/api\/recordings\/([A-Za-z0-9_-]+)$/);
    if (recordingMatch && req.method === 'POST') {
      const db = await store.load(); const userId=await scopedUser(req,recordingMatch[1],db); if(!userId)return json(res,403,{error:'无权提交该录音'}); const payload = await body(req); const id = randomUUID(); db.recordings.push({ id, userId, ...payload, status:'uploaded', createdAt:new Date().toISOString() }); await store.save(db);
      return json(res, 201, db.recordings.at(-1));
    }
    if (recordingMatch && req.method === 'GET') { const db = await store.load(); const userId=await scopedUser(req,recordingMatch[1],db); if(!userId)return json(res,403,{error:'无权访问该录音记录'}); return json(res, 200, db.recordings.filter(x => x.userId === userId)); }
    if (req.method !== 'GET') return json(res, 405, { error:'Method not allowed' });
    const filePath = path.resolve(root, url.pathname === '/' ? 'syllabus.html' : url.pathname.slice(1));
    if (filePath !== root && !filePath.startsWith(root + path.sep)) return json(res, 403, { error:'Forbidden' });
    const content = await fs.readFile(filePath); res.writeHead(200, { 'content-type': mime[path.extname(filePath)] || 'application/octet-stream' }); res.end(content);
  } catch (error) { json(res, 404, { error: error.code === 'ENOENT' ? 'Not found' : error.message }); }
});
server.listen(port, () => console.log(`Fluent server running at http://localhost:${port}`));
