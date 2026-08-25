import type { PronunciationAccent } from '../media/course-media.ts';

export type PronunciationPlaybackState = 'starting' | 'playing' | 'fallback' | 'idle' | 'failed';
export type PronunciationPlaybackStatus = { region: PronunciationAccent; state: PronunciationPlaybackState };
export type PronunciationPlaybackHandle = { finished: Promise<void>; stop(): void };
export type PronunciationPlaybackPort = {
  playAudio(url: string): Promise<PronunciationPlaybackHandle>;
  speak(text: string, region: PronunciationAccent): Promise<PronunciationPlaybackHandle>;
};
export type PronunciationPlayRequest = { region: PronunciationAccent; text: string; audioUrl?: string };

type Session = { region: PronunciationAccent; stop: (() => void) | null; cancelled: Promise<void>; cancel(): void };

// One player owns every accent control in a lookup, so a repeated tap on the playing accent is
// ignored and switching accents silences the previous recording before the next one starts.
export function createPronunciationPlayer(port: PronunciationPlaybackPort, onStatus: (status: PronunciationPlaybackStatus) => void) {
  let active: Session | null = null;
  const emit = (region: PronunciationAccent, state: PronunciationPlaybackState) => onStatus({ region, state });
  const release = (session: Session) => { if (active === session) { active = null; emit(session.region, 'idle'); } };

  function stop() {
    if (!active) return;
    const session = active;
    active = null;
    session.stop?.();
    session.cancel();
    emit(session.region, 'idle');
  }

  async function play(request: PronunciationPlayRequest) {
    if (active?.region === request.region) return;
    stop();
    let cancel!: () => void;
    const session: Session = {
      region: request.region,
      stop: null,
      cancelled: new Promise<void>(resolve => { cancel = resolve; }),
      cancel: () => cancel(),
    };
    active = session;
    emit(session.region, 'starting');
    const audioUrl = String(request.audioUrl || '');
    if (audioUrl) {
      try {
        const playback = await port.playAudio(audioUrl);
        if (active !== session) { playback.stop(); return; }
        session.stop = playback.stop;
        emit(session.region, 'playing');
        await Promise.race([playback.finished, session.cancelled]);
        if (active !== session) return;
        release(session);
        return;
      } catch {
        if (active !== session) return;
      }
    }
    try {
      const speech = await port.speak(request.text, session.region);
      if (active !== session) { speech.stop(); return; }
      session.stop = speech.stop;
      emit(session.region, 'fallback');
      await Promise.race([speech.finished, session.cancelled]);
      if (active !== session) return;
      release(session);
    } catch {
      if (active !== session) return;
      active = null;
      emit(session.region, 'failed');
    }
  }

  return { play, stop };
}
