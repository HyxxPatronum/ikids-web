import { expect, test } from '@playwright/test';

test('a Paragraph opens approved phrases, switches scope, carries context, and restores reading focus', async ({ page }) => {
  await page.route('**/api/cards/phrase-course', route => route.fulfill({ json: {
    cardId: 'phrase-course',
    courseId: 'science-reading',
    title: 'Living Systems',
    topic: 'Life Science',
    theme: 'Living Things',
    image_file: 'day001-flower.png',
    paragraphs: ['Warm living things grow. Desert plants stay strong.'],
    word_bank: [
      { english: 'living things', approved: true },
      { english: 'warm living things', approvalStatus: 'approved' },
      { english: 'desert plants', approvalStatus: 'candidate' },
    ],
  } }));

  const requests: URL[] = [];
  await page.route('**/api/dictionary?**', route => {
    const url = new URL(route.request().url());
    requests.push(url);
    const scope = url.searchParams.get('word') || '';
    return route.fulfill({ json: {
      word: scope,
      surfaceForm: url.searchParams.get('surface'),
      selectedScope: scope,
      lexeme: scope === 'things' ? 'thing' : scope,
      alternateScopes: url.searchParams.getAll('alternate'),
      catalogMembership: scope === 'Warm living things' ? 'science' : null,
      meaning: scope === 'Warm living things' ? 'the living systems taught in this lesson' : '',
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: `fixture definition for ${scope}` }] }],
      pronunciations: [],
      provider: 'Fixture',
      cacheStatus: 'hit',
    } });
  });

  await page.goto('/lesson/phrase-course');
  const phraseTrigger = page.getByRole('button', { name: '查询 Warm living things，当前单词 things' });
  await phraseTrigger.click();
  const dialog = page.getByRole('dialog', { name: '词典释义' });
  await expect(dialog.getByRole('heading', { name: 'Warm living things' })).toBeVisible();
  await expect(dialog.getByText('the living systems taught in this lesson')).toBeVisible();
  expect(requests[0].searchParams.get('courseId')).toBe('phrase-course');
  expect(requests[0].searchParams.get('sentence')).toBe('Warm living things grow.');

  await dialog.getByRole('group', { name: '查询范围' }).getByRole('button', { name: 'living', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'living', exact: true })).toBeVisible();
  expect(requests.at(-1)?.searchParams.get('word')).toBe('living');

  await dialog.getByRole('button', { name: '关闭查词结果' }).click();
  await expect(phraseTrigger).toBeFocused();
  const wordTrigger = page.getByRole('button', { name: '查询 Desert', exact: true });
  await wordTrigger.click();
  await expect(dialog.getByRole('heading', { name: 'Desert', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '关闭查词结果' }).click();
  await expect(wordTrigger).toBeFocused();
  await expect(page.getByRole('button', { name: '查询 desert plants，当前单词 Desert' })).toHaveCount(0);
});

test('content editors review phrase candidates before they affect published student text', async ({ request }) => {
  const api = 'http://127.0.0.1:4176/api';
  const cardId = 'playwright-phrase-review';
  const headers = { authorization: 'Bearer playwright-preview-token' };
  const card = {
    cardId,
    courseId: 'science-reading',
    topic: 'Life Science',
    theme: 'Phrase Review',
    day: 902,
    level: 'L1',
    title: 'Phrase Review Fixture',
    articleStructure: 'Feature-Function',
    paragraphs: ['Living things use the water cycle near desert plants.'],
    word_bank: [
      { english: 'living thing', chinese: '生物', approvalStatus: 'candidate' },
      { english: 'water cycle', chinese: '水循环', approvalStatus: 'candidate' },
      { english: 'desert plants', chinese: '沙漠植物', approvalStatus: 'candidate' },
      { english: 'organism', chinese: '生物体', approved: true },
      { english: 'habitat', chinese: '栖息地', approved: true },
    ],
    comprehension: { questions: [
      { options: ['A', 'B', 'C'], answer: 'A' },
      { options: ['A', 'B', 'C'], answer: 'B' },
      { options: ['A', 'B', 'C'], answer: 'C' },
    ] },
    rebuild: { steps: ['one', 'two', 'three'] },
  };

  await expect((await request.post(`${api}/cards`, { data: card })).status()).toBe(201);
  try {
    await expect((await request.get(`${api}/cards/${cardId}`)).status()).toBe(404);
    await expect((await request.get(`${api}/cards/${cardId}`, { headers })).status()).toBe(200);
    const preview = await request.get(`${api}/cards/${cardId}/phrase-candidates`, { headers });
    expect(preview.status()).toBe(200);
    expect((await preview.json()).candidates).toHaveLength(3);

    await expect((await request.patch(`${api}/cards/${cardId}/phrase-candidates`, { headers, data: {
      english: 'living thing', action: 'correct', correctedEnglish: 'living things',
    } })).status()).toBe(200);
    await expect((await request.patch(`${api}/cards/${cardId}/phrase-candidates`, { headers, data: {
      english: 'water cycle', action: 'accept',
    } })).status()).toBe(200);
    await expect((await request.patch(`${api}/cards/${cardId}/phrase-candidates`, { headers, data: {
      english: 'desert plants', action: 'reject',
    } })).status()).toBe(200);

    let words = await (await request.get(`${api}/words`)).json();
    expect(words.words.some((word: { english: string }) => word.english === 'living things')).toBe(false);
    await expect((await request.post(`${api}/cards/${cardId}/publish`)).status()).toBe(200);
    words = await (await request.get(`${api}/words`)).json();
    expect(words.words.some((word: { english: string }) => word.english === 'living things')).toBe(true);
    expect(words.words.some((word: { english: string }) => word.english === 'water cycle')).toBe(true);
    expect(words.words.some((word: { english: string }) => word.english === 'desert plants')).toBe(false);
    await expect((await request.patch(`${api}/cards/${cardId}/phrase-candidates`, { headers, data: {
      english: 'living things', action: 'reject',
    } })).status()).toBe(409);

    const lookup = await request.get(`${api}/dictionary?${new URLSearchParams({
      word: 'living things',
      surface: 'things',
      courseId: cardId,
      sentence: 'Living things use the water cycle near desert plants.',
      lang: 'zh',
    })}&alternate=living&alternate=things`);
    expect(lookup.status()).toBe(200);
    expect(await lookup.json()).toMatchObject({
      surfaceForm: 'things',
      selectedScope: 'living things',
      lexeme: 'living thing',
      alternateScopes: ['living', 'things'],
      meaning: '生物',
      context: { courseId: cardId, sentence: 'Living things use the water cycle near desert plants.' },
    });
  } finally {
    await request.post(`${api}/cards/${cardId}/archive`);
  }
});
