'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import styles from './Lookup.module.css';
import { createPronunciationPlayer } from '../../lib/pronunciation/playback.ts';
import type { PronunciationPlaybackPort, PronunciationPlaybackState } from '../../lib/pronunciation/playback.ts';
import { accentLabels } from '../../lib/pronunciation/accents.ts';
import type { AccentOption } from '../../lib/pronunciation/accents.ts';
import type { PronunciationAccent } from '../../lib/media/course-media.ts';
import type { DictionaryResult as ServiceDictionaryResult } from '../../lib/dictionary/service.ts';
import { mediaAssetUrl } from '../../lib/media/asset-url.ts';

export type LookupRequest = {
  surfaceForm: string;
  scope: string;
  alternateScopes?: string[];
  courseId?: string;
  sentence?: string;
};

type DictionaryResult = Pick<ServiceDictionaryResult, 'word'>
  & Partial<Omit<ServiceDictionaryResult, 'word' | 'sources'>>
  & { sources?: Array<{ title?: string; slug?: string }> };

type LookupFailure = { code: string; message: string; transient: boolean };
type LookupEntry = { data: DictionaryResult | null; error: LookupFailure | null; loading: boolean };
type LookupContextValue = { lookup: (request: string | LookupRequest, trigger?: HTMLElement | null) => void };

const LookupContext = createContext<LookupContextValue | null>(null);
export const useLookup = () => {
  const value = useContext(LookupContext);
  if (!value) throw new Error('useLookup must be used inside LookupProvider');
  return value;
};

