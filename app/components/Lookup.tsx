'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import styles from './Lookup.module.css';
import { createPronunciationPlayer } from '../../lib/pronunciation/playback.ts';
import type { PronunciationPlaybackPort, PronunciationPlaybackState } from '../../lib/pronunciation/playback.ts';
import { accentLabels } from '../../lib/pronunciation/accents.ts';
import type { AccentOption } from '../../lib/pronunciation/accents.ts';
import type { PronunciationAccent, StudentIllustration } from '../../lib/media/course-media.ts';

export type LookupRequest = {
  surfaceForm: string;
  scope: string;
  alternateScopes?: string[];
  courseId?: string;
  sentence?: string;
};

type DictionaryResult = {
  word: string; surfaceForm?: string; lexeme?: string; selectedScope?: string; alternateScopes?: string[];
  category?: string; catalogMembership?: string | null; meaning?: string; image?: string; phonetic?: string;
  illustration?: StudentIllustration | null; accents?: AccentOption[];
  pronunciations?: Array<{ region: 'us' | 'uk' | 'other'; label?: string; phonetic?: string; audio?: string }>;
  meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition: string; example?: string }> }>;
  provider?: string; cacheStatus?: string; sourceStatus?: { course: string; provider: string }; sources?: Array<{ title?: string; slug?: string }>;
};

type LookupContextValue = { lookup: (request: string | LookupRequest, trigger?: HTMLElement | null) => void };
const LookupContext = createContext<LookupContextValue | null>(null);
export const useLookup = () => {
  const value = useContext(LookupContext);
  if (!value) throw new Error('useLookup must be used inside LookupProvider');
  return value;
};

function assetUrl(raw?: string) {
  if (!raw) return '';
  return /^(https?:|data:|\/)/i.test(raw) ? raw : `/${raw.replace(/^\/+/, '')}`;
}

// Recordings are always fetched from our own origin, so the browser never binds a provider domain;
// device speech synthesis stays the last explicit step of the playback chain.
const browserPlaybackPort: PronunciationPlaybackPort = {
  async playAudio(url) {
    const audio = new Audio(assetUrl(url));
    const finished = new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('无法播放该录音'));
    });
    await audio.play();
    return { finished, stop: () => { audio.onended = null; audio.onerror = null; audio.pause(); } };
  },
  async speak(text, region) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) throw new Error('设备不支持语音合成');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = region === 'uk' ? 'en-GB' : 'en-US';
    const finished = new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error('设备发音失败'));
    });
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return { finished, stop: () => { utterance.onend = null; utterance.onerror = null; window.speechSynthesis.cancel(); } };
  },
};

const playbackLabels: Record<PronunciationPlaybackState, string> = {
  starting: '正在准备发音',
  playing: '正在播放',
  fallback: '已降级到设备发音',
  failed: '发音播放失败',
  idle: '',
};

