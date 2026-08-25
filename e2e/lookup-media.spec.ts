import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { normalizeIllustration, normalizePronunciationAssets, studentIllustration } from '../lib/media/course-media.ts';
import { resolveAccentOptions } from '../lib/pronunciation/accents.ts';

const lexeme = 'flower';
const approvedIllustration = { src: 'day001-flower.png', alt: '花瓣正在慢慢展开的课程图示', source: 'course-illustration-library', review: 'approved' };
const providerAudio = (region: string) => `https://ssl.gstatic.com/dictionary/static/sounds/${region}/flower.mp3`;
const tinyPng = () => Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

// A silent local WAV keeps browser playback deterministic and never touches a real audio provider.
function silentWav(seconds = 8) {
  const rate = 8000;
  const data = Buffer.alloc(rate * seconds * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function dictionaryFixture(options: {
  course?: unknown;
  provider?: Array<{ region: string; audio?: string; phonetic?: string }>;
  illustration?: unknown;
}) {
  return {
    word: lexeme, selectedScope: lexeme, lexeme, catalogMembership: 'science', meaning: '会开花的植物部分',
    illustration: studentIllustration(normalizeIllustration(options.illustration)),
    accents: resolveAccentOptions({
      lexeme,
      course: normalizePronunciationAssets(options.course ?? []),
      provider: options.provider,
    }),
    meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'fixture definition for flower' }] }],
    pronunciations: options.provider ?? [], provider: 'Fixture', cacheStatus: 'hit',
  };
}

async function openLookup(page: Page, fixture: ReturnType<typeof dictionaryFixture>) {
  const audioRequests: string[] = [];
  const imageRequests: string[] = [];
  const providerRequests: string[] = [];
  await page.addInitScript(() => {
    const spoken: Array<{ text: string; lang: string }> = [];
    (window as unknown as { __spoken: typeof spoken }).__spoken = spoken;
    class FixtureUtterance {
      text: string; lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FixtureUtterance });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak(utterance: FixtureUtterance) { spoken.push({ text: utterance.text, lang: utterance.lang }); } },
    });
  });
  await page.route('**/api/cards/media-course', route => route.fulfill({ json: {
    cardId: 'media-course', courseId: 'science-reading', title: 'Flower Media', topic: 'Living Things', theme: 'Flowers',
    paragraphs: ['Flower petals unfold slowly.'], word_bank: [],
  } }));
  await page.route('**/api/dictionary?**', route => route.fulfill({ json: fixture }));
  await page.route('https://ssl.gstatic.com/**', route => { providerRequests.push(route.request().url()); return route.abort(); });
  await page.route('**/day001-flower.png', route => {
    imageRequests.push(route.request().url());
    return route.fulfill({ body: tinyPng(), headers: { 'content-type': 'image/png' } });
  });
  await page.route('**/media/flower-*.wav', route => {
    audioRequests.push(route.request().url());
    return route.fulfill({ body: silentWav(), headers: { 'content-type': 'audio/wav' } });
  });
  await page.goto('/lesson/media-course');
  await page.getByRole('button', { name: '查询 Flower', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '词典释义' });
  await expect(dialog.getByRole('heading', { name: lexeme })).toBeVisible();
  return { dialog, audioRequests, imageRequests, providerRequests };
}

test('两个口音都可用时学生看到独立控件，音频只经过本站，并且快速重复触发不会重叠播放', async ({ page }) => {
  const fixture = dictionaryFixture({
    course: [{ region: 'us', src: 'media/flower-us.wav', source: 'studio', storage: 'r2', availability: 'ready' }],
    provider: [{ region: 'uk', audio: providerAudio('uk'), phonetic: '/ˈflaʊə/' }],
    illustration: approvedIllustration,
  });
  const proxied: string[] = [];
  await page.route('**/api/pronunciation**', route => {
    proxied.push(route.request().url());
    return route.fulfill({ body: silentWav(), headers: { 'content-type': 'audio/mpeg' } });
  });
  const { dialog, audioRequests, imageRequests, providerRequests } = await openLookup(page, fixture);

  const image = dialog.getByRole('img', { name: approvedIllustration.alt });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(1);
  expect(imageRequests).toHaveLength(1);
  const american = dialog.getByRole('button', { name: '播放美音' });
  await american.click();
  await expect(dialog.getByRole('status')).toHaveText('美音 正在播放');
  await american.click();
  await american.click();
  expect(audioRequests).toHaveLength(1);
  expect(new URL(audioRequests[0]).origin).toBe('http://127.0.0.1:4175');

  await dialog.getByRole('button', { name: '播放英音' }).click();
  await expect(dialog.getByRole('status')).toHaveText('英音 正在播放');
  expect(proxied).toHaveLength(1);
  expect(new URL(proxied[0]).pathname).toBe('/api/pronunciation');
  expect(new URL(proxied[0]).searchParams.get('region')).toBe('uk');
  expect(providerRequests).toEqual([]);
});

