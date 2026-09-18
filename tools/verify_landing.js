#!/usr/bin/env node
/**
 * Cross-device checks for the landing (title) screen.
 *
 *   npm i -D playwright     (once)
 *   node tools/verify_landing.js [path/to/index.html]
 *
 * Exits non-zero on any failure. Every check here corresponds to a numbered
 * item in LANDING_HANDOFF.md section 6.
 *
 * What it can and cannot tell you: this drives Chromium only, so it proves
 * layout, sizing and sprite geometry across viewports. It cannot prove Safari
 * or Firefox rendering — for those, the handoff relies on removing the
 * engine-specific hazards rather than on testing after the fact.
 */
const path = require('path');
const { chromium } = require('playwright');

const target = process.argv[2]
  ? 'file://' + path.resolve(process.argv[2])
  : 'file://' + path.resolve(__dirname, '..', 'index.html');

// Deliberately includes the two shapes that break layouts: the narrowest
// phone still in classrooms, and a phone held sideways.
const VIEWPORTS = [
  ['iPhone SE',        320, 568],
  ['iPhone 12 mini',   360, 780],
  ['iPhone 14',        390, 844],
  ['Pixel 7',          412, 915],
  ['iPhone 14 Pro Max',430, 932],
  ['phone landscape',  844, 390],
  ['iPad mini',        744, 1133],
  ['iPad Pro',        1024, 1366],
  ['laptop',          1280, 800],
  ['Chromebook',      1366, 768],
];

// name -> [sheet natural width, natural height]
const SHEETS = {
  'icon-explorer': [192, 120],
  'icon-guide':    [192, 120],
  'icon-trainer':  [192, 120],
  'icon-grass':    [128, 80],
  'icon-bonus':    [80, 16],
};

const results = [];
const check = (name, pass, detail = '') =>
  results.push({ name, pass: !!pass, detail });

(async () => {
  const browser = await chromium.launch();

  // ---------------------------------------------------------- per viewport
  for (const [label, w, h] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(target);
    await page.waitForTimeout(500);

    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const overflowing = [...document.querySelectorAll('#screen-title *')]
        .filter(e => e.getBoundingClientRect().width > de.clientWidth + 1)
        .map(e => e.tagName + (e.id ? '#' + e.id : ''));
      const input = document.getElementById('nameInput');
      const small = [
        ['#startBtn', document.getElementById('startBtn')],
        ...[...document.querySelectorAll('.avatar-btn')].map(e => ['.avatar-btn', e]),
        ...[...document.querySelectorAll('#focusPickerButtons button')].map(e => ['.focus-btn', e]),
      ].filter(([, e]) => e && (e.getBoundingClientRect().height < 44))
       .map(([n]) => n);
      return {
        hOverflow: de.scrollWidth - de.clientWidth,
        overflowing: [...new Set(overflowing)],
        px: getComputedStyle(de).getPropertyValue('--px').trim(),
        inputClipped: input ? input.scrollWidth > input.clientWidth + 1 : null,
        smallTargets: [...new Set(small)],
      };
    });

    check(`${label}: no horizontal scroll`, r.hOverflow <= 0, `${r.hOverflow}px`);
    check(`${label}: nothing wider than the screen`, r.overflowing.length === 0,
      r.overflowing.join(','));
    check(`${label}: --px is a whole number >= 2`,
      /^\d+$/.test(r.px) && +r.px >= 2, `--px=${r.px}`);
    check(`${label}: name field fits its own placeholder`, r.inputClipped === false);
    check(`${label}: tap targets are at least 44px tall`,
      r.smallTargets.length === 0, r.smallTargets.join(','));

    await page.close();
  }

  // ------------------------------------------------------------ one-offs
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(target);
  await page.waitForTimeout(600);

  // Pinch-zoom is an accessibility tool, not a layout bug to suppress.
  check('viewport meta allows zoom',
    await page.evaluate(() => {
      const c = (document.querySelector('meta[name=viewport]') || {}).content || '';
      return !/user-scalable\s*=\s*no/.test(c) && !/maximum-scale\s*=\s*1/.test(c);
    }));

  // `cursive` maps to a formal script face on iOS and Comic Sans on Windows.
  check('no font stack falls back to cursive',
    await page.evaluate(() => {
      const bad = [];
      for (const el of [document.querySelector('#screen-title h1'),
                        document.getElementById('startBtn'),
                        document.body]) {
        if (el && /cursive|fantasy/.test(getComputedStyle(el).fontFamily)) bad.push(el.tagName);
      }
      return bad.length === 0;
    }));

  // Every sprite icon must be shown at a whole-number multiple of its sheet.
  const iconReport = await page.evaluate((SHEETS) => {
    const out = [];
    for (const cls of Object.keys(SHEETS)) {
      const el = document.querySelector('.' + cls);
      if (!el) { out.push([cls, 'missing']); continue; }
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const [nw, nh] = SHEETS[cls];
      const m = cs.backgroundSize.match(/([\d.]+)px\s+([\d.]+)px/);
      if (!m) { out.push([cls, 'no background-size: ' + cs.backgroundSize]); continue; }
      const sx = parseFloat(m[1]) / nw, sy = parseFloat(m[2]) / nh;
      if (Math.abs(sx - sy) > 0.001) out.push([cls, `non-uniform scale ${sx}x${sy}`]);
      else if (Math.abs(sx - Math.round(sx)) > 0.001) out.push([cls, `fractional scale ${sx}`]);
      else if (rect.width < 1 || rect.height < 1) out.push([cls, 'zero size']);
    }
    return out;
  }, SHEETS);
  check('sprite icons use a whole-number scale of their sheet',
    iconReport.length === 0, iconReport.map(x => x.join(': ')).join(' | '));

  // Every icon has to actually occupy space, CSS-drawn ones included.
  // Scoped to the title screen: the copies inside #screen-game are legitimately
  // 0x0 while that screen is hidden.
  check('every instruction icon has a visible box',
    await page.evaluate(() => [...document.querySelectorAll('#screen-title .instruction-icon')]
      .every(e => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4; })));

  check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.close();

  // --px must actually respond to the viewport, not sit on the CSS fallback.
  const scales = [];
  for (const w of [320, 430, 1280]) {
    const p2 = await browser.newPage({ viewport: { width: w, height: 900 } });
    await p2.goto(target);
    await p2.waitForTimeout(400);
    scales.push(+(await p2.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--px').trim())));
    await p2.close();
  }
  check('--px responds to screen width',
    scales[2] > scales[0], `320px->${scales[0]}, 430px->${scales[1]}, 1280px->${scales[2]}`);

  // Reduced motion
  const rm = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await rm.emulateMedia({ reducedMotion: 'reduce' });
  await rm.goto(target);
  await rm.waitForTimeout(500);
  check('reduced motion stops the title screen animating',
    await rm.evaluate(() => [...document.querySelectorAll('#screen-title *')]
      .every(e => getComputedStyle(e).animationName === 'none')));
  await rm.close();

  await browser.close();

  const failed = results.filter(r => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? 'ok  ' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
