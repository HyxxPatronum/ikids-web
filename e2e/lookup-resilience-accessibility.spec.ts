import { expect, test } from '@playwright/test';
import path from 'node:path';
import type { Page, Route } from '@playwright/test';

const courseId = 'resilience-course';

function resultFixture(overrides: Record<string, unknown> = {}) {
  return {
    word: 'resilience',
    surfaceForm: 'Resilience',
    selectedScope: 'resilience',
    lexeme: 'resilience',
    catalogMembership: 'science',
    meaning: 'the lesson meaning remains available',
    illustration: null,
    accents: [],
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'cached dictionary meaning' }] }],
    provider: 'Fixture',
    cacheStatus: 'hit',
    sourceStatus: {
      course: 'found',
      provider: 'found',
      blocks: {
        courseSense: 'ready',
        localDictionary: 'not_requested',
        externalDictionary: 'ready',
        pronunciation: 'empty',
        illustration: 'empty',
      },
    },
    sources: [],
    ...overrides,
  };
}

async function lesson(page: Page, handleDictionary: (route: Route) => unknown, paragraph = 'Resilience protects students.') {
  await page.route(`**/api/cards/${courseId}`, route => route.fulfill({ json: {
    cardId: courseId,
    courseId: 'science-reading',
    title: 'Resilient Lookup',
    paragraphs: [paragraph],
    word_bank: [],
  } }));
  await page.route('**/api/dictionary?**', handleDictionary);
  await page.goto(`/lesson/${courseId}`);
}

test('a temporary external failure preserves loaded blocks and retries only the active lookup state', async ({ page }) => {
  const requests: URL[] = [];
  let attempt = 0;
  await lesson(page, route => {
    const url = new URL(route.request().url());
    requests.push(url);
    if (url.searchParams.get('source') === 'local') return route.fulfill({ json: resultFixture({
      cacheStatus: 'stale',
      sourceStatus: {
        course: 'found', provider: 'not_found',
        blocks: { courseSense: 'ready', localDictionary: 'not_requested', externalDictionary: 'not_requested', pronunciation: 'empty', illustration: 'empty' },
      },
    }) });
    attempt += 1;
    if (attempt === 1) return route.fulfill({ json: resultFixture({
      cacheStatus: 'stale',
      sourceStatus: {
        course: 'found', provider: 'unavailable',
        blocks: { courseSense: 'ready', localDictionary: 'not_requested', externalDictionary: 'unavailable', pronunciation: 'empty', illustration: 'empty' },
      },
    }) });
    if (attempt === 2) return route.fulfill({ status: 503, json: { code: 'PROVIDER_UNAVAILABLE', error: 'Dictionary provider unavailable' } });
    return route.fulfill({ json: resultFixture({ meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'fresh dictionary meaning' }] }] }) });
  });

  const trigger = page.getByRole('button', { name: '查询 Resilience', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '词典释义' });
  await expect(dialog.getByText('the lesson meaning remains available')).toBeVisible();
  await expect(dialog.getByText('cached dictionary meaning')).toBeVisible();
  await dialog.getByRole('button', { name: '重试外部英英词典' }).click();
  await expect(dialog.getByRole('alert')).toContainText('外部英英词典暂时不可用');
  await expect(dialog.getByText('the lesson meaning remains available')).toBeVisible();
  await expect(dialog.getByText('cached dictionary meaning')).toBeVisible();
  await dialog.getByRole('button', { name: '重试外部英英词典' }).click();
  await expect(dialog.getByText('fresh dictionary meaning')).toBeVisible();

  const externalRequests = requests.filter(url => url.searchParams.get('source') !== 'local');
  expect(externalRequests).toHaveLength(3);
  expect(externalRequests.every(url => url.searchParams.get('word') === 'Resilience')).toBe(true);
  expect(externalRequests.every(url => url.searchParams.get('lang') === 'en')).toBe(true);
});

