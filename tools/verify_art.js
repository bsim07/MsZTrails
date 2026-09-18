#!/usr/bin/env node
/**
 * Acceptance checks for the pixel-art handoff.
 *
 *   npm i -D playwright     (once)
 *   node tools/verify_art.js [path/to/index.html]
 *
 * Exits non-zero if anything fails. Every check corresponds to a numbered item
 * in ART_HANDOFF.md section 9 — these are the observable ones, so neither you
 * nor a reviewer has to eyeball them.
 */
const path = require('path');
const { chromium } = require('playwright');

const target = process.argv[2]
  ? 'file://' + path.resolve(process.argv[2])
  : 'file://' + path.resolve(__dirname, '..', 'index.html');

const results = [];
const check = (name, pass, detail = '') =>
  results.push({ name, pass: !!pass, detail });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/net::/.test(m.text())) errors.push(m.text());
  });

  await page.goto(target);
  await page.waitForTimeout(900);

  // --- title screen
  check('two pixel avatar cards',
    (await page.$$('.avatar-btn .portrait')).length === 2);
  await page.click('.avatar-btn[data-avatar="female"]');
  check('avatar selection swaps',
    await page.$eval('.avatar-btn[data-avatar="female"]',
      e => e.classList.contains('selected')));
  await page.click('.avatar-btn[data-avatar="male"]');

  await page.fill('#nameInput', 'Test');
  await page.click('#startBtn');
  await page.waitForTimeout(1200);

  // --- the invariant
  const px = await page.evaluate(() => getComputedStyle(document.documentElement)
    .getPropertyValue('--px').trim());
  check('--px is an integer >= 2', /^\d+$/.test(px) && +px >= 2, `--px=${px}`);
  check('#mapGrid perspective removed',
    await page.$eval('#mapGrid', e => getComputedStyle(e).perspective) === 'none');
  check('#mapWorld is not rotated',
    !/matrix3d/.test(await page.$eval('#mapWorld', e => getComputedStyle(e).transform)));
  const gw = await page.$eval('#mapGrid', e => e.clientWidth);
  check('map viewport is a whole number of tiles',
    gw % (16 * +px) === 0, `${gw}px at ${px}x`);

  // --- sheets are actually wired up
  check('tiles come from tiles.png',
    /tiles\.png/.test(await page.$eval('.t-tree', e => getComputedStyle(e).backgroundImage)));
  check('player comes from chars.png',
    /chars\.png/.test(await page.$eval('#player .sprite', e => getComputedStyle(e).backgroundImage)));
  check('tiles render pixelated',
    /pixelated|crisp/.test(await page.$eval('.tile', e => getComputedStyle(e).imageRendering)));
  check('player sprite is 16x24 source pixels',
    await page.$eval('#player .sprite',
      (e, p) => e.clientWidth === 16 * p && e.clientHeight === 24 * p, +px));

  // --- facing
  for (const [key, cls] of [['ArrowRight', 'face-right'], ['ArrowLeft', 'face-left'],
                            ['ArrowUp', 'face-up'], ['ArrowDown', 'face-down']]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(220);
    check(`sprite ${cls} after ${key}`,
      (await page.$eval('#player .sprite', e => e.className)).includes(cls));
  }

  // --- old markup is gone
  check('no .blade-cluster elements built', (await page.$$('.blade-cluster')).length === 0);
  check('no .terrain-sprite elements built', (await page.$$('.terrain-sprite')).length === 0);
  check('NPCs render as sprites', (await page.$$('.t-guide .npc')).length > 0);

  // --- variety and edges
  check('forest wall uses more than one variant',
    new Set(await page.$$eval('.t-tree',
      els => els.map(e => getComputedStyle(e).getPropertyValue('--cx').trim()))).size > 1);
  check('path edge tiles are applied',
    await page.$$eval('.t-path', els => els.filter(e => /edge-/.test(e.className)).length) > 0);
  check('grass sway is staggered per tile',
    new Set(await page.$$eval('.t-grass', els => els.map(e => e.style.animationDelay))).size > 2);

  // --- responsive
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.waitForTimeout(500);
  const px2 = await page.evaluate(() => getComputedStyle(document.documentElement)
    .getPropertyValue('--px').trim());
  check('--px scales up on a wider viewport', +px2 > +px, `${px} -> ${px2}`);

  check('no runtime errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  // --- reduced motion
  const rm = await browser.newPage({ viewport: { width: 430, height: 900 } });
  await rm.emulateMedia({ reducedMotion: 'reduce' });
  await rm.goto(target);
  await rm.waitForTimeout(600);
  await rm.fill('#nameInput', 'Test');
  await rm.click('#startBtn');
  await rm.waitForTimeout(900);
  check('prefers-reduced-motion stops every animation',
    (await rm.$$eval('.t-grass, .t-water, #player .sprite',
      els => els.map(e => getComputedStyle(e).animationName))).every(a => a === 'none'));
  await rm.keyboard.press('ArrowRight');
  await rm.waitForTimeout(300);
  check('still playable with reduced motion', (await rm.$('#player')) !== null);

  await browser.close();

  const failed = results.filter(r => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? 'ok  ' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