test('只有美音录音时英音控件不出现', async ({ page }) => {
  const { dialog } = await openLookup(page, dictionaryFixture({
    course: [
      { region: 'us', src: 'media/flower-us.wav', source: 'studio', storage: 'r2', availability: 'ready' },
      { region: 'uk', src: 'media/flower-uk.wav', source: 'studio', storage: 'r2', availability: 'pending' },
    ],
    illustration: approvedIllustration,
  }));
  await expect(dialog.getByRole('button', { name: '播放美音' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '播放英音' })).toHaveCount(0);
});

test('只有英音录音时美音控件不出现', async ({ page }) => {
  await page.route('**/api/pronunciation**', route => route.fulfill({ body: silentWav(), headers: { 'content-type': 'audio/mpeg' } }));
  const { dialog } = await openLookup(page, dictionaryFixture({
    provider: [{ region: 'uk', audio: providerAudio('uk') }],
    illustration: approvedIllustration,
  }));
  await expect(dialog.getByRole('button', { name: '播放英音' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '播放美音' })).toHaveCount(0);
});

test('一个录音不会同时被标注为美音和英音', async ({ page }) => {
  const shared = providerAudio('uk');
  await page.route('**/api/pronunciation**', route => route.fulfill({ body: silentWav(), headers: { 'content-type': 'audio/mpeg' } }));
  const { dialog } = await openLookup(page, dictionaryFixture({
    provider: [{ region: 'us', audio: shared }, { region: 'uk', audio: shared }],
    illustration: approvedIllustration,
  }));
  await expect(dialog.getByRole('button', { name: '播放美音' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '播放英音' })).toHaveCount(0);
});

test('两个口音都不可用时学生只看到设备发音降级入口', async ({ page }) => {
  const { dialog } = await openLookup(page, dictionaryFixture({ illustration: approvedIllustration }));
  await expect(dialog.getByRole('button', { name: '播放美音' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '播放英音' })).toHaveCount(0);
  await dialog.getByRole('button', { name: '使用设备发音' }).click();
  await expect(dialog.getByRole('status')).toHaveText('美音 已降级到设备发音');
  expect(await page.evaluate(() => (window as unknown as { __spoken: Array<{ text: string; lang: string }> }).__spoken))
    .toEqual([{ text: lexeme, lang: 'en-US' }]);
});

test('代理失败时播放明确降级到设备语音合成', async ({ page }) => {
  const fixture = dictionaryFixture({
    provider: [{ region: 'uk', audio: providerAudio('uk') }],
    illustration: approvedIllustration,
  });
  await page.route('**/api/pronunciation**', route => route.fulfill({ status: 502, json: { error: '发音服务暂时不可用' } }));
  const { dialog, providerRequests } = await openLookup(page, fixture);
  await dialog.getByRole('button', { name: '播放英音' }).click();
  await expect(dialog.getByRole('status')).toHaveText('英音 已降级到设备发音');
  expect(await page.evaluate(() => (window as unknown as { __spoken: Array<{ text: string; lang: string }> }).__spoken))
    .toEqual([{ text: lexeme, lang: 'en-GB' }]);
  expect(providerRequests).toEqual([]);
});

test('未审核图片不会出现在学生查词中，空态保持稳定', async ({ page }) => {
  const { dialog } = await openLookup(page, dictionaryFixture({
    illustration: { ...approvedIllustration, review: 'pending' },
  }));
  await expect(dialog.getByText('暂无图示')).toBeVisible();
  await expect(dialog.getByRole('img', { name: approvedIllustration.alt })).toHaveCount(0);
});