test('local Course, Pronunciation, and Illustration blocks render before a slow external dictionary', async ({ page }) => {
  let releaseExternal!: () => void;
  const externalReady = new Promise<void>(resolve => { releaseExternal = resolve; });
  await lesson(page, async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('source') === 'local') return route.fulfill({ json: resultFixture({
      meanings: [],
      accents: [{ region: 'us', label: '美音', source: 'course', audioUrl: '/media/resilience-us.mp3', phonetic: '' }],
      illustration: { src: 'day001-flower.png', alt: '课程图示', source: 'course-library' },
      sourceStatus: {
        course: 'found', provider: 'not_found',
        blocks: { courseSense: 'ready', localDictionary: 'not_requested', externalDictionary: 'not_requested', pronunciation: 'ready', illustration: 'ready' },
      },
    }) });
    await externalReady;
    return route.fulfill({ json: resultFixture({ meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'external dictionary arrived' }] }] }) });
  });

  await page.getByRole('button', { name: '查询 Resilience', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '词典释义' });
  await expect(dialog.getByText('the lesson meaning remains available')).toBeVisible({ timeout: 800 });
  await expect(dialog.getByRole('button', { name: '播放美音' })).toBeVisible();
  await expect(dialog.getByRole('img', { name: '课程图示' })).toBeVisible();
  await expect(dialog.getByText('external dictionary arrived')).toHaveCount(0);
  releaseExternal();
  await expect(dialog.getByText('external dictionary arrived')).toBeVisible();
});

test('confirmed not-found and temporary provider failure have different recovery states', async ({ page }) => {
  await lesson(page, route => {
    const word = new URL(route.request().url()).searchParams.get('word')?.toLowerCase();
    if (word === 'absent') return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', error: 'Dictionary entry not found' } });
    return route.fulfill({ status: 503, json: { code: 'PROVIDER_UNAVAILABLE', error: 'Dictionary provider unavailable' } });
  }, 'Absent offline.');

  await page.getByRole('button', { name: '查询 Absent', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '词典释义' });
  await expect(dialog.getByText('未找到词条')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /重试/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: '关闭查词结果' }).click();

  await page.getByRole('button', { name: '查询 offline', exact: true }).click();
  dialog = page.getByRole('dialog', { name: '词典释义' });
  await expect(dialog.getByText('外部词典暂时不可用', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '重试当前查询' })).toBeVisible();
});

