'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { SiteHeader } from '../../components/SiteHeader';
import type { CourseCard } from '../../../lib/course-data';
import { progressFor, saveProgress, type LearningProgress } from '../../../lib/local-learning';
import { pronunciationAdvice, pronunciationPraise, pronunciationScore, pronunciationScoreBand, pronunciationWordLabel, type PronunciationScoreResult } from '../../../lib/pronunciation-scoring';

type ModuleId = 'reading' | 'words' | 'comprehension' | 'rebuild';
type StoredRecording = { audio?: string | null; score?: PronunciationScoreResult | null; };
const modules: Array<[ModuleId, string]> = [['reading', 'Listen and Read'], ['words', 'Words'], ['comprehension', 'Comprehension'], ['rebuild', 'Rebuild']];
const sentenceList = (paragraphs: string[]) => paragraphs.flatMap(value => value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(text => text.trim()) || [value]);
const tableTypes = ['feature-function', 'fact-explanation', 'cause-effect', 'compare-contrast'];
const shuffle = <T,>(items: T[], key: string) => {
  const result = [...items];
  let seed = key.split('').reduce((value, char) => (value * 33 + char.charCodeAt(0)) >>> 0, 5381);
  for (let index = result.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const target = seed % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  if (result.length > 1 && result.every((item, index) => item === items[index])) result.push(result.shift() as T);
  return result;
};
const fallbackTranslations: Record<string, string> = {
  'A flower starts as a tight bud.': '花朵从一个紧实的花蕾开始。',
  'Roots take in water from the soil.': '根从土壤中吸收水分。',
  'Warm sunlight helps the stem and petals grow.': '温暖的阳光帮助茎和花瓣生长。',
  'The petals slowly unfold and open.': '花瓣慢慢展开并开放。',
  'Now the bloom can catch light and welcome bees.': '现在花朵可以接收阳光并迎来蜜蜂。',
  'A cactus lives in a hot, dry desert.': '仙人掌生活在炎热干燥的沙漠中。',
  'Its thick stem stores water for a long time.': '它粗厚的茎能长时间储存水分。',
  'A waxy skin keeps water from escaping.': '蜡质表皮防止水分流失。',
  'Tiny spines protect the plant from hungry animals.': '细小的刺保护植物免受饥饿动物的伤害。',
  'These features help the cactus survive with very little rain.': '这些特征帮助仙人掌在少雨的环境中生存。',
};
const fmtTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, '0')}`;
const contextPromptParts = (prompt: string, answer: string): [string, string] => {
  const blank = prompt.match(/_{2,}|…{2,}|□/);
  if (blank?.index !== undefined) return [prompt.slice(0, blank.index), prompt.slice(blank.index + blank[0].length)];
  const answerIndex = prompt.toLowerCase().indexOf(answer.toLowerCase());
  if (answerIndex >= 0) return [prompt.slice(0, answerIndex), prompt.slice(answerIndex + answer.length)];
  const punctuation = prompt.match(/^(.+?)([.!?])$/);
  return punctuation ? [`${punctuation[1]} `, punctuation[2]] : [`${prompt} `, ''];
};

function getRebuildType(course: CourseCard) {
  const value = String(course.rebuild?.type || course.articleStructure || course.structure || '').toLowerCase();
  if (value.includes('feature') && value.includes('function')) return 'feature-function';
  if (value.includes('fact') && value.includes('explanation')) return 'fact-explanation';
  if (value.includes('cause') && value.includes('effect')) return 'cause-effect';
  if (value.includes('compare') && value.includes('contrast')) return 'compare-contrast';
  return value.includes('cycle') && !value.includes('process') ? 'cycle' : 'process';
}

function rowsFor(course: CourseCard): Array<[string, string]> {
  if (course.rebuild?.pairs?.length) return course.rebuild.pairs.map(row => Array.isArray(row) ? row : [row.left || row.feature || row.fact || row.cause || '', row.right || row.function || row.explanation || row.effect || '']);
  const steps = course.rebuild?.steps || [];
  const split = (step: string): [string, string] => {
    const explicit = step.split(/\s*(?:→|->|\||::)\s*/);
    if (explicit.length > 1) return [explicit[0], explicit.slice(1).join(' ')];
    const verb = step.match(/^(.+?)\s+(is|are|has|have|stores?|keeps?|protects?|collects?|slows?|gives?|blocks?|pulls?|pushes?|takes?|traps?|spreads?|turns?|helps?|survives?|grows?|forms?|makes?)\s+(.+)$/i);
    return verb ? [verb[1], `${verb[2]} ${verb[3]}`] : [step, ''];
  };
  const type = getRebuildType(course);
  const explicit = steps.map(split);
  if (explicit.every(pair => pair[1])) return explicit;
  if (type === 'feature-function') return explicit.filter(pair => pair[1]);
  if (type === 'cause-effect') return steps.slice(0, -1).map((step, index) => [step, steps[index + 1]]);
  const rows: Array<[string, string]> = [];
  for (let index = 0; index < steps.length; index += 2) if (steps[index] && steps[index + 1]) rows.push([steps[index], steps[index + 1]]);
  return rows;
}

export default function LearningExperience({ course, previousLesson, nextLesson }: { course: CourseCard; previousLesson?: string; nextLesson?: string; }) {
  const sentences = useMemo(() => sentenceList(course.paragraphs), [course.paragraphs]);
  const sentenceTranslations = useMemo(() => sentences.map((sentence, index) => course.translations?.[index] || course.paragraphTranslations?.[index] || fallbackTranslations[sentence] || ''), [course.paragraphTranslations, course.translations, sentences]);
  const practice = course.listenRead?.sentences?.map(item => item.sentence).filter(Boolean) || sentences;
  const pairs = course.wordModule?.matchPairs || course.word_bank.map(item => ({ word: item.english, meaning: item.chinese || item.english }));
  const bankSlots = Array.from({ length: 6 }, (_, index) => course.word_bank[index] || null);
  const contextQuestions = course.wordModule?.contextQuestions || [];
  const steps = course.rebuild?.steps || [];
  const rebuildType = getRebuildType(course);
  const tableRows = rowsFor(course);
  const rebuildBankOrder = useMemo(() => shuffle(steps.map((_, index) => index), `${course.cardId}:rebuild-bank`), [course.cardId, steps]);
  const [active, setActive] = useState<ModuleId>('reading');
  const [progress, setProgress] = useState<LearningProgress>({ cardId: course.cardId, completedPercent: 0, moduleStatus: {}, answers: {}, rebuild: [], checked: {}, updatedAt: '' });
  const [playing, setPlaying] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<number | null>(null);
  const [allPlaying, setAllPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [rate, setRate] = useState(.9);
  const [translationOpen, setTranslationOpen] = useState<number[]>([]);
  const [allTranslation, setAllTranslation] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingTimes, setRecordingTimes] = useState<Record<number, { current: number; duration: number }>>({});
  const [recordingPlaying, setRecordingPlaying] = useState<number | null>(null);
  const [recordings, setRecordings] = useState<Record<number, string>>({});
  const [scores, setScores] = useState<Record<number, PronunciationScoreResult>>({});
  const [scoring, setScoring] = useState<Record<number, boolean>>({});
  const [unrecognized, setUnrecognized] = useState<Record<number, boolean>>({});
  const [scoreError, setScoreError] = useState<Record<number, string>>({});
  const [pick, setPick] = useState<{ kind: 'word' | 'meaning'; index: number; } | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [matchWrong, setMatchWrong] = useState<string[]>([]);
  const [matchSuccess, setMatchSuccess] = useState<number | null>(null);
  const [newMatch, setNewMatch] = useState<number | null>(null);
  const [wordBankReviewed, setWordBankReviewed] = useState(false);
  const [tilePick, setTilePick] = useState<{ kind: 'word' | 'meaning'; index: number; } | null>(null);
  const [tileMatched, setTileMatched] = useState<number[]>([]);
  const [tileWrong, setTileWrong] = useState<string[]>([]);
  const [tileClearing, setTileClearing] = useState<string[]>([]);
  const [tileSide, setTileSide] = useState<number[]>([]);
  const [tileCelebration, setTileCelebration] = useState<{ index: number; stage: 'show' | 'flying' } | null>(null);
  const [tileNewSide, setTileNewSide] = useState<number | null>(null);
  const [tileShuffleKey, setTileShuffleKey] = useState(0);
  const [contexts, setContexts] = useState<Record<number, string>>({});
  const [contextPick, setContextPick] = useState<string | null>(null);
  const [contextsChecked, setContextsChecked] = useState(false);
  const [contextWrong, setContextWrong] = useState<number[]>([]);
  const [contextShake, setContextShake] = useState(false);
  const [contextReturned, setContextReturned] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answersChecked, setAnswersChecked] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<number[]>([]);
  const [rebuild, setRebuild] = useState<number[]>([]);
  const [rebuildPick, setRebuildPick] = useState<number | null>(null);
  const [rebuildChecked, setRebuildChecked] = useState(false);
  const [rebuildFeedback, setRebuildFeedback] = useState<number[]>([]);
  const [tableAnswers, setTableAnswers] = useState<Record<number, string>>({});
  const [tablePick, setTablePick] = useState<string | null>(null);
  const [tableChecked, setTableChecked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const blobs = useRef<Record<number, Blob>>({});
  const recordingDataUrls = useRef<Record<number, string>>({});
  const recordingObjectUrls = useRef(new Set<string>());
  const scoresRef = useRef<Record<number, PronunciationScoreResult>>({});
  const recordingPending = useRef(false);
  const speechToken = useRef(0);
  const seekWasPlaying = useRef(false);
  const recordingStartedAt = useRef(0);
  const contextFeedbackTimer = useRef<number | null>(null);

  useEffect(() => {
    const saved = progressFor(course.cardId);
    const requestedModule = modules.findIndex(([id]) => id === saved.lastModule);
    const canResume = requestedModule >= 0 && modules.slice(0, requestedModule).every(([id]) => saved.moduleStatus[id]?.completed);
    setProgress(saved); setActive(canResume ? modules[requestedModule][0] : 'reading'); setAnswers(Object.fromEntries(Object.entries(saved.answers || {}).filter(([key]) => key.startsWith('comp:')))); setRebuild(saved.rebuild || []);
    setMatched((saved.answers?.wordMatches || '').split(',').filter(Boolean).map(Number));
    const savedTiles = (saved.answers?.wordTiles || '').split(',').filter(Boolean).map(Number);
    setTileMatched(savedTiles); setTileSide(savedTiles);
    setWordBankReviewed(saved.answers?.wordBankReviewed === 'true');
    setContexts(Object.fromEntries(Object.entries(saved.answers || {}).filter(([key]) => key.startsWith('context:')).map(([key, value]) => [Number(key.slice(8)), value])));
    setContextsChecked(Boolean(saved.checked?.words)); setAnswersChecked(Boolean(saved.checked?.comprehension)); setRebuildChecked(Boolean(saved.checked?.rebuild));
    setTableAnswers(Object.fromEntries(Object.entries(saved.answers || {}).filter(([key]) => key.startsWith('table:')).map(([key, value]) => [Number(key.slice(6)), value])));
    setTableChecked(Boolean(saved.checked?.rebuild));
  }, [course.cardId]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`fsr:rec:${course.cardId}`);
      if (!raw) return;
      const stored = JSON.parse(raw) as Record<number, StoredRecording>;
      const savedRecordings: Record<number, string> = {};
      const savedScores: Record<number, PronunciationScoreResult> = {};
      Object.entries(stored).forEach(([key, value]) => {
        const index = Number(key);
        if (value.audio) { savedRecordings[index] = value.audio; recordingDataUrls.current[index] = value.audio; }
        if (value.score) savedScores[index] = value.score;
      });
      scoresRef.current = savedScores;
      setRecordings(savedRecordings);
      setScores(savedScores);
    } catch { /* Ignore malformed local recording state, matching the reference page. */ }
  }, [course.cardId]);
  useEffect(() => () => {
    recorderRef.current?.stream.getTracks().forEach(track => track.stop());
    recordingObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
    recordingObjectUrls.current.clear();
  }, []);
  useEffect(() => {
    if (recording === null) { setRecordingElapsed(0); return; }
    const update = () => setRecordingElapsed((Date.now() - recordingStartedAt.current) / 1000);
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  const isDone = (id: ModuleId) => Boolean(progress.moduleStatus[id]?.completed);
  const doneCount = modules.filter(([id]) => isDone(id)).length;
  const save = (next: Partial<LearningProgress>, module = active) => { const value = { ...progress, ...next, cardId: course.cardId, lastModule: module, updatedAt: new Date().toISOString() }; setProgress(value); saveProgress(value); };
  const complete = (id: ModuleId, score = 100, answersValue = progress.answers, checked = progress.checked) => { const moduleStatus = { ...progress.moduleStatus, [id]: { completed: true, score } }; save({ moduleStatus, answers: answersValue, checked, completedPercent: Math.round(modules.filter(([name]) => moduleStatus[name]?.completed).length / modules.length * 100) }, id); };
  const open = (id: ModuleId) => { setActive(id); setProgress(value => { const next = { ...value, lastModule: id, updatedAt: new Date().toISOString() }; saveProgress(next); return next; }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const wordAudioFile = (word: string) => `${word.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.mp3`;
  const speakWord = (word: string) => {
    if (!('Audio' in window) && !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    audioRef.current?.pause();
    setAllPlaying(false); setPreviewing(null);
    const audio = new Audio(`/audio/words/${encodeURIComponent(wordAudioFile(word))}`);
    let fellBack = false;
    const fallback = () => { if (!fellBack) { fellBack = true; speak(word); } };
    audio.onerror = fallback;
    void audio.play().catch(fallback);
  };
  const speak = (text: string, index?: number, overrideRate = rate) => { if (!('speechSynthesis' in window)) return; const token = ++speechToken.current; speechSynthesis.cancel(); audioRef.current?.pause(); setAllPlaying(false); setPreviewing(index ?? null); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = overrideRate; utterance.onend = () => { if (speechToken.current === token) setPreviewing(null); }; utterance.onerror = () => { if (speechToken.current === token) setPreviewing(null); }; speechSynthesis.speak(utterance); };
  const speakAll = (startIndex = playbackProgress >= 100 ? 0 : Math.floor(playbackProgress / 100 * sentences.length), overrideRate = rate, forceRestart = false) => {
    if (allPlaying && !forceRestart) { speechToken.current += 1; speechSynthesis.cancel(); audioRef.current?.pause(); setAllPlaying(false); setPlaying(null); setPreviewing(null); return; }
    setPreviewing(null);
    if (audioRef.current) { audioRef.current.playbackRate = overrideRate; void audioRef.current.play(); return; }
    const token = ++speechToken.current;
    let index = Math.min(startIndex, Math.max(sentences.length - 1, 0)); setAllPlaying(true);
    const next = () => { if (speechToken.current !== token) return; if (index >= sentences.length) { setPlaying(null); setAllPlaying(false); setPlaybackProgress(100); complete('reading'); return; } const current = index; const text = sentences[index++]; setPlaying(current); setPlaybackProgress(Math.round(current / Math.max(sentences.length, 1) * 100)); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = overrideRate; utterance.onboundary = event => { if (speechToken.current !== token || event.name !== 'word') return; const fraction = event.charIndex / Math.max(text.length, 1); setPlaybackProgress(Math.min(99, Math.round((current + fraction) / Math.max(sentences.length, 1) * 100))); }; utterance.onend = () => { if (speechToken.current === token) window.setTimeout(next, 600); }; speechSynthesis.speak(utterance); };
    speechSynthesis.cancel(); next();
  };
  const previewSeek = (value: number) => { const next = Math.max(0, Math.min(100, value)); const index = Math.min(sentences.length - 1, Math.floor(next / 100 * sentences.length)); setPlaybackProgress(next); setPreviewing(index); setAllPlaying(false); if (audioRef.current?.duration) { audioRef.current.currentTime = audioRef.current.duration * next / 100; audioRef.current.playbackRate = rate; void audioRef.current.play(); } else if (sentences[index]) speak(sentences[index], index); };
  const finishSeek = (value: number) => { const next = Math.max(0, Math.min(100, value)); const index = Math.min(sentences.length - 1, Math.floor(next / 100 * sentences.length)); setPreviewing(null); if (seekWasPlaying.current) { setAllPlaying(false); speakAll(index); } else { speechToken.current += 1; speechSynthesis.cancel(); audioRef.current?.pause(); setPlaying(index); } seekWasPlaying.current = false; };
  const changeRate = (value: number) => { const next = Math.max(.6, Math.min(1.1, value)); setRate(next); if (audioRef.current) audioRef.current.playbackRate = next; if (allPlaying && playing !== null && !audioRef.current) { speechToken.current += 1; speechSynthesis.cancel(); setAllPlaying(false); window.setTimeout(() => speakAll(playing, next, true), 0); } else if (previewing !== null && !audioRef.current) speak(sentences[previewing], previewing, next); };
  const persistRecordingState = (scoreState = scoresRef.current) => {
    try {
      const data: Record<number, StoredRecording> = {};
      practice.forEach((_, index) => {
        const audio = recordingDataUrls.current[index] || null;
        if (scoreState[index] || audio) data[index] = { score: scoreState[index] || null, audio };
      });
      localStorage.setItem(`fsr:rec:${course.cardId}`, JSON.stringify(data));
    } catch { /* Recording persistence is best effort, matching the reference page. */ }
  };
  const toggleRecording = async (index: number) => {
    if (recorderRef.current?.state === 'recording') {
      if (recording === index) recorderRef.current.stop();
      return;
    }
    if (recordingPending.current) return;
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setScoreError(value => ({ ...value, [index]: '当前浏览器不支持录音，可通过全文朗读完成本模块。' }));
      return;
    }
    recordingPending.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunks.current = [];
      recorder.ondataavailable = event => chunks.current.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunks.current, { type: recorder.mimeType || 'audio/webm' });
        const oldUrl = recordings[index];
        if (oldUrl && recordingObjectUrls.current.has(oldUrl)) {
          URL.revokeObjectURL(oldUrl);
          recordingObjectUrls.current.delete(oldUrl);
        }
        const nextUrl = URL.createObjectURL(blob);
        recordingObjectUrls.current.add(nextUrl);
        blobs.current[index] = blob;
        setRecordings(value => ({ ...value, [index]: nextUrl }));
        const nextScores = { ...scoresRef.current };
        delete nextScores[index];
        scoresRef.current = nextScores;
        setScores(nextScores);
        setScoring(value => { const next = { ...value }; delete next[index]; return next; });
        setUnrecognized(value => { const next = { ...value }; delete next[index]; return next; });
        setScoreError(value => ({ ...value, [index]: '' }));
        setRecordingPlaying(value => value === index ? null : value);
        recorderRef.current = null;
        setRecording(null);
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') recordingDataUrls.current[index] = reader.result;
          persistRecordingState();
        };
        reader.readAsDataURL(blob);
        persistRecordingState(nextScores);
        void submitRecording(index);
      };
      recorder.start();
      recorderRef.current = recorder;
      recordingStartedAt.current = Date.now();
      setRecordingElapsed(0);
      setRecording(index);
      setScoreError(value => ({ ...value, [index]: '' }));
    } catch {
      setRecording(null);
      setScoreError(value => ({ ...value, [index]: '没有获得麦克风权限，请在浏览器设置中允许录音。' }));
    } finally {
      recordingPending.current = false;
    }
  };
  const submitRecording = async (index: number) => {
    const blob = blobs.current[index];
    if (!blob) return;
    const endpoint = process.env.NEXT_PUBLIC_SCORING_ENDPOINT || (location.hostname === 'localhost' ? 'http://127.0.0.1:8787/score' : '');
    if (!endpoint) {
      setScoreError(value => ({ ...value, [index]: '尚未配置独立评分服务地址；录音可在本页试听。' }));
      return;
    }
    setScoring(value => ({ ...value, [index]: true }));
    setScoreError(value => ({ ...value, [index]: '' }));
    try {
      const form = new FormData();
      form.append('audio', blob, `rec-${index}.webm`);
      form.append('text', practice[index]);
      const response = await fetch(endpoint, { method: 'POST', body: form });
      if (!response.ok) throw new Error('评分服务暂时不可用，请稍后再试。');
      const result = await response.json() as PronunciationScoreResult;
      if (result.recognized === false) {
        setUnrecognized(value => ({ ...value, [index]: true }));
        persistRecordingState();
        return;
      }
      const nextScores = { ...scoresRef.current, [index]: result };
      scoresRef.current = nextScores;
      setScores(nextScores);
      setUnrecognized(value => ({ ...value, [index]: false }));
      persistRecordingState(nextScores);
      if (Object.keys(nextScores).length === practice.length) complete('reading');
    } catch (error) {
      setScoreError(value => ({ ...value, [index]: error instanceof Error ? error.message : '评分失败，请重试。' }));
    } finally {
      setScoring(value => { const next = { ...value }; delete next[index]; return next; });
    }
  };
  const toggleRecordingPlayback = (index: number) => { const audio = document.getElementById(`recording-${index}`) as HTMLAudioElement | null; if (!audio) return; if (audio.paused) void audio.play().catch(() => {}); else audio.pause(); };
  const completeWordsIfReady = (matchCount = matched.length, tileCount = tileMatched.length, contextValues = contexts, answersValue = progress.answers, contextVerified = contextsChecked) => { if (matchCount === pairs.length && tileCount === course.word_bank.length && (!contextQuestions.length || contextVerified) && contextQuestions.every((item, index) => contextValues[index] === item.answer)) complete('words', 100, answersValue, { ...progress.checked, words: true }); };
  const chooseMatch = (kind: 'word' | 'meaning', index: number) => {
    if (matched.includes(index)) return;
    if (!pick || pick.kind === kind) return setPick({ kind, index });
    if (pick.index === index) {
      const next = [...matched, index];
      const nextAnswers = { ...progress.answers, wordMatches: next.join(',') };
      setPick(null); setMatchWrong([]); setMatchSuccess(index);
      window.setTimeout(() => { setMatched(next); setMatchSuccess(null); setNewMatch(index); window.setTimeout(() => setNewMatch(null), 340); save({ answers: nextAnswers }); completeWordsIfReady(next.length, tileMatched.length, contexts, nextAnswers); }, 450);
    } else {
      setMatchWrong([`${pick.kind}:${pick.index}`, `${kind}:${index}`]); setPick(null);
      window.setTimeout(() => setMatchWrong([]), 1000);
    }
  };
  const resetMatch = () => { setMatched([]); setMatchWrong([]); setMatchSuccess(null); setNewMatch(null); setPick(null); save({ answers: { ...progress.answers, wordMatches: '' } }); };
  const chooseTile = (kind: 'word' | 'meaning', index: number) => {
    if (tileMatched.includes(index) || tileCelebration) return;
    if (!tilePick || tilePick.kind === kind) return setTilePick({ kind, index });
    if (tilePick.index === index) {
      const next = [...tileMatched, index];
      setTileWrong([]); setTileClearing([`${tilePick.kind}-${index}`, `${kind}-${index}`]); setTileCelebration({ index, stage: 'show' });
      window.setTimeout(() => {
        setTileMatched(next); setTilePick(null); setTileClearing([]); setTileCelebration({ index, stage: 'flying' }); save({ answers: { ...progress.answers, wordTiles: next.join(',') } });
        const nextAnswers = { ...progress.answers, wordTiles: next.join(',') };
        window.setTimeout(() => { setTileSide(value => value.includes(index) ? value : [...value, index]); setTileNewSide(index); setTileCelebration(null); window.setTimeout(() => setTileNewSide(null), 420); completeWordsIfReady(matched.length, next.length, contexts, nextAnswers); }, 420);
      }, 350);
    } else {
      setTileWrong([`${tilePick.kind}-${tilePick.index}`, `${kind}-${index}`]); setTilePick(null);
      window.setTimeout(() => setTileWrong([]), 650);
    }
  };
  const contextAnswers = (values: Record<number, string>) => ({ ...Object.fromEntries(Object.entries(progress.answers).filter(([key]) => !key.startsWith('context:'))), ...Object.fromEntries(Object.entries(values).map(([key, answer]) => [`context:${key}`, answer])) });
  const setContext = (index: number, value: string) => { const next = Object.fromEntries(Object.entries(contexts).filter(([key, answer]) => Number(key) === index || answer !== value)) as Record<number, string>; next[index] = value; setContexts(next); setContextPick(null); setContextsChecked(false); setContextWrong([]); setContextShake(false); setContextReturned(words => words.filter(word => word !== value)); save({ answers: contextAnswers(next), checked: { ...progress.checked, words: false } }); if (Object.keys(next).length === contextQuestions.length) window.setTimeout(() => checkWords(next), 400); };
  const returnContextWord = (index: number) => { const returned = contexts[index]; const next = Object.fromEntries(Object.entries(contexts).filter(([key]) => Number(key) !== index)) as Record<number, string>; setContexts(next); setContextsChecked(false); setContextWrong([]); setContextReturned(returned ? [returned] : []); window.setTimeout(() => setContextReturned([]), 650); save({ answers: contextAnswers(next), checked: { ...progress.checked, words: false } }); };
  const resetContexts = () => { if (contextFeedbackTimer.current) window.clearTimeout(contextFeedbackTimer.current); setContexts({}); setContextPick(null); setContextsChecked(false); setContextWrong([]); setContextShake(false); setContextReturned([]); save({ answers: contextAnswers({}), checked: { ...progress.checked, words: false } }); };
  const checkWords = (contextValues = contexts) => { const checked = { ...progress.checked, words: true }; const wrong = contextQuestions.map((item, index) => contextValues[index] === item.answer ? -1 : index).filter(index => index >= 0); const kept = Object.fromEntries(Object.entries(contextValues).filter(([key]) => !wrong.includes(Number(key)))) as Record<number, string>; const answersValue = contextAnswers(kept); setContexts(kept); setContextsChecked(true); setContextWrong(wrong); setContextShake(wrong.length > 0); setContextReturned(wrong.map(index => contextValues[index]).filter(Boolean)); window.setTimeout(() => setContextReturned([]), 650); save({ answers: answersValue, checked }); if (wrong.length === 0) completeWordsIfReady(matched.length, tileMatched.length, contextValues, answersValue, true); else { if (contextFeedbackTimer.current) window.clearTimeout(contextFeedbackTimer.current); contextFeedbackTimer.current = window.setTimeout(() => { setContextWrong([]); setContextShake(false); }, 2000); } };
  const setAnswer = (index: number, value: string) => { const next = { ...answers, [`comp:${index}`]: value }; const answersValue = { ...Object.fromEntries(Object.entries(progress.answers).filter(([key]) => !key.startsWith('comp:'))), ...next }; setAnswers(next); save({ answers: answersValue, checked: { ...progress.checked, comprehension: answersChecked } }); if (answersChecked) { const allCorrect = course.comprehension.questions.every((item, questionIndex) => next[`comp:${questionIndex}`] === item.answer); setAnswerFeedback([index]); window.setTimeout(() => setAnswerFeedback([]), 520); if (allCorrect) complete('comprehension', 100, answersValue, { ...progress.checked, comprehension: true }); else { const moduleStatus: LearningProgress['moduleStatus'] = { ...progress.moduleStatus, comprehension: { completed: false, score: 0 } }; save({ answers: answersValue, moduleStatus, completedPercent: Math.round(modules.filter(([id]) => moduleStatus[id]?.completed).length / modules.length * 100) }); } return; } if (Object.keys(next).length === course.comprehension.questions.length) window.setTimeout(() => checkAnswers(next), 400); };
  const checkAnswers = (values = answers) => { if (Object.keys(values).length !== course.comprehension.questions.length) return; const checked = { ...progress.checked, comprehension: true }; const answersValue = { ...Object.fromEntries(Object.entries(progress.answers).filter(([key]) => !key.startsWith('comp:'))), ...values }; setAnswersChecked(true); setAnswerFeedback(course.comprehension.questions.map((_, index) => index)); window.setTimeout(() => setAnswerFeedback([]), 520); save({ answers: answersValue, checked }); if (course.comprehension.questions.every((item, index) => values[`comp:${index}`] === item.answer)) complete('comprehension', 100, answersValue, checked); };
  const resetAnswers = () => {
    const answersValue = Object.fromEntries(Object.entries(progress.answers).filter(([key]) => !key.startsWith('comp:')));
    const moduleStatus: LearningProgress['moduleStatus'] = { ...progress.moduleStatus, comprehension: { completed: false, score: 0 } };
    setAnswers({}); setAnswersChecked(false); setAnswerFeedback([]);
    save({ answers: answersValue, moduleStatus, checked: { ...progress.checked, comprehension: false }, completedPercent: Math.round(modules.filter(([id]) => moduleStatus[id]?.completed).length / modules.length * 100) });
  };
  const placeRebuildChoice = (choice: number, position: number) => { const next = rebuild.length === steps.length ? [...rebuild] : Array(steps.length).fill(-1); const previous = next.indexOf(choice); if (previous >= 0) [next[previous], next[position]] = [next[position], next[previous]]; else next[position] = choice; const wasChecked = rebuildChecked; setRebuild(next); setRebuildPick(null); save({ rebuild: next, checked: { ...progress.checked, rebuild: wasChecked } }); if (!next.includes(-1)) { if (wasChecked) checkRebuild(next, previous >= 0 ? [previous, position] : [position]); else window.setTimeout(() => checkRebuild(next), 400); } };
  const placeRebuild = (position: number) => { if (rebuildPick !== null) placeRebuildChoice(rebuildPick, position); };
  const moveRebuild = (from: number, to: number) => { if (to < 0 || to >= shownRebuild.length) return; const next = [...shownRebuild]; [next[from], next[to]] = [next[to], next[from]]; const wasChecked = rebuildChecked; setRebuild(next); save({ rebuild: next, checked: { ...progress.checked, rebuild: wasChecked } }); if (!next.includes(-1)) { if (wasChecked) checkRebuild(next, [from, to]); else window.setTimeout(() => checkRebuild(next), 400); } };
  const checkRebuild = (values = rebuild, feedback = values.map((_, index) => index)) => { if (values.length !== steps.length || values.includes(-1)) return; const score = Math.round(values.filter((value, index) => value === index).length / steps.length * 100); setRebuildChecked(true); setRebuildFeedback(feedback); window.setTimeout(() => setRebuildFeedback([]), 520); complete('rebuild', score, progress.answers, { ...progress.checked, rebuild: true }); };
  const tableChoices = tableRows.map((row, index) => ({ id: `${index}:${index % 2 ? 'left' : 'right'}`, text: row[index % 2 ? 0 : 1] }));
  const placeTableChoice = (choice: string, row: number) => {
    const next = { ...tableAnswers };
    const previousRow = Object.entries(next).find(([, value]) => value === choice)?.[0];
    const displaced = next[row];
    if (previousRow !== undefined && Number(previousRow) !== row) { if (displaced) next[Number(previousRow)] = displaced; else delete next[Number(previousRow)]; }
    next[row] = choice;
    const nextAnswers = { ...progress.answers, ...Object.fromEntries(Object.entries(next).map(([key, value]) => [`table:${key}`, value])) };
    const wasChecked = tableChecked;
    setTableAnswers(next); setTablePick(null); save({ answers: nextAnswers, checked: { ...progress.checked, rebuild: wasChecked } });
    if (Object.keys(next).length === tableRows.length) { if (wasChecked) checkTable(next, previousRow !== undefined ? [Number(previousRow), row] : [row]); else window.setTimeout(() => checkTable(next), 400); }
  };
  const placeTable = (row: number) => { if (tablePick !== null) placeTableChoice(tablePick, row); };
  const checkTable = (values = tableAnswers, feedback = tableRows.map((_, index) => index)) => { if (Object.keys(values).length !== tableRows.length) return; const score = Math.round(tableChoices.filter((choice, index) => values[index] === choice.id).length / tableRows.length * 100); const nextAnswers = { ...progress.answers, ...Object.fromEntries(Object.entries(values).map(([key, value]) => [`table:${key}`, value])) }; setTableChecked(true); setRebuildFeedback(feedback); window.setTimeout(() => setRebuildFeedback([]), 520); complete('rebuild', score, nextAnswers, { ...progress.checked, rebuild: true }); };
  const resetRebuild = () => {
    const answersValue = Object.fromEntries(Object.entries(progress.answers).filter(([key]) => !key.startsWith('table:')));
    const moduleStatus: LearningProgress['moduleStatus'] = { ...progress.moduleStatus, rebuild: { completed: false, score: 0 } };
    setRebuild([]); setRebuildPick(null); setRebuildChecked(false); setRebuildFeedback([]); setTableAnswers({}); setTablePick(null); setTableChecked(false);
    save({ answers: answersValue, rebuild: [], moduleStatus, checked: { ...progress.checked, rebuild: false }, completedPercent: Math.round(modules.filter(([id]) => moduleStatus[id]?.completed).length / modules.length * 100) });
  };
  const shownRebuild = rebuild.length === steps.length ? rebuild : Array(steps.length).fill(-1);
  const availableContextWords = [...new Set(contextQuestions.map(question => question.answer))].filter(word => !Object.values(contexts).includes(word));
  const rebuildLabels = rebuildType === 'feature-function' ? ['Features', 'Functions'] : rebuildType === 'cause-effect' ? ['Causes', 'Effects'] : rebuildType === 'compare-contrast' ? ['Compare', 'Contrast'] : ['Facts / Features', 'Explanations'];

  return <>
<SiteHeader active="courses" sticky={false} />
    <main className="shell">
    <section className="panel lesson-head">
<div>
<div className="lesson-meta">
<span className="badge">DAY {String(course.day).padStart(3, '0')}</span>
<span className="badge">{course.level}</span>
<span className="badge">{course.theme}</span>
<span className="badge warning">{course.articleStructure || course.structure}</span>
</div>
<h1 className="page-title">{course.title}</h1>
<p className="muted">{course.bigQuestion}</p>
</div>
<div className="total-progress">
<span>{doneCount} / 4 模块完成</span>
<div className="progress">
<span style={{ width: `${doneCount * 25}%` }} />
</div>
</div>
</section>
    <nav className="panel module-nav" aria-label="学习模块">{modules.map(([id, label], index) => <button key={id} type="button" className={`module-tab ${active === id ? 'active' : ''} ${isDone(id) ? 'done' : ''} ${index > 0 && !isDone(modules[index - 1][0]) ? 'locked' : ''}`} disabled={index > 0 && !isDone(modules[index - 1][0])} onClick={() => open(id)}>
<span />{label}</button>)}</nav>
    <section className="workspace">
      {active === 'reading' && <>
<section className="panel lesson-card">
<div className="lesson-card-image">
<img className="cover" src={`/course-images/${encodeURIComponent(course.image_file || '')}`} alt={`${course.title} 科普阅读卡片`} />
</div>
<div className="article-copy">
<div className="article-head">
<TaskTitle task="Task 1" name="Listen" />
<p className="muted">点击“▶”播放，听音跟读</p>
</div>
<section className="combined-listening">
<div className="listen-stage">
<div className="player">
<button className="play-round" type="button" aria-label={allPlaying ? '暂停全文朗读' : playbackProgress > 0 && playbackProgress < 100 ? '继续播放全文朗读' : '播放全文朗读'} onClick={() => speakAll()}>{allPlaying ? <PauseIcon /> : <PlayIcon />}</button>
<div className="player-main">
<div className="player-top">
<strong className="player-status">{previewing !== null ? `试听 · 第 ${previewing + 1} 句` : allPlaying && playing !== null ? `正在播放第 ${playing + 1} 句` : playbackProgress >= 100 ? '已读完' : playing !== null ? `已暂停 · 第 ${playing + 1} 句` : '全文朗读'}</strong>
<div className="speed-control"><label htmlFor="speed-slider">语速</label><input id="speed-slider" className="speed-slider" style={{ '--speed-fill': `${(rate - .6) / .5 * 100}%` } as React.CSSProperties} type="range" min="0.6" max="1.1" step="0.1" value={rate} aria-label="调整朗读倍速" onInput={event => changeRate(Number(event.currentTarget.value))} />
<span className="speed-value">{rate.toFixed(1)}x</span>
</div>
</div>
<input className="playback-seek" type="range" min="0" max="1000" step="1" value={Math.round(playbackProgress * 10)} style={{ '--seek-fill': `${playbackProgress}%` } as React.CSSProperties} aria-label="朗读进度，可拖动跳转" onPointerDown={() => { seekWasPlaying.current = allPlaying; }} onKeyDown={() => { seekWasPlaying.current = allPlaying; }} onChange={event => previewSeek(Number(event.target.value) / 10)} onPointerUp={event => finishSeek(Number(event.currentTarget.value) / 10)} onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) finishSeek(Number(event.currentTarget.value) / 10); }} />
<div className="playback-meta"><span>{playing !== null ? `第 ${playing + 1} / ${sentences.length} 句` : '准备播放'}</span><span>{Math.round(playbackProgress)}%</span></div>
{course.audioDirectory && <audio ref={audioRef} hidden src={`/audio/${course.audioDirectory}/full.mp3`} onPlay={() => setAllPlaying(true)} onPause={() => setAllPlaying(false)} onTimeUpdate={event => { const audio = event.currentTarget; if (!audio.duration) return; const value = audio.currentTime / audio.duration * 100; setPlaybackProgress(value); setPlaying(Math.min(sentences.length - 1, Math.floor(value / 100 * sentences.length))); }} onEnded={() => { setAllPlaying(false); setPlaying(null); setPlaybackProgress(100); complete('reading'); }} />}</div>
</div>
</div>
</section>
<div className="reading-copy">{sentences.map((text, index) => <p key={`${text}-${index}`}>
<span className="reading-sentence">
<span className="sentence-line">
<span className="sentence-controls"><button className="sentence-speaker" type="button" aria-label={`播放句子 ${index + 1}`} onClick={() => speak(text, index)}><SpeakerIcon /></button></span>
<span className="sentence-content">
<span className={`sentence ${(previewing ?? playing) === index ? 'current' : ''}`}>{text}</span>
<small className={`sentence-translation ${translationOpen.includes(index) ? '' : 'is-hidden'}`} aria-label="中文翻译">{sentenceTranslations[index] || '暂无中文翻译'}</small>
</span>
<span className="translation-row"><button className="translation-toggle" type="button" aria-expanded={translationOpen.includes(index)} onClick={() => setTranslationOpen(value => value.includes(index) ? value.filter(item => item !== index) : [...value, index])}>{translationOpen.includes(index) ? '收起' : '翻译'}</button></span></span>
</span>
</p>)}</div>
</div>
<div className="full-translate"><button className="btn" type="button" onClick={() => setAllTranslation(value => !value)}>{allTranslation ? '收起全文翻译' : '全文翻译'}</button>{allTranslation && <div className="full-translate-panel"><p className="ft-zh">{sentenceTranslations.filter(Boolean).join('') || '暂无中文翻译'}</p></div>}</div>
</section>
<section className="practice-section">
<section className="panel practice-shell">
<div className="practice-intro">
<div>
<TaskTitle task="Task 2" name="Read" />
<p className="muted">点击“听示范”熟悉语音，再开始录音。</p>
</div>
<span className={`badge ${Object.keys(scores).length === practice.length ? 'success' : ''}`}>{Object.keys(scores).length === practice.length ? '已完成' : `${Object.keys(scores).length} / ${practice.length} 已提交`}</span>
</div>
<div className="practice-card-list">{practice.map((text, index) => <article className={`record-box ${recording === index ? 'recording' : ''} ${scores[index] ? 'complete' : ''}`} key={`${text}-${index}`}>
<div className="practice-card-number">第 {index + 1} / {practice.length} 句{scores[index] ? ' · 已评分' : ''}</div>
<div className="practice-sentence-row"><blockquote>{text}</blockquote><button className="btn demo" type="button" onClick={() => speak(text, index)}>听示范</button></div>
{recording === index ? <div className="voice-bar recording" onClick={() => void toggleRecording(index)}><span className="rec-dot" aria-hidden="true" /><div className="voice-wave playing" aria-hidden="true">{Array.from({ length: 16 }, (_, bar) => <i key={bar} data-pct={Math.round((bar + 1) / 16 * 100)} />)}</div><b className="rec-timer">{fmtTime(recordingElapsed)}</b><span className="rec-label">录音中</span><span className="voice-stop">■ 停止</span></div> : recordings[index] ? <div className="voice-bar" role="button" tabIndex={0} onClick={() => toggleRecordingPlayback(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleRecordingPlayback(index); } }}><button className="voice-play" type="button" aria-label={recordingPlaying === index ? '暂停录音' : '播放录音'} onClick={event => { event.stopPropagation(); toggleRecordingPlayback(index); }}>{recordingPlaying === index ? <PauseIcon /> : <PlayIcon />}</button><div className={`voice-wave ${recordingPlaying === index ? 'playing' : ''}`} aria-hidden="true">{Array.from({ length: 16 }, (_, bar) => <i key={bar} data-pct={Math.round((bar + 1) / 16 * 100)} className={(recordingTimes[index]?.duration || 0) && (bar + 1) / 16 <= (recordingTimes[index]?.current || 0) / recordingTimes[index].duration ? 'played' : ''} />)}</div><span className="voice-time">{fmtTime(recordingTimes[index]?.current || 0)} / {fmtTime(recordingTimes[index]?.duration || 0)}</span><button className="voice-rerecord" type="button" onClick={event => { event.stopPropagation(); void toggleRecording(index); }}>重录</button>{scores[index] && <span className={`voice-score ${pronunciationScoreBand(pronunciationScore(scores[index]))}`}>{pronunciationScore(scores[index])}<i>分</i></span>}<audio id={`recording-${index}`} hidden preload="auto" src={recordings[index]} onLoadedMetadata={event => { const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0; setRecordingTimes(value => ({ ...value, [index]: { current: 0, duration } })); }} onDurationChange={event => { const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0; setRecordingTimes(value => ({ ...value, [index]: { current: value[index]?.current || 0, duration } })); }} onTimeUpdate={event => { const current = event.currentTarget.currentTime || 0; const duration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0; setRecordingTimes(value => ({ ...value, [index]: { current, duration: duration || value[index]?.duration || 0 } })); }} onPlay={() => setRecordingPlaying(index)} onPause={() => setRecordingPlaying(value => value === index ? null : value)} onEnded={event => { event.currentTarget.currentTime = 0; setRecordingTimes(value => ({ ...value, [index]: { current: 0, duration: value[index]?.duration || 0 } })); setRecordingPlaying(null); }} /></div> : <div className="voice-bar empty" role="button" tabIndex={0} onClick={() => void toggleRecording(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void toggleRecording(index); } }}><span className="voice-empty-text">0:00 / 0:00 · 点击开始录音哦~</span></div>}
{unrecognized[index] && <p className="ai-note unrecognized">好像没有听清你的声音，请点击「重录」再试一次。</p>}
{scoring[index] && <div className="score-result loading">正在评分…</div>}
{scoreError[index] && <div className="error-banner"><div className="error-banner-copy"><strong>录音评分暂不可用</strong><p>{scoreError[index]}</p></div><div className="error-banner-actions"><button className="btn" type="button" onClick={() => blobs.current[index] ? void submitRecording(index) : void toggleRecording(index)}>{blobs.current[index] ? '重试评分' : '重新录音'}</button></div></div>}{scores[index] && <ScoreCard result={scores[index]} />}</article>)}</div>
</section>
<Footer previous={previousLesson ? `/learn/${previousLesson}` : undefined} text="完成听读后进入下一关" action={() => { complete('reading'); open('words'); }} />
</section>
</>}
      {active === 'words' && <section className="panel practice-shell">
<section>
<div className="word-bank-head">
<TaskTitle task="Task 3" name="Words" />
{wordBankReviewed && <button className="link-btn" type="button" onClick={() => { setWordBankReviewed(false); save({ answers: { ...progress.answers, wordBankReviewed: 'false' } }); }}>回看单词</button>}
</div>
<p className="muted words-guide">{wordBankReviewed ? '练习时点右上角「回看单词」可回到词卡复习。' : '先记住这些单词，再开始配对练习。'}</p>{!wordBankReviewed && <>
<div className="word-bank-box">{bankSlots.map((item, index) => item ? <article className="word-card" key={item.english}>
<span className="word-card-image" aria-hidden="true" />
<span className="word-card-copy">
<strong className="word-card-word">{item.english}<button className="word-card-sound" type="button" aria-label={`播放 ${item.english} 发音`} onClick={() => speakWord(item.english)}><SpeakerIcon /></button></strong>
<small>{item.chinese}</small>
</span>
</article> : <span className="word-card empty" aria-hidden="true" key={`empty-${index}`} />)}</div>
<div className="btn-row word-bank-actions">
<button className="btn primary" type="button" onClick={() => { setWordBankReviewed(true); save({ answers: { ...progress.answers, wordBankReviewed: 'true' } }); }}>开始配对 →</button>
</div>
</>}</section>{wordBankReviewed && <div className="words-practice">
<div className="practice-intro">
<div>
<p className="eyebrow">Meaning Match</p>
<h2 className="section-title">词义配对</h2>
</div>
<div className="intro-actions"><span className={`badge ${matched.length === pairs.length ? 'success' : ''}`}>{matched.length} / {pairs.length} 已配对</span><button className="link-btn" type="button" onClick={resetMatch}>重置配对</button></div>
</div>
<p className="muted words-desc">将核心词与其对应的中文含义连线配对。先点击左侧的单词，再点击右侧的含义，配对正确即被锁定。</p>{matched.length > 0 && <div className="match-results-box"><p className="match-results-title"><CheckIcon />已配对 · {matched.length} / {pairs.length}</p>{matched.map((index, tone) => <article className={`match-result-chip ${newMatch === index ? 'is-new' : ''}`} data-tone={tone % 6} key={pairs[index].word}>
<strong>{pairs[index].word}</strong>
<span className="match-arrow">→</span>
<small>{pairs[index].meaning}</small>
</article>)}</div>}<div className="match-board">
<div className="match-column">{shuffle(pairs.map((item, index) => ({ ...item, index })), `${course.cardId}w`).filter(item => !matched.includes(item.index)).map(item => <button key={item.word} data-tone={(matched.includes(item.index) ? matched.indexOf(item.index) : matched.length) % 6} className={`match-choice ${pick?.kind === 'word' && pick.index === item.index ? 'selected' : ''} ${matchWrong.includes(`word:${item.index}`) ? 'wrong' : ''} ${matchSuccess === item.index ? 'correct' : ''}`} onClick={() => chooseMatch('word', item.index)} type="button">{item.word}{pick?.kind === 'word' && pick.index === item.index ? <span className="match-check"> ✓</span> : null}</button>)}</div>
<div className="match-column">{shuffle(pairs.map((item, index) => ({ ...item, index })), `${course.cardId}m`).filter(item => !matched.includes(item.index)).map(item => <button key={item.meaning} data-tone={(matched.includes(item.index) ? matched.indexOf(item.index) : matched.length) % 6} className={`match-choice ${pick?.kind === 'meaning' && pick.index === item.index ? 'selected' : ''} ${matchWrong.includes(`meaning:${item.index}`) ? 'wrong' : ''} ${matchSuccess === item.index ? 'correct' : ''}`} onClick={() => chooseMatch('meaning', item.index)} type="button">{item.meaning}{pick?.kind === 'meaning' && pick.index === item.index ? <span className="match-check"> ✓</span> : null}</button>)}</div>
</div>
<section className="subsection">
<div className="practice-intro">
<div>
<p className="eyebrow">Word Match</p>
<h2 className="section-title">消消乐</h2>
</div>
<span className={`badge ${tileMatched.length === course.word_bank.length ? 'success' : ''}`}>{tileMatched.length} / {course.word_bank.length} 已消除</span>
</div>
<p className="muted words-desc">从卡片中选出单词与图片的配对。先点击一张卡片，再点击其对应的另一张，配对成功则两张卡片同时消除。</p>
<div className="word-game-layout"><div className={`word-game-shell ${tileMatched.length === course.word_bank.length ? 'complete' : ''}`}>
{tileCelebration && <><div className={`word-match-burst eliminated ${tileCelebration.stage === 'show' ? 'burst-in' : 'flying'}`} role="status" aria-live="assertive"><div className="burst-card"><div className="burst-media"><WordIllustration word={course.word_bank[tileCelebration.index].english} label={course.word_bank[tileCelebration.index].chinese || course.word_bank[tileCelebration.index].english} /></div><strong>{course.word_bank[tileCelebration.index].english}</strong></div></div>{tileCelebration.stage === 'show' && <div className="word-modal-overlay" />}</>}
<div className="word-game-hud"><div className="word-game-score"><span>已消除</span><strong>{tileMatched.length} / {course.word_bank.length}</strong></div></div>
<div className="word-game-progress">{course.word_bank.map((_, index) => <span key={index} className={index < tileMatched.length ? 'done' : ''} />)}</div>
<div className="word-tile-board" role="group" aria-label={`单词与图片配对棋盘，剩余 ${course.word_bank.length - tileMatched.length} 组卡片`}>{shuffle(course.word_bank.flatMap((item, index) => [{ id: `word-${index}`, kind: 'word' as const, index, text: item.english }, { id: `meaning-${index}`, kind: 'meaning' as const, index, text: item.chinese || item.english }]), `${course.cardId}tiles${tileShuffleKey}`).map(item => tileMatched.includes(item.index) ? <span className="word-tile-slot" aria-hidden="true" key={item.id} /> : <button key={item.id} type="button" disabled={Boolean(tileCelebration)} aria-label={item.kind === 'word' ? `单词卡：${item.text}` : `图片卡：${item.text}`} className={`word-tile ${item.kind === 'word' ? 'word' : 'image'} ${tilePick?.kind === item.kind && tilePick.index === item.index ? 'selected' : ''} ${tileWrong.includes(item.id) ? 'mismatch' : ''} ${tileClearing.includes(item.id) ? 'clearing' : ''}`} onClick={() => { if (item.kind === 'word') speakWord(item.text); chooseTile(item.kind, item.index); }}>{item.kind === 'word' ? <strong className="word-tile-text">{item.text}</strong> : <WordIllustration word={course.word_bank[item.index].english} label={item.text} />}{tilePick?.kind === item.kind && tilePick.index === item.index && <span className="word-tile-pick"><CheckIcon /></span>}</button>)}</div>
<div className="word-tile-status"><div className="word-tile-status-copy"><span className="word-tile-status-icon">{tileMatched.length === course.word_bank.length || tileClearing.length ? <CheckIcon /> : <SearchIcon />}</span><p className={tileMatched.length === course.word_bank.length ? 'success-copy' : ''}>{tileMatched.length === course.word_bank.length ? '点击“洗牌”，重新开始吧！' : tileClearing.length ? '匹配成功，正在消除这组卡片' : tileWrong.length ? '差一点，这两张不是搭档，再看仔细些' : tilePick ? '已经锁定一张，现在找出对应的单词或图片' : '先选一张卡，再找出对应的单词或图片'}</p></div><button className="word-game-reset" type="button" onClick={() => { const moduleStatus: LearningProgress['moduleStatus'] = { ...progress.moduleStatus, words: { completed: false, score: 0 } }; setTileMatched([]); setTileSide([]); setTilePick(null); setTileWrong([]); setTileClearing([]); setTileCelebration(null); setTileShuffleKey(value => value + 1); save({ answers: { ...progress.answers, wordTiles: '' }, moduleStatus, completedPercent: Math.round(modules.filter(([id]) => moduleStatus[id]?.completed).length / modules.length * 100) }); }}>洗牌</button></div>
</div><aside className="word-side-panel" aria-label="已配对的单词"><div className="word-side-panel-title">已配对</div><div className="word-side-grid">{course.word_bank.map((item, index) => tileSide.includes(index) ? <div className={`word-side-card ${tileNewSide === index ? 'new-in' : ''}`} key={item.english}><div className="word-side-media"><WordIllustration word={item.english} label={item.chinese || item.english} /></div><strong className="word-side-word">{item.english}</strong></div> : <div className="word-side-card empty" aria-hidden="true" key={item.english}><span>?</span></div>)}</div></aside></div>
</section>
<section className="subsection context-practice">
<div className="context-head">
<div>
<p className="eyebrow">Fill the Gap</p>
<h2 className="section-title">填空挑战</h2><p className="muted">从上方备选词中拖动或点击单词，放入句子的空格。</p>
</div>
<button className="link-btn" type="button" onClick={resetContexts}>重新填空</button>
</div>
<div className="context-word-bank" aria-label="备选词">{availableContextWords.length ? availableContextWords.map(word => <button key={word} type="button" draggable className={`context-word ${contextPick === word ? 'selected' : ''} ${contextReturned.includes(word) ? 'returned' : ''}`} onClick={() => setContextPick(value => value === word ? null : word)} onDragStart={event => { event.dataTransfer.setData('text/plain', word); setContextPick(word); }}>{word}</button>) : <span className="muted">所有备选词都已放入句子。</span>}</div>
<div className="context-sentences">{contextQuestions.map((question, index) => { const [before, after] = contextPromptParts(question.prompt, question.answer); const image = question.image_file || question.image; return <article className={`context-sentence ${contextsChecked && contexts[index] === question.answer ? 'correct' : ''} ${contextWrong.includes(index) ? 'wrong' : ''} ${contextWrong.includes(index) && contextShake ? 'wrong-shake' : ''}`} key={question.prompt}>
<div className="context-sentence-copy"><span className="context-sentence-text">{before}<button type="button" className={`context-drop ${contexts[index] ? 'filled' : ''} ${contextWrong.includes(index) ? 'wrong' : ''}`} aria-label={`第 ${index + 1} 题填空`} onClick={() => contextPick ? setContext(index, contextPick) : contexts[index] ? returnContextWord(index) : undefined} onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add('drag-over'); }} onDragLeave={event => event.currentTarget.classList.remove('drag-over')} onDrop={event => { event.preventDefault(); event.currentTarget.classList.remove('drag-over'); const word = event.dataTransfer.getData('text/plain') || contextPick; if (word) setContext(index, word); }}>{contexts[index] || '________'}</button>{after}</span><span className="context-image-frame">{image ? <img src={/^(?:https?:|data:|\/)/i.test(image) ? image : `/${image}`} alt={`第 ${index + 1} 题配图`} /> : '图片框'}</span></div>
</article>; })}</div>
</section>
</div>}<ModuleComplete id="words" done={isDone('words')} onPrevious={() => open('reading')} onNext={() => open('comprehension')} />
</section>}
      {active === 'comprehension' && <section className="panel practice-shell">
<div className="practice-intro">
<div>
<TaskTitle task="Task 4" name="Comprehension" />
<p className="muted">阅读问题，选择最恰当的答案。</p>
</div>
<div className="intro-actions">
<span className="badge">{Object.keys(answers).length} / {course.comprehension.questions.length} 已作答</span>
<button className="link-btn" type="button" onClick={resetAnswers}>再试一次</button>
</div>
</div>{course.comprehension.questions.map((question, index) => { const correct = answers[`comp:${index}`] === question.answer; return <article key={question.prompt} className={`question ${answersChecked && correct ? 'question-correct' : answersChecked ? 'question-wrong' : ''} ${answerFeedback.includes(index) ? correct ? 'correct-pop' : 'wrong-pop' : ''}`}>
<h3>{index + 1}、{question.prompt}</h3>
<div className="options">{Object.entries(question.options).map(([key, label]) => <button key={key} type="button" disabled={answersChecked && answers[`comp:${index}`] === question.answer} className={`option ${answers[`comp:${index}`] === key ? 'selected' : ''} ${answersChecked && answers[`comp:${index}`] === key && key === question.answer ? 'correct' : ''} ${answersChecked && answers[`comp:${index}`] === key && key !== question.answer ? 'wrong' : ''}`} onClick={() => setAnswer(index, key)}>{label}</button>)}</div>
</article>; })}<ModuleComplete id="comprehension" done={isDone('comprehension')} onPrevious={() => open('words')} onNext={() => open('rebuild')} />
</section>}
      {active === 'rebuild' && <section className="panel practice-shell">
<div className="practice-intro">
<div>
<TaskTitle task="Task 5" name="Rebuild" />
<p className="muted">{tableTypes.includes(rebuildType) ? '将备选内容填入对应位置，完成结构匹配。' : '按文章顺序排列备选句，重建文章结构。'}</p>
</div>
<div className="intro-actions">
<span className={`badge ${isDone('rebuild') ? 'success' : ''}`}>{isDone('rebuild') ? '已提交' : '等待检查'}</span>
<button className="link-btn" type="button" onClick={resetRebuild}>再试一次</button>
</div>
</div>{tableTypes.includes(rebuildType) ? <>
<section className={`rebuild-choice-bank ${tableChecked ? progress.moduleStatus.rebuild?.score === 100 ? 'correct' : 'wrong' : ''}`}>
<h3 className="rebuild-choice-bank-title">备选内容</h3>
<div className="rebuild-choice-list">{shuffle(tableChoices, `${course.cardId}table`).map(item => <button key={item.id} draggable className={`rebuild-table-option ${tablePick === item.id ? 'selected' : ''} ${Object.values(tableAnswers).includes(item.id) ? 'used' : ''}`} type="button" aria-pressed={tablePick === item.id} onClick={() => setTablePick(value => value === item.id ? null : item.id)} onDragStart={event => event.dataTransfer.setData('text/plain', item.id)}>
<span>{item.text}</span>
<small>{Object.values(tableAnswers).includes(item.id) ? '已放入' : '拖入'}</small>
</button>)}</div>
</section>
<div className={`rebuild-table-wrap ${tableChecked ? progress.moduleStatus.rebuild?.score === 100 ? 'correct' : 'wrong' : ''}`}>
<table className="rebuild-table">
<thead>
<tr>
<th scope="col">{rebuildLabels[0]}</th>
<th className="connector" aria-label="对应关系" />
<th scope="col">{rebuildLabels[1]}</th>
</tr>
</thead>
<tbody>{tableRows.map((row, index) => { const revealLeft = index % 2 === 0; const answer = tableChoices.find(item => item.id === tableAnswers[index]); const correct = tableAnswers[index] === tableChoices[index].id; const drop = <button type="button" className={`rebuild-table-value drop ${answer ? 'filled' : ''} ${tablePick ? 'selected' : ''} ${tableChecked ? correct ? 'correct' : 'wrong' : ''} ${rebuildFeedback.includes(index) ? correct ? 'correct-pop' : 'wrong-pop' : ''}`} onClick={() => placeTable(index)} onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add('drag-over'); }} onDragLeave={event => event.currentTarget.classList.remove('drag-over')} onDrop={event => { event.preventDefault(); event.currentTarget.classList.remove('drag-over'); const choice = event.dataTransfer.getData('text/plain'); if (choice) placeTableChoice(choice, index); }}>{answer?.text || '拖入备选内容'}</button>; return <tr key={`${row[0]}-${row[1]}`}>
<td>{revealLeft ? <div className="rebuild-table-value given">{row[0]}</div> : drop}</td>
<td className="connector">→</td>
<td>{revealLeft ? drop : <div className="rebuild-table-value given">{row[1]}</div>}</td>
</tr>; })}</tbody>
</table>
</div>
</> : <div className="rebuild-workspace">
<section className={`rebuild-canvas ${rebuildChecked ? progress.moduleStatus.rebuild?.score === 100 ? 'correct' : 'wrong' : ''}`}>
<h3 className="rebuild-panel-title">{rebuildType === 'cycle' ? '循环图' : '顺序图'}</h3>
<div className={`rebuild-diagram ${rebuildType === 'cycle' ? 'cycle' : ''}`}>{shownRebuild.map((value, index) => <Fragment key={index}><div role="button" tabIndex={0} draggable={value >= 0} className={`rebuild-slot ${value < 0 ? 'empty' : ''} ${rebuildChecked ? value === index ? 'correct' : 'wrong' : ''} ${rebuildFeedback.includes(index) ? value === index ? 'correct-pop' : 'wrong-pop' : ''}`} onClick={() => placeRebuild(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') placeRebuild(index); }} onDragStart={event => value >= 0 && event.dataTransfer.setData('text/plain', String(value))} onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add('drag-over'); }} onDragLeave={event => event.currentTarget.classList.remove('drag-over')} onDrop={event => { event.preventDefault(); event.currentTarget.classList.remove('drag-over'); const choice = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(choice)) placeRebuildChoice(choice, index); }}>
<b className="rebuild-slot-number">{index + 1}</b>
<strong>{value < 0 ? '选择备选句后点这里' : steps[value]}</strong>
{value >= 0 && <span className="move-buttons"><button type="button" disabled={index === 0} onClick={event => { event.stopPropagation(); moveRebuild(index, index - 1); }}>↑</button><button type="button" disabled={index === shownRebuild.length - 1} onClick={event => { event.stopPropagation(); moveRebuild(index, index + 1); }}>↓</button></span>}
</div>{index < shownRebuild.length - 1 && <div className="rebuild-connector" aria-hidden="true">{rebuildType === 'cycle' ? '→' : '↓'}</div>}{rebuildType === 'cycle' && index === shownRebuild.length - 1 && shownRebuild.length > 1 && <div className="rebuild-connector" aria-hidden="true">↻</div>}</Fragment>)}</div>
<p className="rebuild-drop-hint">可拖放、点选，或用每个方块上的上下箭头调整顺序。</p>
</section>
<aside className={`rebuild-bank ${rebuildChecked ? progress.moduleStatus.rebuild?.score === 100 ? 'correct' : 'wrong' : ''}`}>
<h3 className="rebuild-panel-title">备选句</h3>
<div className="rebuild-bank-list">{rebuildBankOrder.some(sourceIndex => !shownRebuild.includes(sourceIndex)) ? rebuildBankOrder.filter(sourceIndex => !shownRebuild.includes(sourceIndex)).map(sourceIndex => { const step = steps[sourceIndex]; return <button key={`${sourceIndex}-${step}`} type="button" draggable className={`rebuild-option ${rebuildPick === sourceIndex ? 'selected' : ''}`} aria-pressed={rebuildPick === sourceIndex} onDragStart={event => event.dataTransfer.setData('text/plain', String(sourceIndex))} onClick={() => setRebuildPick(value => value === sourceIndex ? null : sourceIndex)}>
<span aria-hidden="true">⋮⋮</span><span>{step}</span>
<small>点选或拖入</small>
</button>; }) : <p className="rebuild-option-empty" aria-live="polite">所有备选句都已放入图中。</p>}</div>
</aside>
</div>}{(rebuildChecked || tableChecked) && <p className="rebuild-table-feedback" aria-live="polite">{progress.moduleStatus.rebuild?.score === 100 ? tableTypes.includes(rebuildType) ? '全部对应正确，你已经抓住了文章结构。' : '结构正确！你已经抓住了文章关系。' : tableTypes.includes(rebuildType) ? `已完成 ${tableChoices.filter((choice, index) => tableAnswers[index] === choice.id).length} / ${tableRows.length} 组正确配对；红色位置需要更换。` : '顺序还需要调整。看看信息是怎样一步步发生或相互作用的。'}</p>}<ModuleComplete id="rebuild" done={isDone('rebuild')} onPrevious={() => open('comprehension')} nextLesson={nextLesson} />
</section>}
    </section>
  </main>
  </>;
}

function Footer({ previous, text, action }: { previous?: string; text: string; action: () => void; }) { return <div className="module-complete">{previous ? <Link className="module-prev" href={previous} aria-label="回到上一课">
<ChevronLeft />
</Link> : <span />}<div>
<strong>{text}</strong>
<small>完成后可继续下一模块。</small>
</div>
<div className="module-actions">
<button className="btn primary" type="button" onClick={action}>完成本关</button>
</div>
</div>; }
function TaskTitle({ task, name }: { task: string; name: string; }) { return <h2 className="section-title task-title">
<span className="task-tag">{task}</span>
<span className="task-divider" aria-hidden="true" />
<span className="task-name">{name}</span>
</h2>; }
function ModuleComplete({ id, done, onPrevious, onNext, nextLesson }: { id: ModuleId; done: boolean; onPrevious: () => void; onNext?: () => void; nextLesson?: string; }) {
  const unit = id === 'rebuild' ? '课' : '关';
  return <div className={`module-complete ${done ? 'done' : ''}`}>
    <button className="module-prev" type="button" onClick={onPrevious} aria-label="回到上一关">
<ChevronLeft />
</button>
    <div>
<strong>{done ? `恭喜你完成本${unit}，让我们进入下一${unit}` : `完成本${unit}后将解锁下一${unit}`}</strong>
<small>{done ? '本模块已全部完成，继续加油！' : '先完成本模块里的全部任务'}</small>
</div>
    <div className="module-actions">{id === 'rebuild' ? nextLesson ? <Link className={`btn primary ${!done ? 'disabled' : ''}`} href={done ? `/learn/${nextLesson}` : '#'} aria-disabled={!done} tabIndex={done ? 0 : -1}>{done ? '前往下一课' : '进入下一课'}</Link> : done ? <Link className="btn primary" href="/courses">返回课程</Link> : <button className="btn primary" type="button" disabled>暂无下一课</button> : <button className="btn primary" type="button" disabled={!done} onClick={onNext}>进入下一关</button>}</div>
  </div>;
}
function ChevronLeft() { return <svg viewBox="0 0 24 24" aria-hidden="true">
<path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
</svg>; }
function PlayIcon() { return <svg className="pi pi-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>; }
function PauseIcon() { return <svg className="pi pi-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>; }
function SpeakerIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm11.5-.5a1 1 0 0 0-1.4 1.4A4.97 4.97 0 0 1 15.5 12c0 .83-.2 1.6-.55 2.1a1 1 0 1 0 1.4 1.4A6.96 6.96 0 0 0 17.5 12c0-1.34-.38-2.58-1-3.5Zm2.8-2.3a1 1 0 0 0-1.4 1.4A7.97 7.97 0 0 0 18.5 12c0 1.67-.5 3.2-1.35 4.4a1 1 0 1 0 1.4 1.4A9.97 9.97 0 0 0 20.5 12c0-2.1-.65-4.05-1.8-5.8Z" /></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9" /></svg>; }
function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" /></svg>; }
function WordIllustration({ word, label, card = false }: { word: string; label: string; card?: boolean; }) {
  const key = word.toLowerCase();
  const drawing = key === 'bud' ? <><path d="M32 54V35" /><path d="M32 37c-10-5-13-15-7-22 5 1 8 4 9 9 2-5 5-8 10-9 6 8 2 17-8 22" /><path d="M32 45c-7 0-12 4-14 9" /></> : key === 'roots' ? <><path d="M32 10v19M18 25c7 3 21 3 28 0M32 29v25M32 38 22 49M32 42 43 54m-17-9-7 9m20-7 5 7" /></> : key === 'soil' ? <><path d="M10 22c8-5 15 5 23 0s15 5 21 0M9 31h46M12 41h40M16 50h32" /><circle cx="20" cy="36" r="1.5" /><circle cx="42" cy="45" r="1.5" /></> : key === 'sunlight' ? <><circle cx="32" cy="32" r="11" /><path d="M32 8v9M32 47v9M8 32h9M47 32h9M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" /></> : key === 'petals' ? <><circle cx="32" cy="32" r="5" /><path d="M32 27c-8-5-8-15 0-19 8 4 8 14 0 19ZM37 31c3-9 13-11 19-4-2 9-11 12-19 4ZM35 36c9 1 13 11 7 18-9 0-14-9-7-18ZM29 36c6 7 1 17-8 18-6-7-2-17 8-18ZM27 31c-8 8-17 4-19-4 6-7 16-5 19 4Z" /></> : key === 'unfold' ? <><path d="M32 52V33M32 36c-12 0-19-8-18-18 10-1 18 5 18 18ZM32 36c12 0 19-8 18-18-10-1-18 5-18 18ZM32 30c-5-8-4-16 0-22 5 6 5 14 0 22Z" /></> : <><rect x="11" y="13" width="42" height="38" rx="6" /><circle cx="24" cy="26" r="4" /><path d="m16 44 11-10 8 7 6-5 7 8" /></>;
  return <><span className={`word-tile-image ${card ? 'word-card-image' : ''}`}><svg viewBox="0 0 64 64" aria-hidden="true">{drawing}</svg></span>{!card && <span className="word-tile-caption">{label}</span>}</>;
}
function ScoreCard({ result }: { result: PronunciationScoreResult; }) {
  const score = pronunciationScore(result);
  const words = result.words || [];
  return <details className="ai-details" open><summary>AI 评价</summary><div className="ai-body"><div className="score-words">{words.map((item, index) => <span key={`${item.word}-${index}`} className={`word-chip ${item.status}`} title={item.status === 'wrong' ? `读成了 ${item.heard || '？'}` : undefined}><i aria-hidden="true" />{item.word}<em>{pronunciationWordLabel(item.status)}</em></span>)}</div><p className="ai-note"><strong>{pronunciationPraise(score)}</strong><span>{pronunciationAdvice(result)}</span></p></div></details>;
}
