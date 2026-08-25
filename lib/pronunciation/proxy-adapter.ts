type PronunciationRegion = 'us' | 'uk' | 'other';
type PronunciationEntry = { pronunciations?: Array<{ region: PronunciationRegion; audio?: string }> };

const pronunciationHosts = new Set(['api.dictionaryapi.dev', 'ssl.gstatic.com']);
const maximumAudioBytes = 5_000_000;
// A proxied recording is immutable for a given word and accent, so it may be cached publicly.
const audioCacheControl = 'public, max-age=604800';

export class PronunciationProxyError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function loadPronunciationAudio(options: {
  word: string;
  region: 'us' | 'uk';
  resolveEntry: (word: string) => Promise<PronunciationEntry | null>;
  fetcher?: typeof fetch;
}) {
  const entry = await options.resolveEntry(options.word);
  const pronunciation = entry?.pronunciations?.find(item => item.region === options.region);
  if (!pronunciation?.audio) throw new PronunciationProxyError('暂无该口音录音', 404);

  let source: URL;
  try { source = new URL(pronunciation.audio); } catch { throw new PronunciationProxyError('发音来源不受支持', 400); }
  if (source.protocol !== 'https:' || !pronunciationHosts.has(source.hostname)) {
    throw new PronunciationProxyError('发音来源不受支持', 400);
  }

  let response: Response;
  try {
    response = await (options.fetcher || fetch)(source, {
      headers: { accept: 'audio/*', 'user-agent': 'FluentScienceReading/0.1' },
      redirect: 'error',
      signal: AbortSignal.timeout(6500),
    });
  } catch {
    throw new PronunciationProxyError('发音来源响应超时', 504);
  }
  const contentType = String(response.headers.get('content-type') || '');
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (!response.ok || !contentType.startsWith('audio/') || declaredSize > maximumAudioBytes) {
    throw new PronunciationProxyError('发音资源不可用', 502);
  }
  const body = await response.arrayBuffer();
  if (body.byteLength > maximumAudioBytes) throw new PronunciationProxyError('发音资源过大', 502);
  return { body, contentType, cacheControl: audioCacheControl };
}
