import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCatalog, catalogCategory, catalogStats } from '../lib/catalog/catalog.ts';

test('preserves fixed catalog sizes and keeps aliases mutually exclusive', () => {
  assert.deepEqual(catalogStats, { level2: 505, level3: 1095, overlap: 0 });
  assert.equal(catalogCategory('flower'), 'level2');
  assert.equal(catalogCategory('children'), 'level2');
  assert.equal(catalogCategory('bicycle'), 'level2');
  assert.equal(catalogCategory('actress'), 'level3');
  assert.equal(catalogCategory('center'), 'level3');
});

test('publishes only science terms from published cards and deduplicates sources', () => {
  const result = buildCatalog([
    { cardId: 'draft', status: 'draft', title: 'Draft', word_bank: [{ english: 'microscope', chinese: '显微镜' }] },
    { cardId: 'published', status: 'published', title: 'Published', word_bank: [{ english: 'microscope', chinese: '显微镜' }, { english: 'microscope', chinese: '显微镜' }] },
  ]);
  const entry = result.words.find(word => word.english === 'microscope');
  assert.equal(result.counts.level2, 505);
  assert.equal(result.counts.level3, 1095);
  assert.equal(entry?.category, 'science');
  assert.equal(entry?.sources.length, 1);
  assert.equal(entry?.sources[0].cardId, 'published');
});

test('does not add a fixed catalog word to Science Core', () => {
  const result = buildCatalog([{ cardId: 'published', status: 'published', word_bank: [{ english: 'flower', chinese: '花' }] }]);
  assert.equal(result.words.filter(word => word.category === 'science' && word.english.toLowerCase() === 'flower').length, 0);
  assert.equal(result.words.filter(word => word.category === 'level2' && word.english.toLowerCase() === 'flower').length, 1);
});
