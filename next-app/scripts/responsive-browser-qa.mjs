import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const previewUrl = process.env.PREVIEW_URL;
if (!previewUrl) throw new Error('PREVIEW_URL is required');

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];
const executablePath = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!executablePath) throw new Error('No system Chromium/Chrome executable found');

const widths = [
  [320, 760],
  [360, 800],
  [390, 844],
  [430, 900],
  [480, 900],
  [768, 1024],
  [1024, 900],
  [1280, 900],
  [1440, 1000],
  [1920, 1080]
];

const outDir = path.resolve('artifacts/responsive');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const runtimeErrors = [];
page.on('pageerror', (error) => runtimeErrors.push(error.message));

await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForSelector('body', { timeout: 20_000 });

// Keep QA vaults local so responsive checks never pollute cloud data.
await context.setOffline(true);

if (await page.getByRole('button', { name: 'Generate phrase' }).isVisible().catch(() => false)) {
  await page.getByRole('button', { name: 'Generate phrase' }).click();
  await page.getByLabel('I saved these 24 words.').check();
  await page.getByRole('button', { name: 'Create vault' }).click();
}

await page.getByRole('heading', { name: 'Add transaction' }).waitFor({ timeout: 15_000 });

if (await page.locator('.ledger-row').count() === 0) {
  const reason = page.getByPlaceholder('What did you spend on?');
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();
  await reason.fill('Responsive QA transaction');
  await page.waitForTimeout(100);
  const save = page.getByRole('button', { name: 'Save transaction' });
  await save.waitFor({ state: 'visible' });
  if (await save.isDisabled()) throw new Error('Save transaction stayed disabled during QA setup');
  await save.click();
  await page.getByText('Responsive QA transaction', { exact: true }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1000);
  const savedRows = await page.locator('.ledger-row').count();
  console.log('QA rows after save:', savedRows);
  if (savedRows < 1) throw new Error('Transaction appeared after save but disappeared from the ledger');
}

const historicalDates = await page.evaluate(() => [1, 2, 3, 4].map((offset) => {
  const date = new Date();
  date.setDate(15);
  date.setMonth(date.getMonth() - offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}));
await page.locator('.transaction-details').evaluate((el) => { el.open = true; });
for (const [index, date] of historicalDates.entries()) {
  await page.locator('input[type="date"]').first().fill(date);
  await page.getByPlaceholder('What did you spend on?').fill(`Responsive QA month ${index + 1}`);
  for (const digit of ['4', '2']) await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await page.getByText(`Responsive QA month ${index + 1}`, { exact: true }).waitFor({ timeout: 10_000 });
}

console.log('QA rows before opening details:', await page.locator('.ledger-row').count());
await page.locator('.home-customizer').evaluate((el) => { el.open = true; });
console.log('QA rows after opening customizer:', await page.locator('.ledger-row').count());
await page.locator('.tools-card').evaluate((el) => { el.open = true; });
console.log('QA rows after opening settings:', await page.locator('.ledger-row').count());

const failures = [];
const report = [];

for (const [width, height] of widths) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(150);
  console.log(`QA rows at ${width}px:`, await page.locator('.ledger-row').count());

  const diagnostics = await page.evaluate(() => {
    const root = document.documentElement;
    const vw = root.clientWidth;
    const scrollOverflow = root.scrollWidth - vw;
    const transactionCount = document.querySelectorAll('.ledger-row').length;

    const topLevel = [
      ...document.querySelectorAll(
        '.app-header, .hero, .home-customizer, .dashboard-quick-add, .dashboard-import, .dashboard-transactions, .dashboard-budget, .dashboard-review, .dashboard-overview, .tools-card'
      )
    ];

    const outside = topLevel
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          className: el.className,
          left: r.left,
          right: r.right,
          width: r.width
        };
      })
      .filter((r) => r.left < -1 || r.right > vw + 1);

    const zeroWidth = [...document.querySelectorAll('button, input, select, textarea')]
      .filter((el) => {
        const style = getComputedStyle(el);
        return el.checkVisibility() &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0';
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, text: el.textContent?.trim() || '', width: r.width, height: r.height };
      })
      .filter((r) => r.width < 1 || r.height < 1);

    const elementOverflows = [...document.querySelectorAll('body *')]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          tag: el.tagName,
          className: typeof el.className === 'string' ? el.className : '',
          text: (el.textContent || '').trim().slice(0, 60),
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          rectWidth: Math.round(rect.width),
          display: style.display,
          overflowX: style.overflowX,
          minWidth: style.minWidth,
          width: style.width
        };
      })
      .filter((item) => item.scrollWidth > item.clientWidth + 2 && item.overflowX !== 'auto')
      .sort((a, b) => (b.scrollWidth - b.clientWidth) - (a.scrollWidth - a.clientWidth))
      .slice(0, 12);

    const rails = '.source-strip, .preset-strip, .month-filter-rail, .vault-id-value';
    const escaped = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (r.left < -1 || r.right > vw + 1) && !el.closest(rails);
      })
      .map((el) => `${el.tagName}.${typeof el.className === 'string' ? el.className : ''}`)
      .slice(0, 12);
    const settingsOverflow = [...document.querySelectorAll('.setting-select')]
      .filter((el) => el.scrollWidth > el.clientWidth + 2)
      .map((el) => el.textContent?.trim());
    const appBottom = document.querySelector('.app-shell')?.getBoundingClientRect().bottom ?? 0;
    const blankBelow = Math.max(0, root.scrollHeight - appBottom - window.scrollY);

    return { vw, scrollWidth: root.scrollWidth, scrollOverflow, transactionCount, outside, zeroWidth, elementOverflows, escaped, settingsOverflow, blankBelow };
  });

  if (diagnostics.transactionCount < 1) {
    failures.push(`${width}px: QA transaction is missing from the transaction list`);
  }

  if (diagnostics.scrollOverflow > 1) {
    failures.push(`${width}px: document overflows horizontally by ${diagnostics.scrollOverflow}px; likely elements: ${JSON.stringify(diagnostics.elementOverflows)}`);
  }
  if (diagnostics.outside.length) {
    failures.push(`${width}px: top-level cards leave viewport: ${JSON.stringify(diagnostics.outside)}`);
  }
  if (diagnostics.zeroWidth.length) {
    failures.push(`${width}px: visible controls collapsed: ${JSON.stringify(diagnostics.zeroWidth)}`);
  }
  if (diagnostics.escaped.length) {
    failures.push(`${width}px: content escapes the viewport outside intentional horizontal rails: ${JSON.stringify(diagnostics.escaped)}`);
  }
  if (diagnostics.settingsOverflow.length) {
    failures.push(`${width}px: settings controls exceed their containers: ${JSON.stringify(diagnostics.settingsOverflow)}`);
  }
  if (diagnostics.blankBelow > 96) {
    failures.push(`${width}px: ${Math.round(diagnostics.blankBelow)}px of blank space below the app`);
  }

  const screenshot = path.join(outDir, `${width}x${height}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  if (width === 390) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(outDir, '390x844-viewport.png') });
  }
  report.push({ width, height, ...diagnostics, screenshot: path.relative(process.cwd(), screenshot) });
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

await browser.close();

if (runtimeErrors.length) failures.push(`Runtime errors: ${runtimeErrors.join('; ')}`);

if (failures.length) {
  console.error('Responsive browser QA failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log(`Responsive browser QA passed at ${widths.map(([w]) => w).join(', ')}px.`);
