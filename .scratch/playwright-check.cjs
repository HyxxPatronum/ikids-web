const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push('CONSOLE: ' + msg.text());
  });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));
  page.on('requestfailed', req => failedRequests.push(req.url() + ' → ' + (req.failure()?.errorText || '')));

  const url = process.argv[2] || 'http://localhost:3000/index.html';
  console.log('访问:', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => console.log('导航失败:', e.message));
  await page.waitForTimeout(2000);

  // 看看页面显示了什么
  const body = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('--- 页面内容 ---');
  console.log(body);
  console.log('--- 控制台错误 ---');
  console.log(consoleErrors.length ? consoleErrors.join('\n') : '(无)');
  console.log('--- 失败请求 ---');
  console.log(failedRequests.length ? failedRequests.join('\n') : '(无)');

  await browser.close();
})();
