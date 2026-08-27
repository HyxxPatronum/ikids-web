const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('404')) errors.push(msg.text()); });

  await page.goto('http://localhost:3000/index.html?lesson=day001-seed', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 点击"开始配对"进入连线题
  const toggle = await page.$('#toggleWordBank');
  if (toggle) { await toggle.click(); await page.waitForTimeout(500); }

  // 模拟匹配：点第一个词 + 对应含义
  // 获取配对数据（从页面 state 拿不到，就从 DOM 里找）
  const words = await page.$$eval('[data-match-word]', els => els.map(e => e.dataset.matchWord));
  const meanings = await page.$$eval('[data-match-meaning]', els => els.map(e => ({ m: e.dataset.matchMeaning, a: e.dataset.matchAnswer })));
  console.log('剩余词:', words);
  console.log('剩余含义:', meanings);

  // 找一对：词 = answer 的含义
  if (words.length && meanings.length) {
    const pair = meanings.find(x => x.a === words[0]);
    if (pair) {
      // 点词
      const wBtn = await page.$(`[data-match-word="${words[0]}"]`);
      await wBtn.click();
      await page.waitForTimeout(300);
      // 点对应含义
      const mBtn = await page.$(`[data-match-meaning="${pair.m}"]`);
      await mBtn.click();
      await page.waitForTimeout(600);
    }
  }

  const body = await page.evaluate(() => document.body.innerText.slice(0, 1200));
  console.log('--- 匹配后页面 ---');
  console.log(body);
  console.log('--- 结果栏 ---');
  const results = await page.$$eval('.match-result-chip', els => els.map(e => e.innerText));
  console.log('结果栏内容:', results);
  const resultsBoxBg = await page.$eval('.match-results-box', el => getComputedStyle(el).backgroundColor);
  console.log('结果栏背景色:', resultsBoxBg);
  const bankBoxBg = await page.$eval('.word-bank-box', el => getComputedStyle(el).backgroundColor);
  console.log('词卡box背景色:', bankBoxBg);
  console.log('--- 错误 ---');
  console.log(errors.length ? errors.join('\n') : '(无)');

  await browser.close();
})();