test('the modal makes the background inert, traps focus, supports keyboard tabs, and restores focus after exit', async ({ page }) => {
  const languages: string[] = [];
  await lesson(page, route => {
    languages.push(new URL(route.request().url()).searchParams.get('lang') || '');
    return route.fulfill({ json: resultFixture() });
  });

  const trigger = page.getByRole('button', { name: '查询 Resilience', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '词典释义' });
  await expect(dialog).toBeFocused();
  const background = page.locator('[data-lookup-background]');
  await expect(background).toHaveAttribute('inert', '');
  await expect(background).toHaveAttribute('aria-hidden', 'true');

  const english = dialog.getByRole('tab', { name: '英英' });
  const chinese = dialog.getByRole('tab', { name: '英汉' });
  await english.focus();
  await page.keyboard.press('ArrowRight');
  await expect(chinese).toBeFocused();
  await expect(chinese).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => languages.at(-1)).toBe('zh');
  await expect(english).toHaveAttribute('tabindex', '-1');
  await expect(chinese).toHaveAttribute('aria-controls', 'dictionary-results');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: '使用设备发音' })).toBeFocused();
  await chinese.focus();
  await page.keyboard.press('ArrowRight');
  await expect(english).toBeFocused();
  await expect(english).toHaveAttribute('aria-selected', 'true');

  await dialog.getByRole('button', { name: '关闭查词结果' }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.locator(':focus')).toHaveCount(1);
  expect(await dialog.evaluate((node, active) => node.contains(active as Node), await page.evaluateHandle(() => document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');
  await expect(background).toHaveAttribute('inert', '');
  await expect(dialog).toBeHidden();
  await expect(background).not.toHaveAttribute('inert', '');
  await expect(trigger).toBeFocused();
});

test('long Paragraphs expose one Tab entry per sentence and arrow navigation reaches every lookup scope', async ({ page }) => {
  const words = Array.from({ length: 90 }, (_, index) => `word${String(index).padStart(2, '0')}`);
  const paragraph = `${words.join(' ')} extraordinarilylongscientificconcept.`;
  await lesson(page, route => route.fulfill({ json: resultFixture() }), paragraph);

  const article = page.getByLabel('课程文章');
  const sentence = article.locator('[data-lookup-sentence]');
  const lookupButtons = sentence.getByRole('button');
  await expect(sentence).toHaveCount(1);
  await expect(sentence).toHaveAttribute('tabindex', '0');
  await expect(lookupButtons).toHaveCount(91);
  expect(await lookupButtons.evaluateAll(nodes => nodes.every(node => node.getAttribute('tabindex') === '-1'))).toBe(true);

  await sentence.focus();
  await page.keyboard.press('ArrowRight');
  await expect(lookupButtons.first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(lookupButtons.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(lookupButtons.first()).toBeFocused();
  await expect(sentence).toHaveAttribute('aria-label', paragraph);
});

test('drawer controls remain reachable across desktop, portrait, landscape, missing media, long content, and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await lesson(page, route => route.fulfill({ json: resultFixture({
    word: 'extraordinarilylongscientificconcept',
    selectedScope: 'extraordinarilylongscientificconcept',
    lexeme: 'extraordinarilylongscientificconcept',
    accents: [{ region: 'us', label: '美音', source: 'provider', audioUrl: '/api/pronunciation?word=long&region=us', phonetic: '' }],
    meanings: Array.from({ length: 8 }, (_, index) => ({ partOfSpeech: 'noun', definitions: [{ definition: `Long definition ${index + 1}: ${'supportive text '.repeat(20)}` }] })),
  }) }), 'extraordinarilylongscientificconcept supports life.');

  await page.evaluate(() => {
    document.documentElement.style.setProperty('--lookup-safe-top', '18px');
    document.documentElement.style.setProperty('--lookup-safe-right', '12px');
    document.documentElement.style.setProperty('--lookup-safe-bottom', '16px');
    document.documentElement.style.setProperty('--lookup-safe-left', '8px');
  });
  const trigger = page.getByRole('button', { name: '查询 extraordinarilylongscientificconcept', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '词典释义' });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 780 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(viewport);
    const close = dialog.getByRole('button', { name: '关闭查词结果' });
    for (const control of [close, dialog.getByRole('tab', { name: '英英' }), dialog.getByRole('button', { name: '播放美音' }), dialog.getByRole('button', { name: /更多信息/ })]) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await expect(dialog.getByText('暂无图示')).toBeVisible();
    expect(await dialog.evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  }
  expect(await dialog.locator('.react-dictionary-header').evaluate(node => parseFloat(getComputedStyle(node).paddingTop))).toBeGreaterThanOrEqual(18);
  expect(await dialog.locator('.react-dictionary-content').evaluate(node => parseFloat(getComputedStyle(node).paddingBottom))).toBeGreaterThanOrEqual(16);
  await dialog.getByRole('button', { name: '关闭查词结果' }).click();
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 390, height: 780 });
  await page.getByRole('button', { name: '查询 extraordinarilylongscientificconcept', exact: true }).click();
  await page.addScriptTag({ path: path.join(process.cwd(), 'node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await (window as unknown as { axe: { run(root: Document): Promise<{ violations: Array<{ id: string }> }> } }).axe.run(document)).violations);
  expect(violations).toEqual([]);
});
