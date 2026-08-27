export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem('fluent-session') || 'null'); }
  catch { return null; }
}

export function setSession(session) {
  if (session) localStorage.setItem('fluent-session', JSON.stringify(session));
  else localStorage.removeItem('fluent-session');
}

export function currentUserId() {
  return getSession()?.user?.id || 'demo';
}

export function authHeaders(extra = {}) {
  const token = getSession()?.token;
  return token ? { ...extra, authorization: `Bearer ${token}` } : extra;
}

export async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: authHeaders(options.headers || {}) });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) throw new Error(payload?.error || `请求失败（${response.status}）`);
  return payload;
}

let toastTimer;
export function toast(message) {
  let node = $('#globalToast');
  if (!node) {
    node = document.createElement('div');
    node.id = 'globalToast';
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.setAttribute('aria-live', 'polite');
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
}

export function nav(active) {
  return `<header class="site-header">
    <a class="logo" href="/syllabus.html" aria-label="Fluent Science Reading 首页">
      <span class="logo-mark" aria-hidden="true">F</span>
      <span class="logo-copy">Fluent Science Reading<small>Read · Think · Explain</small></span>
    </a>
    <nav class="site-nav" aria-label="主导航">
      <a href="/syllabus.html" ${active === 'courses' ? 'aria-current="page"' : ''}>课程</a>
      <a href="/words" ${active === 'words' ? 'aria-current="page"' : ''}>核心词</a>
      <a href="/account.html" ${active === 'account' ? 'aria-current="page"' : ''}>我的学习</a>
      <a href="/admin.html" ${active === 'admin' ? 'aria-current="page"' : ''}>内容工作台</a>
    </nav>
  </header>`;
}

let bestEnglishVoice = null;
let voiceScanStarted = false;

function scoreVoice(voice) {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (/natural/.test(name)) score += 100;   // 在线自然声音（最接近真人）
  if (/online/.test(name)) score += 80;
  if (/neural/.test(name)) score += 70;     // 神经语音
  if (/google/.test(name)) score += 40;     // Google 声音
  if (/microsoft/.test(name)) score += 30;
  if (/preview/.test(name)) score -= 25;    // 预览/旧版声音
  if (/legacy|mobile|desktop/.test(name)) score -= 10;
  return score;
}

function pickBestEnglishVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const english = voices.filter(voice => /^en(-|_)/i.test(voice.lang || ''));
  const pool = english.length ? english : voices;
  return pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
}

function scanVoices() {
  if (!('speechSynthesis' in window) || voiceScanStarted) return;
  voiceScanStarted = true;
  bestEnglishVoice = pickBestEnglishVoice();
  speechSynthesis.getVoices();
  // 部分浏览器（如 Edge）的在线自然声音加载较慢，加载完自动换用更好的声音
  speechSynthesis.onvoiceschanged = () => { bestEnglishVoice = pickBestEnglishVoice(); };
}

export function speak(text, rate = 1, onend = null, onboundary = null) {
  if (!('speechSynthesis' in window)) {
    toast('当前浏览器不支持语音朗读');
    return false;
  }
  scanVoices();
  if (!bestEnglishVoice) bestEnglishVoice = pickBestEnglishVoice();
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  if (bestEnglishVoice) utterance.voice = bestEnglishVoice;
  utterance.rate = rate;
  utterance.pitch = 1.06; // 略调高音色，更活泼一点（可按需调整）
  utterance.onend = onend;
  utterance.onboundary = onboundary;
  speechSynthesis.speak(utterance);
  return true;
}

export function formatDate(value) {
  if (!value) return '尚未学习';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
