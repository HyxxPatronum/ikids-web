import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pronunciationAdvice,
  pronunciationPraise,
  pronunciationScore,
  pronunciationScoreBand,
  pronunciationWordLabel,
} from '../lib/pronunciation-scoring.ts';

test('uses the original 85 and 70 score bands', () => {
  assert.equal(pronunciationScoreBand(85), 'high');
  assert.equal(pronunciationScoreBand(84), 'mid');
  assert.equal(pronunciationScoreBand(70), 'mid');
  assert.equal(pronunciationScoreBand(69), 'low');
  assert.equal(pronunciationPraise(85), '发音很标准，太棒了！');
  assert.equal(pronunciationPraise(70), '大部分词都读对了，继续加油！');
});

test('awards 100 when every recognized word is correct', () => {
  assert.equal(pronunciationScore({ overall: 82, words: [{ word: 'a', status: 'ok' }, { word: 'seed', status: 'ok' }] }), 100);
  assert.equal(pronunciationScore({ overall: 82, words: [{ word: 'a', status: 'ok' }, { word: 'seed', status: 'low' }] }), 82);
  assert.equal(pronunciationScore({ overall: 82, words: [] }), 82);
});

test('keeps the original word status labels', () => {
  assert.equal(pronunciationWordLabel('ok'), '读得好');
  assert.equal(pronunciationWordLabel('low'), '需改进');
  assert.equal(pronunciationWordLabel('wrong'), '读错');
  assert.equal(pronunciationWordLabel('missing'), '漏读');
});

test('keeps the original advice branches', () => {
  assert.equal(pronunciationAdvice({ words: [{ word: 'seed', status: 'ok' }] }), '每个词都读得很棒，继续保持！');
  assert.equal(
    pronunciationAdvice({ words: [{ word: 'seed', status: 'wrong', heard: 'said' }] }),
    '「seed」可能读成了「said」。也可能只是识别没听清，跟着示范再读一遍试试吧！',
  );
  assert.equal(
    pronunciationAdvice({ words: [{ word: 'a', status: 'ok' }, { word: 'seed', status: 'ok' }, { word: 'grows', status: 'missing' }] }),
    '「grows」好像没有读出来。其它词听起来都很棒！',
  );
  assert.equal(
    pronunciationAdvice({ words: [{ word: 'a', status: 'ok' }, { word: 'seed', status: 'low' }, { word: 'grows', status: 'missing' }] }),
    '「seed」发音可能还不够清楚，「grows」好像没有读出来。再听几遍示范，读慢一点可能会更清楚！',
  );
});
