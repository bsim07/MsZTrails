/* ============================================================================
   Fraction Trails — the one owner of --px

   Pixel art only stays crisp on whole pixels, so every size in sprites.css is
   calc(<source pixels> * var(--px)). This file is the single place --px is
   written.

   Before this existed, --px was set only inside initMap(), which meant the
   title screen never got one and sat on the CSS fallback of 3 forever: avatar
   cards 144px wide on a 320px phone, and the same 144px on a 1280px laptop.

   Load it BEFORE data.js:
       <script src="assets/pixel-scale.js"></script>
   ========================================================================= */
(function (global) {
  'use strict';

  var TILE = 16, VIEW_COLS = 10, VIEW_ROWS = 7;
  var CARD = 48;                 // avatar card, source pixels
  var MIN = 2, MAX = 6, TITLE_MAX = 3;

  function gameVisible() {
    var g = document.getElementById('screen-game');
    return g && !g.classList.contains('hidden');
  }

  function compute() {
    var vw = document.documentElement.clientWidth;
    var vh = global.innerHeight || document.documentElement.clientHeight;
    var px;

    if (gameVisible()) {
      var wrap = document.getElementById('mapWrap');
      var avail = (wrap ? wrap.clientWidth : vw) - 28;      // #mapWrap padding
      px = Math.min(
        Math.floor(avail / (TILE * VIEW_COLS)),
        Math.floor((vh * 0.46) / (TILE * VIEW_ROWS))        // leave room for the d-pad
      );
      px = Math.max(MIN, Math.min(MAX, px || MIN));
    } else {
      // Title screen. The avatar cards are the largest fixed-size art, and two
      // of them plus the gap have to fit the panel with room to breathe.
      var panel = Math.min(vw, 620) - 72;
      px = Math.floor(panel / (CARD * 2 + 24));
      px = Math.max(MIN, Math.min(TITLE_MAX, px || MIN));
    }

    document.documentElement.style.setProperty('--px', px);
    return px;
  }

  global.setPixelScale = compute;
  global.addEventListener('resize', compute);
  global.addEventListener('orientationchange', compute);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', compute);
  } else {
    compute();
  }
  compute();
})(window);