function DictionaryDrawer({ request, trigger, onClose }: { request: LookupRequest; trigger: HTMLElement | null; onClose: () => void }) {
  const [language, setLanguage] = useState<'en' | 'zh'>(() => typeof window !== 'undefined' && localStorage.getItem('fluent-dictionary-language') === 'zh' ? 'zh' : 'en');
  const [activeScope, setActiveScope] = useState(request.scope);
  const [data, setData] = useState<DictionaryResult | null>(null);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(false);
  const [retry, setRetry] = useState(0);
  const [playback, setPlayback] = useState<{ region: PronunciationAccent; state: PronunciationPlaybackState } | null>(null);
  const playerRef = useRef<ReturnType<typeof createPronunciationPlayer> | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const close = useCallback(() => { onClose(); requestAnimationFrame(() => trigger?.focus()); }, [onClose, trigger]);
  const scopes = useMemo(() => [...new Map([request.scope, ...(request.alternateScopes || [])]
    .map(scope => [scope.toLowerCase(), scope])).values()], [request]);

  const player = useCallback(() => {
    playerRef.current ||= createPronunciationPlayer(browserPlaybackPort, status => setPlayback(status.state === 'idle' ? null : status));
    return playerRef.current;
  }, []);
  useEffect(() => () => playerRef.current?.stop(), []);

  useEffect(() => setActiveScope(request.scope), [request]);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(''); setDetail(false); setPlayback(null); playerRef.current?.stop();
    const params = new URLSearchParams({
      word: activeScope,
      surface: activeScope === request.scope ? request.surfaceForm : activeScope,
      lang: language,
    });
    if (request.courseId) params.set('courseId', request.courseId);
    if (request.sentence) params.set('sentence', request.sentence);
    scopes.filter(scope => scope !== activeScope).forEach(scope => params.append('alternate', scope));
    fetch(`/api/dictionary?${params}`)
      .then(async response => { const body = await response.json() as DictionaryResult & { error?: string }; if (!response.ok) throw new Error(body.error || '查询失败'); return body; })
      .then(value => { if (!cancelled) setData(value); })
      .catch(value => { if (!cancelled) setError(value.message); });
    return () => { cancelled = true; };
  }, [activeScope, language, request, retry, scopes]);

  useEffect(() => {
    drawerRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,summary') || []);
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [close]);

  const changeLanguage = (next: 'en' | 'zh') => { localStorage.setItem('fluent-dictionary-language', next); setLanguage(next); };
  const common = data?.meanings?.slice(0, detail ? 6 : 1) || [];
  const hasMore = Boolean(data && ((data.meanings?.length || 0) > 1 || data.sources?.length));
  const playableAccents = (data?.accents || []).filter(accent => accent.source !== 'none');
  const spokenText = data?.lexeme || activeScope;
  const playAccent = (accent: AccentOption) => { void player().play({ region: accent.region, text: spokenText, audioUrl: accent.audioUrl }); };
  const playDeviceSpeech = () => {
    const current = player();
    current.stop();
    void current.play({ region: playableAccents[0]?.region || 'us', text: spokenText });
  };

  return <div className="react-dictionary-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <aside className="react-dictionary-drawer" ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dictionary-title">
      <header className="react-dictionary-header"><div><span className="eyebrow">Lookup</span><strong id="dictionary-title">词典释义</strong></div><div className="react-dictionary-actions"><div className="react-dictionary-mode" role="tablist" aria-label="词典语言"><button type="button" role="tab" aria-selected={language === 'en'} onClick={() => changeLanguage('en')}>英英</button><button type="button" role="tab" aria-selected={language === 'zh'} onClick={() => changeLanguage('zh')}>英汉</button></div><button className="icon-button" type="button" aria-label="关闭查词结果" onClick={close}>×</button></div></header>
      <div className="react-dictionary-content">
        {scopes.length > 1 && <div className={styles.scopePicker} role="group" aria-label="查询范围"><span>查询范围</span>{scopes.map(scope => <button key={scope} type="button" aria-pressed={activeScope === scope} onClick={() => setActiveScope(scope)}>{scope}</button>)}</div>}
        {error ? <div className="state-box"><strong>查询未完成</strong><span>{error}</span><button className="btn blue" type="button" onClick={() => setRetry(value => value + 1)}>重新查询</button></div> : !data ? <div className="react-dictionary-loading"><h2>{activeScope}</h2><div className="skeleton" /></div> : <>
          <div className="react-dictionary-hero"><div><span className="badge">{data.catalogMembership || '参考词汇'}</span><div className="react-dictionary-word"><h2>{data.selectedScope || data.word}</h2>{data.phonetic && <span>{data.phonetic}</span>}</div><div className="react-pronunciation-row" role="group" aria-label="发音控件">{playableAccents.map(accent => <button key={accent.region} className="react-pronunciation" type="button" aria-label={`播放${accent.label}`} onClick={() => playAccent(accent)}><span aria-hidden="true">◉</span><small>{accent.label}<b>{accent.phonetic || (accent.source === 'course' ? '课程录音' : '词典录音')}</b></small></button>)}<button className="react-pronunciation" type="button" aria-label="使用设备发音" onClick={playDeviceSpeech}><span aria-hidden="true">◎</span><small>设备发音<b>语音合成</b></small></button></div><p className="react-pronunciation-status" role="status">{playback ? `${accentLabels[playback.region]} ${playbackLabels[playback.state]}` : ''}</p></div>{data.illustration ? <img className="react-dictionary-image" src={assetUrl(data.illustration.src)} alt={data.illustration.alt} /> : <div className="react-dictionary-image placeholder">暂无图示</div>}</div>
          {data.meaning && <div className="alert success"><strong>课程释义</strong><br />{data.meaning}</div>}
          {common.length ? <div className="react-meanings">{common.map((group, index) => <section key={`${group.partOfSpeech}-${index}`}><h3>{group.partOfSpeech || 'definition'}</h3>{group.definitions?.map((item, itemIndex) => <div key={itemIndex}><p>{item.definition}</p>{item.example && <small>例：{item.example}</small>}</div>)}</section>)}</div> : <p className="muted">该词已识别，但暂无可显示的释义。</p>}
          {hasMore && <button className="react-more" type="button" onClick={() => setDetail(value => !value)}>{detail ? '收起详情' : `更多信息（${Math.max(0, (data.meanings?.length || 0) - 1)}）`}</button>}
          {detail && data.sources?.length ? <section className="react-detail-block"><h3>课程来源</h3>{data.sources.map((source, index) => source.slug
            ? <a key={index} href={`/lesson/${encodeURIComponent(source.slug)}`}>{source.title || source.slug}</a>
            : <p key={index}>{source.title || '已发布课程'}</p>)}</section> : null}
          {data.cacheStatus === 'stale' && <div className="alert">正在使用已缓存内容，外部词典恢复后会自动更新。</div>}
          <footer className="react-attribution">来源：{data.provider || '本地词库'}{data.lexeme && ` · Lexeme: ${data.lexeme}`}</footer>
        </>}
      </div>
    </aside>
  </div>;
}

export function LookupProvider({ children }: { children: React.ReactNode }) {
  const [lookup, setLookup] = useState<{ request: LookupRequest; trigger: HTMLElement | null } | null>(null);
  const open = useCallback((request: string | LookupRequest, trigger: HTMLElement | null = null) => setLookup({
    request: typeof request === 'string' ? { surfaceForm: request, scope: request } : request,
    trigger,
  }), []);
  return <LookupContext.Provider value={{ lookup: open }}>{children}{lookup && <DictionaryDrawer request={lookup.request} trigger={lookup.trigger} onClose={() => setLookup(null)} />}</LookupContext.Provider>;
}
