import { expect, test } from '@playwright/test';
import { buildCatalogFromIndex } from '../lib/catalog/catalog.ts';
import { createMemoryPublicationStore, createPublicationIndex } from '../lib/catalog/publication-index.ts';

async function catalogFixture(options: { includePublished?: boolean } = {}) {
  const index = createPublicationIndex(createMemoryPublicationStore());
  await index.synchronize({
    cardId: 'published-course', slug: 'published-course', title: 'Published Course', status: 'published',
    word_bank: options.includePublished === false ? [] : [{ english: 'microscope', chinese: '显微镜', approved: true }],
  });
  await index.synchronize({
    cardId: 'draft-course', slug: 'draft-course', title: 'Draft Course', status: 'draft',
    word_bank: [{ english: 'draftconcept', chinese: '草稿概念', approved: true }],
  });
  return buildCatalogFromIndex(await index.entries());
}

test('students browse, search, and trace three publication-safe catalogs', async ({ page }) => {
  const catalog = await catalogFixture();
  await page.route('**/api/words', route => route.fulfill({ json: catalog }));
  await page.route('**/api/dictionary?**', route => route.fulfill({ json: {
    word: 'microscope', selectedScope: 'microscope', lexeme: 'microscope', catalogMembership: 'science',
    meaning: '显微镜', meanings: [], provider: 'Fixture', cacheStatus: 'hit',
    sources: [{ title: 'Published Course', slug: 'published-course' }],
  } }));

  await page.goto('/words');
  await expect(page.getByRole('tab', { name: /二级词汇.*505 词/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: /a\/an/ })).toBeVisible();
  await page.getByRole('tab', { name: /三级词汇.*1095 词/ }).click();
  await expect(page.getByRole('heading', { name: '三级词汇' })).toBeVisible();
  await page.getByRole('tab', { name: /Science Core.*1 词/ }).click();
  await expect(page.getByRole('button', { name: /microscope/ })).toBeVisible();
  await expect(page.getByText('draftconcept')).toHaveCount(0);

  await page.getByRole('searchbox', { name: '查询英文词汇' }).fill('no-such-term');
  await expect(page.getByText('当前分类没有匹配词汇')).toBeVisible();
  await page.getByRole('searchbox', { name: '查询英文词汇' }).fill('microscope');
  await page.getByRole('button', { name: /microscope/ }).click();
  await page.getByRole('button', { name: /更多信息/ }).click();
  await expect(page.getByRole('link', { name: 'Published Course' })).toHaveAttribute('href', '/lesson/published-course');
});

test('Science Core has an explicit empty state before any course is published', async ({ page }) => {
  await page.route('**/api/words', async route => route.fulfill({ json: await catalogFixture({ includePublished: false }) }));
  await page.goto('/words');
  await page.getByRole('tab', { name: /Science Core.*0 词/ }).click();
  await expect(page.getByText('当前分类没有匹配词汇')).toBeVisible();
});

test('the real publication API keeps drafts private and updates Science Core across its lifecycle', async ({ page, request }) => {
  const api = 'http://127.0.0.1:4176/api';
  const cardId = 'playwright-vocabulary-boundary';
  const card = {
    cardId,
    courseId: 'science-reading',
    topic: 'Testing',
    theme: 'Publishing',
    day: 901,
    level: 'L1',
    title: 'Vocabulary Boundary Fixture',
    articleStructure: 'Feature-Function',
    paragraphs: ['A testdraftconcept stays private until publication.'],
    word_bank: [
      { english: 'testdraftconcept', chinese: '测试草稿概念', approved: true },
      { english: 'unapprovedone', chinese: '未批准一', approved: false },
      { english: 'unapprovedtwo', chinese: '未批准二', approved: false },
      { english: 'unapprovedthree', chinese: '未批准三', approved: false },
      { english: 'unapprovedfour', chinese: '未批准四', approved: false },
    ],
    comprehension: { questions: [
      { options: ['A', 'B', 'C'], answer: 'A' },
      { options: ['A', 'B', 'C'], answer: 'B' },
      { options: ['A', 'B', 'C'], answer: 'C' },
    ] },
    rebuild: { steps: ['one', 'two', 'three'] },
  };

  await expect((await request.post(`${api}/cards`, { data: card })).status()).toBe(201);
  await expect((await request.get(`${api}/cards/${cardId}/vocabulary-preview`)).status()).toBe(403);
  const editorPreview = await request.get(`${api}/cards/${cardId}/vocabulary-preview`, { headers: {
    authorization: 'Bearer playwright-preview-token',
  } });
  expect(editorPreview.status()).toBe(200);
  expect((await editorPreview.json()).terms).toEqual(expect.arrayContaining([expect.objectContaining({ english: 'testdraftconcept', studentVisible: false })]));

  try {
    let words = await (await request.get(`${api}/words`)).json();
    expect(words.words.some((word: { english: string }) => word.english === 'testdraftconcept')).toBe(false);

    expect((await request.post(`${api}/cards/${cardId}/publish`)).status()).toBe(200);
    words = await (await request.get(`${api}/words`)).json();
    expect(words.words.some((word: { english: string }) => word.english === 'testdraftconcept')).toBe(true);
    expect(words.words.some((word: { english: string }) => word.english === 'unapprovedone')).toBe(false);

    await page.route('**/api/words', async route => route.fulfill({ json: await (await request.get(`${api}/words`)).json() }));
    await page.goto('/words');
    await page.getByRole('tab', { name: /Science Core/ }).click();
    await page.getByRole('searchbox', { name: '查询英文词汇' }).fill('testdraftconcept');
    await expect(page.getByRole('button', { name: /testdraftconcept/ })).toBeVisible();
  } finally {
    expect((await request.post(`${api}/cards/${cardId}/archive`)).status()).toBe(200);
  }

  const archivedWords = await (await request.get(`${api}/words`)).json();
  expect(archivedWords.words.some((word: { english: string }) => word.english === 'testdraftconcept')).toBe(false);
});
