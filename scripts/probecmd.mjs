import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:4186';
const seen = new Set();

function log(...a) {
  const line = a.map(String).join(' ');
  if (!seen.has(line)) { seen.add(line); console.log('[pod]', line); }
}

const probe = async () => {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
  const p = await ctx.newPage();
  const events = [];
  p.on('pageerror', e => events.push('PAGE ' + e.message));
  p.on('console', m => { if (m.type() === 'error') events.push('CON ' + m.text()); });
  try {
    await p.goto(base, { waitUntil: 'domcontentloaded', timeout: 20000 });
    log('HTTP_OK_390');
    log('url390=' + p.url());
    log('err390=' + (events.length ? events.join(' | ') : 'none'));
    await p.waitForTimeout(800);
    log('shot390=' + (await p.screenshot({ path: 'tmp/probecmd-390.png' }) ? 'ok' : 'fail'));
    if (p.locator('#nav').count()) {
      await p.locator('#nav [data-act="tab"][data-t="arena"]').click();
      await p.waitForTimeout(600);
      log('arena390=' + (await p.locator('#s-arena .wordmark').textContent().catch(() => 'NO')));
    }
    await ctx.close();
  } catch (e) { log('E390=' + e.message); }
  try {
    const ctx2 = await b.newContext({ viewport: { width: 360, height: 800 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    const p2 = await ctx2.newPage();
    const events2 = [];
    p2.on('pageerror', e => events2.push('PAGE ' + e.message));
    p2.on('console', m => { if (m.type() === 'error') events2.push('CON ' + m.text()); });
    await p2.goto(base, { waitUntil: 'domcontentloaded', timeout: 20000 });
    log('HTTP_OK_360');
    log('url360=' + p2.url());
    log('err360=' + (events2.length ? events2.join(' | ') : 'none'));
    await p2.waitForTimeout(800);
    log('shot360=' + (await p2.screenshot({ path: 'tmp/probecmd-360.png' }) ? 'ok' : 'fail'));
    if (p2.locator('#nav').count()) {
      await p2.locator('#nav [data-act="tab"][data-t="arena"]').click();
      await p2.waitForTimeout(600);
      log('arena360=' + (await p2.locator('#s-arena .wordmark').textContent().catch(() => 'NO')));
    }
    await ctx2.close();
  } catch (e) { log('E360=' + e.message); }
  await b.close();
};
void probe().then(() => process.exit(0)).catch(e => { log('BOOT=' + e.message); process.exit(1); });
