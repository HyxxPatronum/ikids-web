import { isPronunciationReady, pronunciationAccents } from '../media/course-media.ts';
import type { PronunciationAccent, PronunciationAsset } from '../media/course-media.ts';

export type AccentAudioSource = 'course' | 'provider' | 'none';
export type AccentOption = {
  region: PronunciationAccent;
  label: string;
  phonetic: string;
  source: AccentAudioSource;
  audioUrl: string;
};

type ProviderPronunciation = { region: string; phonetic?: string; audio?: string };

export const accentLabels: Record<PronunciationAccent, string> = { us: '美音', uk: '英音' };

// The chain is prepared course recording, then the same-site audio proxy, then device speech.
// A provider recording is only claimed by the first accent that references it, so a single
// recording is never presented as both the US and the UK pronunciation.
export function resolveAccentOptions(options: {
  lexeme: string;
  course?: PronunciationAsset[];
  provider?: ProviderPronunciation[];
}): AccentOption[] {
  const claimed = new Set<string>();
  return pronunciationAccents.map(region => {
    const prepared = (options.course || []).find(asset => asset.region === region && isPronunciationReady(asset));
    const remote = (options.provider || []).find(item => item.region === region);
    const remoteAudio = String(remote?.audio || '');
    const phonetic = String(remote?.phonetic || '');
    if (prepared) return { region, label: accentLabels[region], phonetic, source: 'course', audioUrl: prepared.src };
    if (remoteAudio && !claimed.has(remoteAudio)) {
      claimed.add(remoteAudio);
      return { region, label: accentLabels[region], phonetic, source: 'provider', audioUrl: `/api/pronunciation?word=${encodeURIComponent(options.lexeme)}&region=${region}` };
    }
    return { region, label: accentLabels[region], phonetic, source: 'none', audioUrl: '' };
  });
}
