import type { DictionaryProvider, DictionaryResult } from './service.ts';

const uniqueTerms = (values: unknown[]) => [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))];

function normalizeEntry(entry: Record<string, any>): Partial<DictionaryResult> {
  const phonetics = entry.phonetics || [];
  const audioRaw = phonetics.find((item: any) => item.audio)?.audio || '';
  const pronunciations: DictionaryResult['pronunciations'] = [];
  const seenRegions = new Set<string>();
  for (const item of phonetics) {
    const raw = String(item.audio || '');
    if (!raw) continue;
    const audio = raw.startsWith('//') ? `https:${raw}` : raw;
    const hint = `${audio} ${item.sourceUrl || ''}`.toLowerCase();
    const region = /(?:^|[-_/])(us|usa)(?:[-_./]|$)|en[-_]us|american/.test(hint) ? 'us'
      : /(?:^|[-_/])(uk|gb)(?:[-_./]|$)|en[-_](?:gb|uk)|british/.test(hint) ? 'uk' : 'other';
    if (seenRegions.has(region)) continue;
    seenRegions.add(region);
    pronunciations.push({
      region, label: region === 'us' ? '美音' : region === 'uk' ? '英音' : '词典音频',
      phonetic: item.text || '', audio, sourceUrl: item.sourceUrl || '',
      license: item.license?.name || '', licenseUrl: item.license?.url || '',
    });
  }
  const meanings = (entry.meanings || []).slice(0, 6).map((meaning: any) => {
    const definitions = (meaning.definitions || []).filter((item: any) => item.definition).slice(0, 5);
    return {
      partOfSpeech: meaning.partOfSpeech || 'definition',
      definitions: definitions.map((item: any) => ({ definition: item.definition, example: item.example || '' })),
      synonyms: uniqueTerms([...(meaning.synonyms || []), ...definitions.flatMap((item: any) => item.synonyms || [])]).slice(0, 5),
      antonyms: uniqueTerms([...(meaning.antonyms || []), ...definitions.flatMap((item: any) => item.antonyms || [])]).slice(0, 3),
    };
  }).filter((group: any) => group.definitions.length);
  return {
    phonetic: entry.phonetic || phonetics.find((item: any) => item.text)?.text || '',
    audio: audioRaw.startsWith('//') ? `https:${audioRaw}` : audioRaw,
    pronunciations,
    meanings,
    provider: 'Free Dictionary API',
  };
}

export function createFreeDictionaryAdapter(options: {
  fetcher?: typeof fetch;
  timeout?: (milliseconds: number) => AbortSignal;
} = {}): DictionaryProvider {
  const fetcher = options.fetcher || fetch;
  const timeout = options.timeout || AbortSignal.timeout;
  return async word => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetcher(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
          headers: { accept: 'application/json', 'user-agent': 'FluentScienceReading/0.1' },
          signal: timeout(attempt ? 6500 : 4000),
        });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Dictionary provider returned ${response.status}`);
        const data = await response.json();
        const entry = Array.isArray(data) ? data[0] : null;
        return entry ? normalizeEntry(entry) : null;
      } catch (error) {
        lastError = error;
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 180));
      }
    }
    throw lastError || new Error('Dictionary provider unavailable');
  };
}
