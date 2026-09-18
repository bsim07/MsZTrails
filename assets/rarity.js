/* ============================================================================
   Fraction Trails — adaptive Fractling rarity

   Rarity is NOT a fixed property of a Fractling. It is earned by the question:
   the ones children answer correctly settle at Common, and the one they get
   wrong most often rises to Legendary. Exactly one Legendary exists per
   session, so meeting it means something.

   How it works
   ------------
   1.  Every answer is recorded against its Fractling id, in localStorage, on
       this device — so a shared classroom iPad accumulates the whole class's
       evidence, and a 1:1 device accumulates that child's.
   2.  At the start of each session, the Fractlings chosen for that session are
       ranked by difficulty (wrong-answer rate) and the tiers are handed out
       from the top.
   3.  With no history, every score is identical and the tie-break is random —
       which is exactly the "random at first" behaviour asked for. The tiers
       sharpen as evidence accumulates.

   Load BEFORE game.js:
       <script src="assets/rarity.js"></script>
   ========================================================================= */
(function (global) {
  'use strict';

  var STORE_KEY = 'fractionTrails.difficulty.v1';

  var RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  var LABELS = {
    common: 'Common', uncommon: 'Uncommon', rare: 'Rare',
    epic: 'Epic', legendary: 'Legendary'
  };

  // A question needs this many recorded attempts before its score is trusted
  // at full weight. Below it, the prior pulls the score toward the middle, so
  // one unlucky wrong answer on day one doesn't crown a Legendary.
  var CONFIDENCE = 6;
  var PRIOR = 0.5;

  /* ------------------------------------------------------------- storage */

  function load() {
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};                       // private mode, blocked storage, etc.
    }
  }

  function save(tally) {
    try {
      global.localStorage.setItem(STORE_KEY, JSON.stringify(tally));
    } catch (e) { /* best effort — rarity still works for this session */ }
  }

  /**
   * Record one answer. Call this from handleAnswer(), handleTrainerAnswer()
   * and handleBossAnswer() — everywhere a child commits to a choice.
   *
   * `neededHint` counts as half a wrong answer: a question you can only do
   * with the hint open is harder than one you can't, and ignoring that throws
   * away the most useful signal the game collects.
   */
  function record(fractlingId, wasCorrect, neededHint) {
    var t = load();
    var k = String(fractlingId);
    var e = t[k] || { seen: 0, wrong: 0 };
    e.seen += 1;
    if (!wasCorrect) e.wrong += 1;
    else if (neededHint) e.wrong += 0.5;
    t[k] = e;
    save(t);
    return e;
  }

  /** Difficulty in [0,1]. Higher means harder. */
  function difficulty(fractlingId, tally) {
    var e = (tally || load())[String(fractlingId)];
    if (!e || !e.seen) return PRIOR;
    var observed = e.wrong / e.seen;
    var weight = Math.min(1, e.seen / CONFIDENCE);
    return observed * weight + PRIOR * (1 - weight);
  }

  /**
   * How many of each tier a session of `n` Fractlings gets.
   * Legendary is always exactly 1 — that is the point of it.
   */
  function shape(n) {
    if (n <= 0) return { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    if (n === 1) return { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 1 };
    var legendary = 1;
    var epic = n >= 12 ? 2 : 1;
    var rare = Math.max(1, Math.round(n * 0.2));
    var uncommon = Math.max(1, Math.round(n * 0.3));
    var common = n - legendary - epic - rare - uncommon;
    while (common < 0) {                       // small sessions: shed upward
      if (uncommon > 1) { uncommon -= 1; }
      else if (rare > 1) { rare -= 1; }
      else if (epic > 1) { epic -= 1; }
      else break;
      common = n - legendary - epic - rare - uncommon;
    }
    return { common: Math.max(0, common), uncommon: uncommon, rare: rare,
             epic: epic, legendary: legendary };
  }

  /**
   * Assign a rarity to each id in this session.
   * Returns { [id]: 'common' | ... | 'legendary' }.
   *
   * Ties are broken by a seeded shuffle rather than by id, so a fresh install
   * — where every score is the prior — produces a genuinely random spread
   * instead of always crowning Fractling 24.
   */
  function assign(ids, opts) {
    opts = opts || {};
    var tally = opts.tally || load();
    var seed = opts.seed == null ? Date.now() : opts.seed;
    var rnd = mulberry32(seed >>> 0);

    var scored = ids.map(function (id) {
      return { id: id, score: difficulty(id, tally), jitter: rnd() };
    });
    scored.sort(function (a, b) {
      return (b.score - a.score) || (a.jitter - b.jitter);
    });

    var counts = shape(scored.length);
    var order = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
    var out = {};
    var i = 0;
    order.forEach(function (tier) {
      for (var k = 0; k < counts[tier] && i < scored.length; k++, i++) {
        out[scored[i].id] = tier;
      }
    });
    while (i < scored.length) { out[scored[i].id] = 'common'; i++; }
    return out;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /** Row index into fractlings.png for a rarity key. */
  function index(rarityKey) {
    var i = RARITIES.indexOf(rarityKey);
    return i < 0 ? 0 : i;
  }

  /** A line for the teacher export, so class evidence can be pooled. */
  function summary(fractlings) {
    var tally = load();
    return Object.keys(tally).map(function (id) {
      var e = tally[id];
      var f = (fractlings || []).find(function (x) { return String(x.id) === id; });
      return {
        id: Number(id),
        name: f ? f.name : ('#' + id),
        attempts: e.seen,
        missed: e.wrong,
        difficulty: Math.round(difficulty(id, tally) * 100) / 100
      };
    }).sort(function (a, b) { return b.difficulty - a.difficulty; });
  }

  function reset() { save({}); }

  /* ---------------------------------------------------- this session's map */
  // utils.js builds the creature element but lives outside game.js's closure,
  // so the session's assignment is parked here rather than threaded through
  // six call sites.
  var sessionMap = {};
  function setSession(map) { sessionMap = map || {}; }
  function of(id) { return sessionMap[id] || 'common'; }

  global.Rarity = {
    RARITIES: RARITIES,
    LABELS: LABELS,
    record: record,
    difficulty: difficulty,
    assign: assign,
    index: index,
    shape: shape,
    summary: summary,
    reset: reset,
    setSession: setSession,
    of: of,
    _load: load
  };
})(window);