test('桌面端图片位于词语信息右侧，小屏仍能看到图片和发音控件', async ({ page }) => {
  const fixture = dictionaryFixture({
    course: [{ region: 'us', src: 'media/flower-us.wav', source: 'studio', storage: 'r2', availability: 'ready' }],
    illustration: approvedIllustration,
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const { dialog } = await openLookup(page, fixture);
  const illustration = dialog.getByRole('img', { name: approvedIllustration.alt });
  const controls = dialog.getByRole('group', { name: '发音控件' });
  const wide = { image: await illustration.boundingBox(), controls: await controls.boundingBox() };
  expect(wide.image!.x).toBeGreaterThan(wide.controls!.x + wide.controls!.width);

  await page.setViewportSize({ width: 390, height: 780 });
  const narrow = { image: await illustration.boundingBox(), controls: await controls.boundingBox() };
  expect(narrow.image!.x).toBeLessThan(narrow.controls!.x + narrow.controls!.width);
  for (const box of [narrow.image!, narrow.controls!]) {
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  await expect(illustration).toBeVisible();
  await expect(dialog.getByRole('button', { name: '播放美音' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '使用设备发音' })).toBeVisible();
});

test('内容编辑准备的图示与分口音录音元数据随发布进入学生查词，未审核图片被挡住', async ({ request }) => {
  const api = 'http://127.0.0.1:4176/api';
  const cardId = 'playwright-lookup-media';
  const headers = { authorization: 'Bearer playwright-preview-token' };
  const card = {
    cardId,
    courseId: 'science-reading',
    topic: 'Living Things',
    theme: 'Lookup Media',
    day: 903,
    level: 'L1',
    title: 'Lookup Media Fixture',
    articleStructure: 'Feature-Function',
    paragraphs: ['A blossom keeps its stamen safe.'],
    word_bank: [
      {
        english: 'blossom', chinese: '花朵', approved: true,
        illustration: { src: 'media/blossom.png', alt: '正在开放的花朵', source: 'course-illustration-library', review: 'approved' },
        pronunciations: [
          { region: 'us', src: 'media/blossom-us.mp3', source: 'studio', storage: 'r2', availability: 'ready' },
          { region: 'uk', src: 'media/blossom-uk.mp3', source: 'studio', storage: 'r2', availability: 'pending' },
        ],
      },
      {
        english: 'stamen', chinese: '雄蕊', approved: true,
        illustration: { src: 'media/stamen.png', alt: '雄蕊特写', source: 'course-illustration-library', review: 'pending' },
      },
      { english: 'petalfixture', chinese: '花瓣', approved: true },
      { english: 'rootfixture', chinese: '根', approved: true },
      { english: 'soilfixture', chinese: '土壤', approved: true },
    ],
    comprehension: { questions: [
      { options: ['A', 'B', 'C'], answer: 'A' },
      { options: ['A', 'B', 'C'], answer: 'B' },
      { options: ['A', 'B', 'C'], answer: 'C' },
    ] },
    rebuild: { steps: ['one', 'two', 'three'] },
  };

  const unsupportedAccent = await request.get(`${api}/pronunciation?word=blossom&region=other`);
  expect(unsupportedAccent.status()).toBe(400);

  expect((await request.post(`${api}/cards`, { data: card })).status()).toBe(201);
  try {
    const preview = await request.get(`${api}/cards/${cardId}/vocabulary-preview`, { headers });
    expect(preview.status()).toBe(200);
    const terms = (await preview.json()).terms as Array<Record<string, any>>;
    expect(terms.find(term => term.english === 'blossom')).toMatchObject({
      illustration: { src: 'media/blossom.png', alt: '正在开放的花朵', source: 'course-illustration-library', review: 'approved' },
      pronunciations: [
        { region: 'us', source: 'studio', storage: 'r2', availability: 'ready' },
        { region: 'uk', source: 'studio', storage: 'r2', availability: 'pending' },
      ],
    });
    expect(terms.find(term => term.english === 'stamen')?.illustration.review).toBe('pending');

    expect((await request.post(`${api}/cards/${cardId}/publish`)).status()).toBe(200);
    const blossom = await (await request.get(`${api}/dictionary?word=blossom&courseId=${cardId}&lang=zh`)).json();
    expect(blossom.illustration).toMatchObject({ src: 'media/blossom.png', alt: '正在开放的花朵' });
    expect(blossom.accents.find((accent: { region: string }) => accent.region === 'us')).toMatchObject({ source: 'course', audioUrl: 'media/blossom-us.mp3' });
    expect(blossom.accents.find((accent: { region: string }) => accent.region === 'uk')?.source).not.toBe('course');

    const stamen = await (await request.get(`${api}/dictionary?word=stamen&courseId=${cardId}&lang=zh`)).json();
    expect(stamen.illustration).toBeNull();
  } finally {
    expect((await request.post(`${api}/cards/${cardId}/archive`)).status()).toBe(200);
  }
});
