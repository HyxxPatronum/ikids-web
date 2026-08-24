import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLookupText } from '../lib/lookup/text.ts';

test('approved phrases use deterministic longest matching and expose constituent scopes', () => {
  const result = buildLookupText('Warm living things grow.', [
    { english: 'living things', approved: true },
    { english: 'warm living things', approvalStatus: 'approved' },
  ]);

  assert.deepEqual(result.filter(part => part.type === 'word').map(part => ({
    surfaceForm: part.surfaceForm,
    defaultScope: part.defaultScope,
    alternateScopes: part.alternateScopes,
  })), [
    { surfaceForm: 'Warm', defaultScope: 'Warm living things', alternateScopes: ['Warm', 'living', 'things'] },
    { surfaceForm: 'living', defaultScope: 'Warm living things', alternateScopes: ['Warm', 'living', 'things'] },
    { surfaceForm: 'things', defaultScope: 'Warm living things', alternateScopes: ['Warm', 'living', 'things'] },
    { surfaceForm: 'grow', defaultScope: 'grow', alternateScopes: [] },
  ]);
});

test('punctuation is preserved while unapproved adjacent words remain independent', () => {
  const result = buildLookupText("Desert plants' leaves grow.", [
    { english: 'desert plants', approvalStatus: 'candidate' },
    { english: 'plants leaves', approved: false },
  ]);

  assert.equal(result.map(part => part.type === 'text' ? part.text : part.surfaceForm).join(''), "Desert plants' leaves grow.");
  assert.deepEqual(result.filter(part => part.type === 'word').map(part => part.defaultScope), [
    'Desert', "plants'", 'leaves', 'grow',
  ]);
});
