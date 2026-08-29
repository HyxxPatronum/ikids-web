export type PronunciationWordStatus = 'ok' | 'low' | 'wrong' | 'missing';

export type PronunciationWordResult = {
  word: string;
  status: PronunciationWordStatus;
  confidence?: number;
  heard?: string;
};

export type PronunciationScoreResult = {
  recognized?: boolean;
  overall?: number;
  score?: number;
  words?: PronunciationWordResult[];
  issues?: string[];
  transcript?: string;
};

export const pronunciationScore = (result: PronunciationScoreResult) => {
  const words = result.words || [];
  return words.length > 0 && words.every(word => word.status === 'ok') ? 100 : result.overall ?? result.score ?? 0;
};

export const pronunciationScoreBand = (score: number): 'high' | 'mid' | 'low' => score >= 85 ? 'high' : score >= 70 ? 'mid' : 'low';

export const pronunciationPraise = (score: number) => score >= 85
  ? '发音很标准，太棒了！'
  : score >= 70
    ? '大部分词都读对了，继续加油！'
    : '别灰心，多听几遍示范再试一次！';

export const pronunciationWordLabel = (status: PronunciationWordStatus) => ({
  ok: '读得好',
  low: '需改进',
  wrong: '读错',
  missing: '漏读',
})[status];

export const pronunciationAdvice = (result: PronunciationScoreResult) => {
  const words = result.words || [];
  const okCount = words.filter(word => word.status === 'ok').length;
  const items: string[] = [];
  words.forEach(word => {
    if (word.status === 'wrong') items.push(`「${word.word}」可能读成了${word.heard ? `「${word.heard}」` : '别的词'}`);
    else if (word.status === 'low') items.push(`「${word.word}」发音可能还不够清楚`);
    else if (word.status === 'missing') items.push(`「${word.word}」好像没有读出来`);
  });
  if (!items.length) return '每个词都读得很棒，继续保持！';
  const sentence = items.join('，');
  if (okCount === 0) return `${sentence}。也可能只是识别没听清，跟着示范再读一遍试试吧！`;
  if (okCount / words.length >= .6) return `${sentence}。其它词听起来都很棒！`;
  return `${sentence}。再听几遍示范，读慢一点可能会更清楚！`;
};