// Recordings are always fetched from our own origin, so the browser never binds a provider domain;
// device speech synthesis stays the last explicit step of the playback chain.
const browserPlaybackPort: PronunciationPlaybackPort = {
  async playAudio(url) {
    const audio = new Audio(mediaAssetUrl(url));
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

function lookupFailure(status: number, code = '', message = ''): LookupFailure {
  if (status === 404 || code === 'NOT_FOUND') return {
    code: 'NOT_FOUND',
    message: '这个查询范围没有确认可用的词条。你可以切换查询范围，或检查单词拼写。',
    transient: false,
  };
  if (status === 503 || code === 'PROVIDER_UNAVAILABLE') return {
    code: 'PROVIDER_UNAVAILABLE',
    message: '外部词典暂时不可用，课程释义和已缓存内容仍会保留。',
    transient: true,
  };
  return { code: code || 'LOOKUP_FAILED', message: message || '查询暂时无法完成，请稍后重试。', transient: true };
}

function DictionaryDrawer({ request, onClose }: { request: LookupRequest; onClose: () => void }) {
  const [language, setLanguage] = useState<'en' | 'zh'>(() => typeof window !== 'undefined' && localStorage.getItem('fluent-dictionary-language') === 'zh' ? 'zh' : 'en');
  const [activeScope, setActiveScope] = useState(request.scope);
  const [entries, setEntries] = useState<Record<string, LookupEntry>>({});
  const [detail, setDetail] = useState(false);
  const [retry, setRetry] = useState(0);
  const [closing, setClosing] = useState(false);
  const [playback, setPlayback] = useState<{ region: PronunciationAccent; state: PronunciationPlaybackState } | null>(null);
  const playerRef = useRef<ReturnType<typeof createPronunciationPlayer> | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const scopes = useMemo(() => [...new Map([request.scope, ...(request.alternateScopes || [])]
    .map(scope => [scope.toLowerCase(), scope])).values()], [request]);
  const entryKey = `${language}:${activeScope.toLowerCase()}`;
  const entry = entries[entryKey] || { data: null, error: null, loading: true };
  const { data, error } = entry;
  const close = useCallback(() => setClosing(true), []);

  const player = useCallback(() => {
    playerRef.current ||= createPronunciationPlayer(
      browserPlaybackPort,
      status => setPlayback(status.state === 'idle' ? null : status),
      metric => console.info('lookup_metric', JSON.stringify(metric)),
    );
    return playerRef.current;
  }, []);
  useEffect(() => () => playerRef.current?.stop(), []);
  useEffect(() => setActiveScope(request.scope), [request]);

  useEffect(() => {
    if (!closing) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    const timer = window.setTimeout(onClose, delay);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);

  useEffect(() => {
    let cancelled = false;
    const shouldLoadLocal = language === 'en' && !entries[entryKey]?.data;
    setEntries(current => ({ ...current, [entryKey]: { data: current[entryKey]?.data || null, error: null, loading: true } }));
    setDetail(false);
    setPlayback(null);
    playerRef.current?.stop();
    const params = new URLSearchParams({
      word: activeScope,
      surface: activeScope === request.scope ? request.surfaceForm : activeScope,
      lang: language,
    });
    if (request.courseId) params.set('courseId', request.courseId);
    if (request.sentence) params.set('sentence', request.sentence);
    scopes.filter(scope => scope !== activeScope).forEach(scope => params.append('alternate', scope));
    const requestResult = async (query: URLSearchParams) => {
      const response = await fetch(`/api/dictionary?${query}`);
      const body = await response.json() as DictionaryResult & { error?: string; code?: string };
      if (!response.ok) throw lookupFailure(response.status, body.code, body.error);
      return body;
    };
    if (shouldLoadLocal) {
      const localParams = new URLSearchParams(params);
      localParams.set('source', 'local');
      void requestResult(localParams).then(value => {
        if (!cancelled) setEntries(current => current[entryKey]?.loading
          ? { ...current, [entryKey]: { ...current[entryKey], data: value } }
          : current);
      }).catch(() => undefined);
    }
    void requestResult(params)
      .then(value => {
        if (!cancelled) setEntries(current => ({ ...current, [entryKey]: { data: value, error: null, loading: false } }));
      })
      .catch((value: unknown) => {
        if (cancelled) return;
        const failure = value && typeof value === 'object' && 'transient' in value
          ? value as LookupFailure
          : lookupFailure(0, '', value instanceof Error ? value.message : '');
        setEntries(current => ({
          ...current,
          [entryKey]: { data: current[entryKey]?.data || null, error: failure, loading: false },
        }));
      });
    return () => { cancelled = true; };
  }, [activeScope, entryKey, language, request, retry, scopes]);

  useEffect(() => {
    drawerRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]),a[href]:not([tabindex="-1"]),input:not([tabindex="-1"]),summary:not([tabindex="-1"])') || []);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); };
  }, [close]);

  const changeLanguage = (next: 'en' | 'zh') => {
    localStorage.setItem('fluent-dictionary-language', next);
    setLanguage(next);
  };
  const onLanguageKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'en' : event.key === 'End' ? 'zh' : language === 'en' ? 'zh' : 'en';
    changeLanguage(next);
    requestAnimationFrame(() => drawerRef.current?.querySelector<HTMLElement>(`#dictionary-language-${next}`)?.focus());
  };
  const retryLookup = () => setRetry(value => value + 1);
  const common = data?.meanings?.slice(0, detail ? 6 : 1) || [];
  const hasMore = Boolean(data && ((data.meanings?.length || 0) > 1 || data.sources?.length));
  const playableAccents = (data?.accents || []).filter(accent => accent.source !== 'none');
  const blocks = data?.sourceStatus?.blocks;
  const dictionaryStatus = language === 'en' ? blocks?.externalDictionary : blocks?.localDictionary;
  const dictionaryName = language === 'en' ? '外部英英词典' : '本地英汉词典';
  const providerUnavailable = dictionaryStatus === 'unavailable' || data?.sourceStatus?.provider === 'unavailable';
  const dictionaryFailure = error || (providerUnavailable ? {
    code: 'PROVIDER_UNAVAILABLE',
    message: '已加载的课程释义和缓存内容不会被清除。',
    transient: true,
  } satisfies LookupFailure : null);
  const spokenText = data?.lexeme || activeScope;
  const playAccent = (accent: AccentOption) => { void player().play({ region: accent.region, text: spokenText, audioUrl: accent.audioUrl }); };
  const playDeviceSpeech = () => {
    const current = player();
    current.stop();
    void current.play({ region: playableAccents[0]?.region || 'us', text: spokenText });
  };

  return <div className="react-dictionary-backdrop" data-closing={closing || undefined} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="react-dictionary-drawer" ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dictionary-title">
      <header className="react-dictionary-header">
        <div><span className="eyebrow">Lookup</span><strong id="dictionary-title">词典释义</strong></div>
        <div className="react-dictionary-actions">
          <div className="react-dictionary-mode" role="tablist" aria-label="词典语言">
            <button id="dictionary-language-en" type="button" role="tab" aria-controls="dictionary-results" aria-selected={language === 'en'} tabIndex={language === 'en' ? 0 : -1} onKeyDown={onLanguageKeyDown} onClick={() => changeLanguage('en')}>英英</button>
            <button id="dictionary-language-zh" type="button" role="tab" aria-controls="dictionary-results" aria-selected={language === 'zh'} tabIndex={language === 'zh' ? 0 : -1} onKeyDown={onLanguageKeyDown} onClick={() => changeLanguage('zh')}>英汉</button>
          </div>
          <button className="icon-button" type="button" aria-label="关闭查词结果" onClick={close}>×</button>
        </div>
      </header>
      <div className="react-dictionary-content" id="dictionary-results" role="tabpanel" aria-labelledby={`dictionary-language-${language}`}>
        {scopes.length > 1 && <div className={styles.scopePicker} role="group" aria-label="查询范围"><span>查询范围</span>{scopes.map(scope => <button key={scope} type="button" aria-pressed={activeScope === scope} onClick={() => setActiveScope(scope)}>{scope}</button>)}</div>}
        {!data && error ? <div className="state-box" role={error.transient ? 'alert' : 'status'}>
          <strong>{error.code === 'NOT_FOUND' ? '未找到词条' : '外部词典暂时不可用'}</strong>
          <span>{error.message}</span>
          {error.transient && <button className="btn blue" type="button" onClick={retryLookup}>重试当前查询</button>}
        </div> : !data ? <div className="react-dictionary-loading" role="status" aria-live="polite"><h2>{activeScope}</h2><span>正在加载查词结果</span><div className="skeleton" /></div> : <>
          <div className="react-dictionary-hero">
            <div>
              <span className="badge">{data.catalogMembership || '参考词汇'}</span>
              <div className="react-dictionary-word"><h2>{data.selectedScope || data.word}</h2>{data.phonetic && <span>{data.phonetic}</span>}</div>
              <div className="react-pronunciation-row" role="group" aria-label="发音控件">
                {playableAccents.map(accent => <button key={accent.region} className="react-pronunciation" type="button" aria-label={`播放${accent.label}`} onClick={() => playAccent(accent)}><span aria-hidden="true">◉</span><small>{accent.label}<b>{accent.phonetic || (accent.source === 'course' ? '课程录音' : '词典录音')}</b></small></button>)}
                <button className="react-pronunciation" type="button" aria-label="使用设备发音" onClick={playDeviceSpeech}><span aria-hidden="true">◎</span><small>设备发音<b>语音合成</b></small></button>
              </div>
              <p className="react-pronunciation-status" role="status">{playback ? `${accentLabels[playback.region]} ${playbackLabels[playback.state]}` : ''}</p>
            </div>
            {data.illustration ? <img className="react-dictionary-image" src={mediaAssetUrl(data.illustration.src)} alt={data.illustration.alt} /> : <div className="react-dictionary-image placeholder" role="status">暂无图示</div>}
          </div>
          {blocks?.pronunciation === 'unavailable' && <div className="alert" role="alert">录音暂时不可用，仍可使用设备发音。<button className="btn blue" type="button" onClick={retryLookup}>重试发音资源</button></div>}
          {blocks?.pronunciation === 'stale' && <div className="alert" role="status">正在使用已缓存录音，可重试检查更新。</div>}
          <section className={styles.resultBlock} aria-labelledby="course-sense-title"><h3 id="course-sense-title">课程释义</h3>{data.meaning ? <p>{data.meaning}</p> : <p className="muted">当前课程没有专属释义。</p>}</section>
          <section className={styles.resultBlock} aria-labelledby="dictionary-sense-title">
            <div className={styles.blockHeading}><h3 id="dictionary-sense-title">{dictionaryName}</h3>{entry.loading && <span role="status">正在更新</span>}</div>
            {dictionaryFailure && <div className={styles.blockError} role="alert"><strong>{dictionaryName}暂时不可用</strong><span>{dictionaryFailure.message}</span>{dictionaryFailure.transient && <button className="btn blue" type="button" onClick={retryLookup}>重试{dictionaryName}</button>}</div>}
            {common.length ? <div className="react-meanings">{common.map((group, index) => <section key={`${group.partOfSpeech}-${index}`}><h3>{group.partOfSpeech || 'definition'}</h3>{group.definitions?.map((item, itemIndex) => <div key={itemIndex}><p>{item.definition}</p>{item.example && <small>例：{item.example}</small>}</div>)}</section>)}</div> : !dictionaryFailure && !entry.loading && <p className="muted">该来源确认没有可显示的释义。</p>}
          </section>
          {hasMore && <button className="react-more" type="button" onClick={() => setDetail(value => !value)}>{detail ? '收起详情' : `更多信息（${Math.max(0, (data.meanings?.length || 0) - 1)}）`}</button>}
          {detail && data.sources?.length ? <section className="react-detail-block"><h3>课程来源</h3>{data.sources.map((source, index) => source.slug
            ? <a key={index} href={`/lesson/${encodeURIComponent(source.slug)}`}>{source.title || source.slug}</a>
            : <p key={index}>{source.title || '已发布课程'}</p>)}</section> : null}
          {data.cacheStatus === 'stale' && <div className="alert">正在使用已缓存内容，外部词典恢复后可重试更新。</div>}
          <footer className="react-attribution">来源：{data.provider || '本地词库'}{data.lexeme && ` · Lexeme: ${data.lexeme}`}</footer>
        </>}
      </div>
    </div>
  </div>;
}

export function LookupProvider({ children }: { children: React.ReactNode }) {
  const [lookup, setLookup] = useState<{ request: LookupRequest; trigger: HTMLElement | null } | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const open = useCallback((request: string | LookupRequest, trigger: HTMLElement | null = null) => setLookup({
    request: typeof request === 'string' ? { surfaceForm: request, scope: request } : request,
    trigger,
  }), []);
  const close = useCallback(() => {
    restoreFocusRef.current = lookup?.trigger || null;
    setLookup(null);
  }, [lookup]);
  useEffect(() => {
    if (lookup || !restoreFocusRef.current) return;
    const trigger = restoreFocusRef.current;
    restoreFocusRef.current = null;
    const frame = requestAnimationFrame(() => { if (trigger.isConnected) trigger.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [lookup]);
  return <LookupContext.Provider value={{ lookup: open }}>
    <div className={styles.application} data-lookup-background inert={lookup ? true : undefined} aria-hidden={lookup ? true : undefined}>{children}</div>
    {lookup && <DictionaryDrawer request={lookup.request} onClose={close} />}
  </LookupContext.Provider>;
}
