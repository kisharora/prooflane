/**
 * Optional local-only Playwright QA / recording helper.
 * It never enters, reads, logs, saves, or records an API key.
 * Install Playwright separately in an approved isolated folder; no app dependency is added.
 */
import { parseArgs } from 'node:util';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { values } = parseArgs({ options: {
  mode: { type: 'string', default: 'check' }, url: { type: 'string', default: 'http://127.0.0.1:4173' },
  out: { type: 'string', default: 'recordings' }, skill: { type: 'string', default: 'n8n automation' },
  location: { type: 'string', default: 'India' }, 'playwright-module': { type: 'string' }, executable: { type: 'string' },
  'live-authorized': { type: 'boolean', default: false }, headed: { type: 'boolean', default: false },
} });
if (!['check', 'record'].includes(values.mode)) throw new Error('Use --mode=check or --mode=record.');
const url = new URL(values.url);
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.search || url.hash) throw new Error('The demo driver accepts only a plain local loopback HTTP app URL.');
if (values.mode === 'record' && !values['live-authorized']) throw new Error('Recording requires --live-authorized after the user approves a real run of at most 5 requests.');
const output = resolve(values.out); await mkdir(output, { recursive: true });
let playwright;
try { playwright = values['playwright-module'] ? await import(pathToFileURL(resolve(values['playwright-module'])).href) : await import('playwright'); }
catch { throw new Error('Pass --playwright-module=/absolute/path/to/playwright/index.mjs from your approved isolated installation.'); }
const { chromium } = playwright.default || playwright;
if (values.mode === 'record') {
  const config = await fetch(new URL('/api/config.json', url), { signal: AbortSignal.timeout(3000) }).then(r => r.json());
  if (!config.liveAvailable) throw new Error('No live key is ready. Have the user enter a one-run key manually before recording; do not record that step.');
  if (config.hourlyRemaining < 5) throw new Error('Fewer than 5 requests remain under the server cap. Wait before recording.');
}
const browser = await chromium.launch({ headless: !values.headed, chromiumSandbox: true, ...(values.executable ? { executablePath: values.executable } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true, reducedMotion: 'reduce', ...(values.mode === 'record' ? { recordVideo: { dir: output, size: { width: 1440, height: 900 } } } : {}) });
// Every browser request must stay on the exact verified local app origin.
// This deliberately blocks external fonts and source links; system fonts remain available.
await context.route('**/*', route => {
  try { if (new URL(route.request().url()).origin === url.origin) return route.continue(); } catch {}
  return route.abort('blockedbyclient');
});
let primaryPage;
context.on('page', popup => { if (primaryPage && popup !== primaryPage) void popup.close(); });
const page = await context.newPage(); primaryPage = page;
page.on('framenavigated', frame => {
  if (frame !== page.mainFrame() || frame.url() === 'about:blank') return;
  try { if (new URL(frame.url()).origin === url.origin) return; } catch {}
  void page.close();
});
page.setDefaultTimeout(10000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const video = page.video();
const pause = ms => page.waitForTimeout(ms);
const take = async name => {
  await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('visible'));
  return page.screenshot({ path: resolve(output, name), fullPage: false });
};
async function open() {
  await page.goto(url.href, { waitUntil: 'networkidle' });
  if (new URL(page.url()).origin !== url.origin) throw new Error('The browser did not reach the authorized local app origin.');
  await page.locator('.opportunity-card').first().waitFor(); await page.evaluate(() => document.fonts.ready);
  if (values.mode === 'record') {
    await page.evaluate(origin => {
      const note = document.createElement('div'); note.id = 'prooflane-recording-context'; note.setAttribute('role', 'note');
      note.textContent = `LOCAL SCREEN RECORDING · ${origin}`;
      Object.assign(note.style, { position: 'fixed', bottom: '10px', right: '12px', padding: '7px 10px', border: '1px solid #cad6ba', borderRadius: '5px', background: '#fbfdf5', color: '#526f3b', font: '10px monospace', zIndex: '100', pointerEvents: 'none' });
      document.body.append(note);
    }, url.origin);
  }
}
async function checkJourney() {
  await open();
  await take('prooflane-desktop-board.png');
  await page.locator('.card-title').first().click(); await page.locator('#detail-dialog').waitFor({ state: 'visible' });
  await take('prooflane-desktop-evidence.png');
  await page.locator('#detail-dialog [data-action="save"]').click();
  await page.locator('#candidate-note').fill('Confirm availability, scope, and payment at the original source.');
  await page.locator('[data-action="close-detail"]').click();
  await page.locator('.sidebar [data-view="shortlist"]').click();
  if (await page.locator('.shortlist-grid .opportunity-card').count() !== 1) throw new Error('Shortlist did not update.');
  await take('prooflane-desktop-shortlist.png');
  await page.locator('[data-action="export"]').click();
  const downloaded = page.waitForEvent('download'); await page.locator('[data-action="download-brief"]').click();
  await (await downloaded).saveAs(resolve(output, 'prooflane-example-brief.txt'));
  await page.locator('[data-action="close-info"]').click();
  await page.locator('.sidebar [data-view="trail"]').click(); await take('prooflane-search-trail.png');
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('.sidebar [data-view="board"]').click();
  await take('prooflane-mobile-board.png');
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error('Mobile page has horizontal overflow.');
  await page.locator('.card-title').first().click(); await take('prooflane-mobile-evidence.png');
  if (errors.length) throw new Error(`Uncaught browser pageerror events: ${errors.join('; ')}`);
  console.log('PASS: desktop/mobile screenshots, evidence drawer, shortlist, notes, export, search trail, and no uncaught pageerror events.');
}
async function recordJourney() {
  await open(); await take('prooflane-before-live.png'); await pause(3000);
  await page.locator('#skill').fill(values.skill); await page.locator('#location').fill(values.location);
  await page.locator('#remote').check(); await page.locator('#budget').selectOption('5'); await page.locator('#mode').selectOption('live');
  await pause(2000);
  const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/research' && response.request().method() === 'POST', { timeout: 65000 });
  await page.locator('#search-button').click(); const response = await responsePromise; const run = await response.json();
  if (!response.ok() || run.status === 'failed' || run.mode !== 'live' || !run.candidates?.length) throw new Error('The real live run did not produce usable results. Keep the failure honest; do not present this recording as a completed live demo.');
  if (run.stats.requestsUsed > 5) throw new Error('The live request count exceeded the authorized demo budget.');
  // Review-only artifact. It contains sanitized search results, never a key. Do not publish without review.
  await writeFile(resolve(output, 'live-run.private-review.json'), JSON.stringify(run, null, 2));
  await page.locator('#search-button').waitFor({ state: 'visible' }); await page.locator('.opportunity-card').first().waitFor();
  await pause(5000); await take('prooflane-live-board.png');
  await page.locator('.card-title').first().click(); await pause(5000); await take('prooflane-live-evidence.png');
  await page.locator('.evidence-box').first().scrollIntoViewIfNeeded(); await pause(5500);
  await page.locator('.query-details summary').first().click(); await pause(4500);
  await page.locator('#detail-dialog [data-action="save"]').scrollIntoViewIfNeeded(); await page.locator('#detail-dialog [data-action="save"]').click(); await pause(2000);
  await page.locator('[data-action="close-detail"]').click();
  await page.locator('.sidebar [data-view="trail"]').click(); await pause(6500); await take('prooflane-live-trail.png');
  await page.locator('.sidebar [data-view="shortlist"]').click(); await pause(4000);
  await page.locator('.card-title').first().click(); await page.locator('#candidate-note').fill('Confirm scope, budget, and whether applications are still open.'); await pause(3000);
  await page.locator('[data-action="close-detail"]').click(); await page.locator('[data-action="export"]').click(); await pause(2500);
  const download = page.waitForEvent('download'); await page.locator('[data-action="download-brief"]').click(); await (await download).saveAs(resolve(output, 'prooflane-live-brief.txt')); await pause(2500);
  await page.locator('[data-action="close-info"]').click();
  // An explicitly labeled fixture segment demonstrates the stale-thread edge case, not live evidence.
  await page.locator('#mode').selectOption('example'); await page.locator('#search-button').click(); await pause(4000);
  await page.getByRole('button', { name: 'Paid design trial for a website project', exact: true }).click(); await pause(4500);
  await page.locator('.evidence-box').last().scrollIntoViewIfNeeded(); await pause(5000);
  await page.locator('[data-action="close-detail"]').click(); await page.locator('#how-button').click(); await pause(4500);
  if (errors.length) throw new Error(`Uncaught browser pageerror events: ${errors.join('; ')}`);
  console.log(`PASS: real SerpApi flow demonstrated with ${run.stats.requestsUsed} provider requests, ${run.candidates.length} candidates, source evidence, search trail, shortlist, notes, and export. Fixture segment remains explicitly labeled.`);
}
let success = false, timer;
try {
  await Promise.race([values.mode === 'check' ? checkJourney() : recordJourney(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The driver reached its 165-second safety deadline.')), 165000); })]);
  success = true;
} finally {
  clearTimeout(timer); await context.close(); await browser.close();
  if (video && success) { const original = await video.path(); await copyFile(original, resolve(output, 'prooflane-demo.webm')); console.log('Recording saved as prooflane-demo.webm. Verify its duration is under 180 seconds and review every frame for sensitive information before public sharing.'); }
  else if (video) console.log('Incomplete raw recording retained for private diagnosis only. Do not submit it as a successful demo.');
}
