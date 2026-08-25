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

export function speak(text, rate = 1, onend = null) {
  if (!('speechSynthesis' in window)) {
    toast('当前浏览器不支持语音朗读');
    return false;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  utterance.onend = onend;
  speechSynthesis.speak(utterance);
  return true;
}

export function formatDate(value) {
  if (!value) return '尚未学习';
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
