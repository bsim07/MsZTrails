/* Question generator and option shuffler.
   data.js keeps one hand-written question per entry: it supplies the Fractling, tag and
   colours, and is the fallback if a generator ever fails. Every entry named in GENERATORS
   gets fresh numbers each time build() is called, and the answer options are always shuffled. */
(function(global){
  'use strict';

  let rnd = Math.random;
  const NAMES = ['Mia','Ravi','Aisha','Ben','Zara','Leo','Mei','Raj','Sam','Farah','Dev','Nina','Omar','Priya','Kai','Lena'];
  const GUESS = "I wasn't fully sure, so I made my best guess.";

  const range = (lo, hi)=>{ const a = []; for(let i = lo; i <= hi; i++) a.push(i); return a; };
  const int = (lo, hi)=> lo + Math.floor(rnd() * (hi - lo + 1));
  const pick = arr=> arr[Math.floor(rnd() * arr.length)];
  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i--){
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const sample = (arr, k)=> shuffle(arr).slice(0, k);
  const gcd = (a, b)=> b ? gcd(b, a % b) : a;
  const lcm = (a, b)=> a / gcd(a, b) * b;
  const F = (n, d)=> ({n, d});
  const fs = f=> f.n + '/' + f.d;
  const same = (a, b)=> a.n * b.d === b.n * a.d;

  // Three wrong fractions, none equal in value to the answer or to each other.
  function fracOptions(c, cands){
    const kept = [c], out = [];
    const add = f=>{
      if(f.n < 1 || f.d < 1 || kept.some(k=> same(k, f))) return;
      kept.push(f);
      out.push(fs(f));
    };
    shuffle(cands).forEach(f=>{ if(out.length < 3) add(f); });
    for(let t = 0; out.length < 3 && t < 500; t++) add(F(int(1, c.d + 2), c.d + int(0, 2)));
    return out;
  }

  // Three wrong whole numbers, all positive and different from the answer and each other.
  function intOptions(ans, cands, fmt){
    fmt = fmt || String;
    const kept = [ans], out = [];
    const add = x=>{
      if(!(x >= 1) || kept.includes(x)) return;
      kept.push(x);
      out.push(fmt(x));
    };
    shuffle(cands).forEach(x=>{ if(out.length < 3) add(x); });
    for(let t = 0; out.length < 3 && t < 500; t++) add(rnd() < 0.5 ? ans + int(1, 5) : ans - int(1, 5));
    return out;
  }

  // Replace individual reflection strategies that mention specific numbers or objects.
  function strat(entry, patch){
    if(!entry.strategies) return undefined;
    const s = entry.strategies.slice();
    Object.keys(patch).forEach(i=>{ s[i] = patch[i]; });
    return s;
  }

  /* ---------- Fractling-style generators ---------- */

  function shadingShape(){
    const n = int(2, 10), k = int(1, n - 1), c = F(k, n);
    return {
      question: `This shape is split into ${n} equal parts and ${k} of them ${k === 1 ? 'is' : 'are'} shaded. What fraction is shaded?`,
      options: [fs(c), ...fracOptions(c, [F(n, k), F(n - k, n), F(k, n + 1), F(k, n - k)])],
      hint: 'Count how many equal parts make up the WHOLE shape, then count how many are shaded.',
      explain: `The whole is cut into ${n} equal parts (denominator = ${n}). ${k} ${k === 1 ? 'part is' : 'parts are'} shaded (numerator = ${k}). So the fraction shaded is <b>${fs(c)}</b>.`,
      num: k, den: n
    };
  }

  function shadingStory(entry){
    const FOODS = [['pizza', 'slices'], ['cake', 'slices'], ['pie', 'slices'], ['chocolate bar', 'pieces'], ['watermelon', 'slices']];
    const [food, piece] = pick(FOODS);
    const who = pick(NAMES);
    const n = int(3, 10), k = int(1, n - 1), c = F(k, n);
    return {
      question: `A ${food} is cut into ${n} equal ${piece}. ${who} eats ${k} ${k === 1 ? piece.slice(0, -1) : piece}. What fraction of the ${food} did ${who} eat?`,
      options: [fs(c), ...fracOptions(c, [F(n, k), F(n - k, n), F(k, n + 1), F(k, n - k)])],
      hint: `The denominator is the total number of equal ${piece}. The numerator is how many ${who} ate.`,
      explain: `Total equal ${piece} = denominator = ${n}. Number ${who} ate = numerator = ${k}. So ${who} ate <b>${fs(c)}</b> of the ${food}.`,
      strategies: strat(entry, {
        0: `I used total ${piece} as the denominator and ${piece} eaten as the numerator.`,
        1: `I pictured the ${food} cut into ${piece}, like a real ${food}.`
      }),
      num: k, den: n
    };
  }

  function compare(){
    const n = int(4, 12);
    const [a, b] = sample(range(1, n - 1), 2);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    const greater = rnd() < 0.6;
    const c = F(greater ? hi : lo, n);
    const other = F(greater ? lo : hi, n);
    return {
      question: `Which fraction is ${greater ? 'greater' : 'smaller'}: ${a}/${n} or ${b}/${n}?`,
      options: [fs(c), fs(other), 'They are equal', 'Cannot tell'],
      hint: 'When the denominators are the SAME, just compare the numerators (top numbers).',
      explain: greater
        ? `Both fractions are out of ${n} equal parts, so compare the numerators: ${hi} is greater than ${lo}. That means <b>${hi}/${n} &gt; ${lo}/${n}</b> — more equal parts are being taken.`
        : `Both fractions are out of ${n} equal parts, so compare the numerators: ${lo} is smaller than ${hi}. That means <b>${lo}/${n} &lt; ${hi}/${n}</b> — fewer equal parts are being taken.`,
      num: c.n, den: n
    };
  }

  // `showList` prints the fractions in the question; otherwise the options are the lists.
  function ordering(count, nLo, nHi, showList){
    return function(){
      const n = int(nLo, nHi);
      const nums = sample(range(1, n - 1), count);
      const asc = rnd() < 0.5;
      const sorted = nums.slice().sort((x, y)=> asc ? x - y : y - x);
      const list = arr=> arr.map(x=> x + '/' + n).join(', ');
      const correct = list(sorted);
      const wrong = [list(sorted.slice().reverse())];
      for(let t = 0; wrong.length < 3 && t < 500; t++){
        const p = list(shuffle(sorted));
        if(p !== correct && !wrong.includes(p)) wrong.push(p);
      }
      const dir = asc ? 'SMALLEST to LARGEST' : 'LARGEST to SMALLEST';
      let question;
      if(showList){
        let shown = shuffle(nums);
        for(let t = 0; shown.join() === sorted.join() && t < 50; t++) shown = shuffle(nums);
        question = `Arrange these from ${dir}: ${list(shown)}`;
      } else {
        question = `Which list is correctly ordered from ${dir}?`;
      }
      return {
        question,
        options: [correct, ...wrong],
        hint: `Same denominator (${n}) for all — just order the numerators (the top numbers) from ${asc ? 'smallest to largest' : 'biggest to smallest'}.`,
        explain: `All the fractions share the same denominator, ${n}, so we only need to order the numerators from ${asc ? 'smallest to largest' : 'biggest to smallest'}: ${sorted.join(asc ? ' &lt; ' : ' &gt; ')}. That gives us <b>${correct}</b>.`
      };
    };
  }

  function addition(){
    const n = int(5, 12), a = int(1, n - 2), b = int(1, n - 1 - a), s = a + b, c = F(s, n);
    return {
      question: `${a}/${n} + ${b}/${n} = ?`,
      options: [fs(c), ...fracOptions(c, [F(s, 2 * n), F(s + 1, n), F(s - 1, n), F(Math.abs(a - b), n), F(s, n + 1)])],
      hint: 'Same denominator? Add the numerators only, and keep the denominator the same.',
      explain: `Both fractions are out of ${n}, so add just the numerators: ${a} + ${b} = ${s}. The denominator stays the same. So ${a}/${n} + ${b}/${n} = <b>${fs(c)}</b>.`,
      num: s, den: n
    };
  }

  function subtraction(entry){
    const n = int(5, 12), a = int(2, n - 1), b = int(1, a - 1), r = a - b, c = F(r, n);
    return {
      question: `${a}/${n} − ${b}/${n} = ?`,
      options: [fs(c), ...fracOptions(c, [F(a + b, n), F(r, 2 * n), F(r + 1, n), F(r - 1, n), F(b, n), F(r, n + 1)])],
      hint: 'Same denominator — subtract the numerators only, and keep the denominator the same.',
      explain: `Both fractions are out of ${n}, so subtract the numerators: ${a} − ${b} = ${r}. The denominator stays the same. So ${a}/${n} − ${b}/${n} = <b>${fs(c)}</b>.`,
      strategies: strat(entry, {2: `I counted backwards from ${a} to check the difference.`}),
      num: r, den: n
    };
  }

  const WORD_ADD = [
    {whole: 'cake', pic: 'I drew a picture of the cake being shared to help me.',
      q: (A, B, a, b, n)=> `${A} ate ${a}/${n} of a cake. ${B} ate ${b}/${n} of the same cake. What fraction of the cake did they eat altogether?`},
    {whole: 'book', pic: 'I drew a picture of the book being read bit by bit.',
      q: (A, B, a, b, n)=> `${A} read ${a}/${n} of a book on Monday and ${b}/${n} more on Tuesday. What fraction of the book has ${A} read in total?`},
    {whole: 'bottle', pic: 'I drew a picture of the bottle being drunk in two parts.',
      q: (A, B, a, b, n)=> `${A} drank ${a}/${n} of a bottle in the morning and ${b}/${n} more in the afternoon. What fraction of the bottle has ${A} drunk altogether?`},
    {whole: 'fence', pic: 'I drew a picture of the fence being painted in two parts.',
      q: (A, B, a, b, n)=> `${A} painted ${a}/${n} of a fence on Saturday and ${b}/${n} more on Sunday. What fraction of the fence is painted altogether?`}
  ];

  function wordAdd(entry){
    const t = pick(WORD_ADD);
    const [A, B] = sample(NAMES, 2);
    const n = int(5, 12), a = int(1, n - 2), b = int(1, n - 1 - a), s = a + b, c = F(s, n);
    return {
      question: t.q(A, B, a, b, n),
      options: [fs(c), ...fracOptions(c, [F(s, 2 * n), F(s + 1, n), F(s - 1, n), F(Math.abs(a - b), n), F(s, n + 1)])],
      hint: `Both fractions are parts of the SAME ${t.whole} (same denominator, ${n}) — add the numerators.`,
      explain: `Both amounts are parts of the same ${t.whole}, cut into ${n} equal parts. Add the numerators: ${a} + ${b} = ${s}. So altogether it is <b>${fs(c)}</b> of the ${t.whole}.`,
      strategies: strat(entry, {1: t.pic}),
      num: s, den: n
    };
  }

  const SET_ITEMS = [['sweets', 'red'], ['stickers', 'gold'], ['marbles', 'blue'], ['pencils', 'red'],
    ['coins', 'silver'], ['cards', 'yellow'], ['stamps', 'green'], ['buttons', 'blue']];

  function setUnit(entry){
    const [items, colour] = pick(SET_ITEMS);
    const d = pick([2, 3, 4, 5, 6, 8, 10]);
    const q = int(2, Math.min(9, Math.floor(60 / d)));
    const N = d * q;
    return {
      question: `${pick(['There are', 'A box has'])} ${N} ${items}. 1/${d} of them are ${colour}. How many ${items} are ${colour}?`,
      options: [String(q), ...intOptions(q, [d, N, N - q, q + 1, q - 1, 2 * q])],
      hint: `Split the ${N} ${items} into ${d} equal groups first, then take just 1 group.`,
      explain: `1/${d} of ${N} means dividing ${N} into ${d} equal groups: ${N} ÷ ${d} = ${q} ${items} per group. Taking 1 group gives <b>${q}</b> ${colour} ${items}.`,
      strategies: strat(entry, {
        1: `I drew or grouped the ${items} into ${d} piles to help me count.`,
        2: `I used a division fact I already knew (${N} ÷ ${d}).`
      }),
      num: 1, den: d
    };
  }

  // far = ask for the fraction FURTHEST from a whole; plain = list after a question mark.
  function nearWhole(far, plain){
    return function(){
      const n = int(5, 12);
      const nums = sample(range(1, n - 1), 4);
      const best = far ? Math.min(...nums) : Math.max(...nums);
      const fr = nums.map(x=> x + '/' + n);
      const list = plain ? fr.join(', ') : fr.slice(0, 3).join(', ') + ', or ' + fr[3];
      return {
        question: plain
          ? `Which fraction is closest to 1 whole? ${list}`
          : `Which fraction is ${far ? 'FURTHEST from' : 'closest to'} 1 whole: ${list}?`,
        options: [best + '/' + n, ...nums.filter(x=> x !== best).map(x=> x + '/' + n)],
        hint: far
          ? `Same denominator — the fraction with the SMALLEST numerator is furthest from the whole (${n}/${n} = 1).`
          : `Same denominator — the fraction with the BIGGEST numerator is closest to the whole (${n}/${n} = 1).`,
        explain: far
          ? `All are out of ${n}. The smaller the numerator, the further from a whole (${n}/${n}). ${best} is the smallest numerator here, so <b>${best}/${n}</b> is furthest away.`
          : `All are out of ${n}. The bigger the numerator, the closer the fraction is to ${n}/${n} (a whole). ${best} is the biggest numerator here, so <b>${best}/${n}</b> is closest to 1.`,
        num: best, den: n
      };
    };
  }

  function vocab(entry){
    const b = int(3, 12), a = int(1, b - 1);
    if(rnd() < 0.6){
      return {
        question: `In the fraction ${a}/${b}, what does the ${b} represent?`,
        options: ['Total equal parts the whole is divided into', 'Number of parts shaded', 'Number of parts NOT shaded', 'The value of the fraction'],
        hint: "The bottom number is called the denominator. Think about what 'equal parts' means.",
        explain: `The bottom number (denominator) shows how many equal parts make up the WHOLE. The top number (numerator) shows how many of those parts we are looking at. So ${b} is the <b>total equal parts</b>.`,
        num: a, den: b
      };
    }
    return {
      question: `In the fraction ${a}/${b}, what does the ${a} represent?`,
      options: ['Number of equal parts being counted', 'Total equal parts the whole is divided into', 'Number of parts NOT counted', 'The value of the fraction'],
      hint: 'The top number is called the numerator. Think about how many parts we are looking at.',
      explain: `The top number (numerator) shows how many of the equal parts we are looking at. The bottom number (denominator) shows how many equal parts make up the WHOLE. So ${a} is the <b>number of parts being counted</b>.`,
      strategies: strat(entry, {0: "I recalled what the word 'numerator' means."}),
      num: a, den: b
    };
  }

  function benchmark(){
    const b = pick([4, 6, 8, 10, 12]), a = int(1, b - 1), half = b / 2;
    const rel = a < half ? 'less' : a > half ? 'more' : 'exact';
    const label = {less: 'Less than 1/2', more: 'More than 1/2', exact: 'Exactly 1/2'};
    const word = {less: 'less than', more: 'more than', exact: 'exactly equal to'};
    return {
      question: `Is ${a}/${b} more than, less than, or exactly 1/2?`,
      options: [label[rel], ...Object.keys(label).filter(k=> k !== rel).map(k=> label[k]), 'Cannot tell'],
      hint: `Half of ${b} is ${half}. Is the numerator (${a}) more or less than ${half}?`,
      explain: `Half of the denominator ${b} is ${half}, so ${half}/${b} would equal 1/2. The numerator ${a} is ${word[rel]} ${half}, so <b>${a}/${b} is ${rel === 'exact' ? 'exactly' : word[rel]} 1/2</b>.`,
      num: a, den: b
    };
  }

  function oneWhole(){
    const n = int(4, 12);
    return {
      question: 'Which of these fractions is equal to ONE WHOLE?',
      options: [n + '/' + n, ...sample(range(1, n - 1), 3).map(x=> x + '/' + n)],
      hint: 'A fraction equals one whole when the numerator and denominator are the SAME number.',
      explain: `When the numerator equals the denominator, every equal part is included — that's the whole thing! So <b>${n}/${n}</b> equals 1 whole.`,
      num: n, den: n
    };
  }

  function tankToFull(){
    const [cont, liquid] = pick([['tank', 'water'], ['jug', 'juice'], ['bucket', 'water']]);
    const who = pick(['Dad', 'Mum', 'Grandma', 'Uncle Sam']);
    const n = int(5, 12), a = int(1, n - 1), r = n - a, c = F(r, n);
    return {
      question: `A ${cont} is ${a}/${n} full. ${who} adds ${liquid} so it becomes completely full. What fraction of ${liquid} did ${who} add?`,
      options: [fs(c), ...fracOptions(c, [F(a, n), F(n, n), F(r + 1, n), F(r - 1, n)])],
      hint: `The ${cont} started at ${a}/${n}. Think about how much MORE is needed to reach ${n}/${n}.`,
      explain: `A full ${cont} is ${n}/${n}. It started at ${a}/${n}, so ${who} needed to add ${n}/${n} − ${a}/${n} = <b>${fs(c)}</b> to fill it.`,
      num: r, den: n
    };
  }

  /* ---------- Rival Trainer and Boss generators ---------- */

  const LEFTOVER = [
    {thing: 'cake', q: (n, a, b)=> `${pick(['Mrs Tan', 'Mrs Lee', 'Mrs Lim', 'Mrs Ng'])} cut a cake into ${n} equal pieces. She gave ${a}/${n} to her neighbour and ${b}/${n} to her sister. What fraction of the cake is LEFT?`},
    {thing: 'bottle', q: (n, a, b)=> { const A = pick(NAMES); return `${A} drank ${a}/${n} of a bottle of juice in the morning and ${b}/${n} more in the afternoon. What fraction of the juice has ${A} NOT drunk?`; }},
    {thing: 'ribbon', q: (n, a, b)=> { const A = pick(NAMES); return `${A}'s ribbon is cut into ${n} equal parts. ${A} uses ${a}/${n} for a bow and ${b}/${n} for a bookmark. What fraction of the ribbon is UNUSED?`; }}
  ];

  function leftover(i){
    return function(){
      const t = LEFTOVER[i];
      const n = int(6, 12), a = int(1, n - 3), b = int(1, n - 1 - a), s = a + b, r = n - s, c = F(r, n);
      return {
        question: t.q(n, a, b),
        options: [fs(c), ...fracOptions(c, [F(s, n), F(n, n), F(r + 1, n), F(r - 1, n), F(n - a, n), F(n - b, n)])],
        explain: `In total that is ${a}/${n} + ${b}/${n} = ${s}/${n}. The whole ${t.thing} is ${n}/${n}, so what's left is ${n}/${n} − ${s}/${n} = <b>${fs(c)}</b>.`,
        num: r, den: n
      };
    };
  }

  function threeParts(){
    const n = int(10, 16);
    let a, b, c;
    do { a = int(1, 6); b = int(1, 6); c = int(1, 6); } while(a + b + c > n - 1);
    const [A, B, C] = sample(NAMES, 3);
    const s = a + b + c, r = n - s, ans = F(r, n);
    return {
      question: `A cake is cut into ${n} equal slices. ${A} eats ${a}/${n}, ${B} eats ${b}/${n}, and ${C} eats ${c}/${n}. What fraction of the cake is LEFT?`,
      options: [fs(ans), ...fracOptions(ans, [F(s, n), F(n, n), F(r + 1, n), F(r - 1, n)])],
      explain: `Together they ate ${a}/${n} + ${b}/${n} + ${c}/${n} = ${s}/${n}. The whole cake is ${n}/${n}, so what's left is ${n}/${n} − ${s}/${n} = <b>${fs(ans)}</b>.`,
      num: r, den: n
    };
  }

  function equivalentOf(){
    const q = pick([2, 3, 4, 5]);
    const p = pick(range(1, q - 1).filter(x=> gcd(x, q) === 1));
    const m = int(2, 4), c = F(p * m, q * m);
    return {
      question: `Which fraction is equivalent to ${p}/${q}?`,
      options: [fs(c), ...fracOptions(c, [F(p + 1, q + 1), F(p * m, q * m + 1), F(p * m + 1, q * m), F(p + m, q + m), F(p, q * m)])],
      explain: `Multiply the numerator and the denominator by the same number: ${p} × ${m} = ${p * m} and ${q} × ${m} = ${q * m}. So <b>${fs(c)} = ${p}/${q}</b>.`,
      num: c.n, den: c.d
    };
  }

  function equalPair(){
    const q = pick([2, 3, 4, 5]);
    const p = pick(range(1, q - 1).filter(x=> gcd(x, q) === 1));
    const m = int(2, 3);
    const base = F(p, q), mult = F(p * m, q * m);
    const pairs = [
      [base, F(p, q + 1)], [F(p + 1, q + 1), base], [F(p * m, q * m + 1), base], [F(p * m + 1, q * m), base],
      [mult, F(p, q + 1)], [mult, F(p + 1, q)], [mult, F(p, q * m + 1)]
    ].filter(pr=> !same(pr[0], pr[1]));
    const text = pr=> { const [x, y] = rnd() < 0.5 ? pr : [pr[1], pr[0]]; return `${fs(x)} and ${fs(y)}`; };
    const correct = text([mult, base]);
    const wrong = [];
    shuffle(pairs).forEach(pr=>{
      const t = text(pr);
      if(wrong.length < 3 && t !== correct && !wrong.includes(t)) wrong.push(t);
    });
    return {
      question: 'Which pair of fractions are equal in value?',
      options: [correct, ...wrong],
      explain: `${q} × ${m} = ${q * m} and ${p} × ${m} = ${p * m}, so <b>${fs(mult)} = ${fs(base)}</b> — they name the same amount, just cut into a different number of equal parts.`,
      num: base.n, den: base.d
    };
  }

  function ribbonCut(){
    const A = pick(NAMES);
    const d = pick([2, 3, 4, 5]), q = int(2, 8), L = d * q, r = L - q;
    return {
      question: `A ribbon is ${L}m long. ${A} cuts off 1/${d} of it to make a bow. How many metres are LEFT?`,
      options: [r + 'm', ...intOptions(r, [q, L, L - d, r + 1, r - 1], x=> x + 'm')],
      explain: `1/${d} of ${L}m is ${L} ÷ ${d} = ${q}m cut off. What's left is ${L}m − ${q}m = <b>${r}m</b>.`,
      num: 1, den: d
    };
  }

  function notWhole(){
    const b = int(3, 12), a = int(1, b - 1);
    const wholes = sample(range(2, 12), 3).map(x=> x + '/' + x);
    return {
      question: 'Which of these fractions is NOT equal to one whole?',
      options: [a + '/' + b, ...wholes],
      explain: `A fraction equals a whole only when the numerator equals the denominator. In ${a}/${b}, ${a} ≠ ${b}, so it is <b>not</b> a whole.`,
      num: a, den: b
    };
  }

  // not-unit fraction of a set, then the rest: "how many are NOT ...?"
  function setRest(entryKind){
    return function(){
      const d = pick([4, 5, 6, 8, 10]), a = int(2, d - 1);
      const q = int(2, Math.min(8, Math.floor(60 / d)));
      const N = d * q, part = a * q, ans = N - part;
      let question, explain;
      if(entryKind === 'pack'){
        const [items, colour] = pick([['sweets', 'chocolate'], ['marbles', 'red'], ['stickers', 'gold'], ['pencils', 'blue'], ['buttons', 'green']]);
        question = `A pack has ${N} ${items}. ${a}/${d} of them are ${colour}. How many ${items} are NOT ${colour}?`;
        explain = `${a}/${d} of ${N} is (${N} ÷ ${d}) × ${a} = ${part} ${colour} ${items}. The rest are ${N} − ${part} = <b>${ans}</b> ${items} that are not ${colour}.`;
      } else {
        const [place, items, first, second] = pick([['A shop', 'sweets', 'lollipops', 'chocolates'], ['A basket', 'fruits', 'apples', 'oranges'],
          ['A tray', 'biscuits', 'cookies', 'crackers'], ['A garden', 'flowers', 'roses', 'tulips']]);
        question = `${place} has ${N} ${items}. ${a}/${d} of them are ${first}. The rest are ${second}. How many are ${second}?`;
        explain = `${a}/${d} of ${N} is (${N} ÷ ${d}) × ${a} = ${part} ${first}. The rest are ${second}: ${N} − ${part} = <b>${ans}</b>.`;
      }
      return {
        question,
        options: [String(ans), ...intOptions(ans, [part, q, N - q, N, ans + q, ans - q])],
        explain,
        num: a, den: d
      };
    };
  }

  function gapFinder(){
    const q = pick([2, 3, 4, 5]), p = int(1, q - 1), m = int(2, 4), r = q * m, ans = p * m;
    return {
      question: `${p}/${q} is equivalent to ?/${r}. What is the missing numerator?`,
      options: [String(ans), ...intOptions(ans, [p, q, r, p + (r - q), ans + 1, ans - 1])],
      explain: `To turn ${q}ths into ${r}ths, the denominator is multiplied by ${m} (${q} → ${r}), so the numerator is multiplied by ${m} too: ${p} × ${m} = <b>${ans}</b>. So ${p}/${q} = ${ans}/${r}.`,
      num: p, den: q
    };
  }

  function ribbonRelay(){
    const [a, b] = sample([2, 3, 4, 6], 2);
    const l = lcm(a, b);
    const L = pick(range(1, Math.floor(60 / l)).map(k=> k * l).filter(x=> x >= 12));
    const who = pick(['Mrs Lee', 'Mr Ong', 'Mrs Tan', 'Mr Raj']);
    const bow = L / a, badge = L / b, used = bow + badge, left = L - used;
    return {
      question: `A ribbon is ${L}m long. ${who} cuts 1/${a} of it for a bow, then cuts 1/${b} of the ORIGINAL ribbon for a badge. How many metres of ribbon are left?`,
      options: [left + 'm', ...intOptions(left, [used, L - bow, L - badge, L, bow, badge], x=> x + 'm')],
      explain: `1/${a} of ${L}m = ${bow}m for the bow. 1/${b} of ${L}m = ${badge}m for the badge. Together that's ${bow}m + ${badge}m = ${used}m used, so what's left is ${L}m − ${used}m = <b>${left}m</b>.`,
      num: 1, den: a
    };
  }

  function twoTanks(){
    const n = int(5, 12), b = int(1, n - 2), a = int(b + 1, n - 1), c = F(a - b, n);
    return {
      question: `Tank A is ${a}/${n} full. Tank B is ${b}/${n} full. How much MORE full is Tank A than Tank B?`,
      options: [fs(c), ...fracOptions(c, [F(a, n), F(b, n), F(a + b, n), F(n, n), F(a - b, 2 * n)])],
      explain: `Both tanks are measured out of the same ${n} equal parts, so subtract the numerators: ${a} − ${b} = ${a - b}. Tank A is <b>${fs(c)}</b> more full than Tank B.`,
      num: a - b, den: n
    };
  }

  function tripSharing(){
    const [a, b] = sample([2, 3, 4, 5, 6], 2).sort((x, y)=> x - y);
    const l = lcm(a, b);
    const N = pick(range(1, Math.floor(60 / l)).map(k=> k * l).filter(x=> x >= 12));
    const umbrellas = N / a, coats = N / b, diff = umbrellas - coats;
    return {
      question: `${N} students went on a trip. 1/${a} of them brought umbrellas and 1/${b} of them brought raincoats. How many MORE students brought umbrellas than raincoats?`,
      options: [String(diff), ...intOptions(diff, [umbrellas, coats, umbrellas + coats, diff + 1, diff - 1])],
      explain: `1/${a} of ${N} = ${umbrellas} umbrellas. 1/${b} of ${N} = ${coats} raincoats. The difference is ${umbrellas} − ${coats} = <b>${diff}</b> more students with umbrellas.`,
      num: 1, den: a
    };
  }

  function fullCircle(){
    const who = pick(NAMES);
    const n = int(6, 12), a = int(1, n - 1), r = n - a, c = F(r, n);
    return {
      question: `A pizza is cut into ${n} equal slices. ${who} eats some slices, leaving ${a}/${n} of the pizza. What fraction of the pizza did ${who} eat?`,
      options: [fs(c), ...fracOptions(c, [F(a, n), F(n, n), F(r + 1, n), F(r - 1, n)])],
      explain: `The whole pizza is ${n}/${n}. If ${a}/${n} is left, ${who} ate ${n}/${n} − ${a}/${n} = <b>${fs(c)}</b> of the pizza.`,
      num: r, den: n
    };
  }

  function mixedBag(){
    const [a, b] = sample([2, 3, 4, 5], 2);
    const l = lcm(a, b);
    const N = pick(range(1, Math.floor(60 / l)).map(k=> k * l).filter(x=> x >= 20));
    const [c1, c2, c3] = pick([['red', 'blue', 'green'], ['yellow', 'purple', 'orange']]);
    const first = N / a, second = N / b, used = first + second, left = N - used;
    return {
      question: `A bag has ${N} marbles: 1/${a} are ${c1}, 1/${b} are ${c2}, and the rest are ${c3}. How many marbles are ${c3}?`,
      options: [String(left), ...intOptions(left, [used, N - first, N - second, first, second])],
      explain: `1/${a} of ${N} = ${first} ${c1}. 1/${b} of ${N} = ${second} ${c2}. Together that's ${first} + ${second} = ${used} marbles, so the rest are ${c3}: ${N} − ${used} = <b>${left}</b>.`,
      num: 1, den: a
    };
  }

  const GENERATORS = {
    // Wild Fractlings
    Halvo: shadingShape, Triqua: shadingStory, Quadrin: compare,
    Ordelle: ordering(3, 5, 12, true), Lineup: ordering(3, 5, 12, true),
    Addix: addition, Sumora: addition, Plusix: addition, Combino: addition,
    Subtra: subtraction, Subtrix: subtraction, Minuso: subtraction, Takeway: subtraction,
    Wordlet: wordAdd, Addelle: wordAdd, Storyfrac: wordAdd,
    Setto: setUnit, Groupzy: setUnit, Sharemint: setUnit, Piecewise: setUnit,
    Nearone: nearWhole(false, true), Partly: vocab, Halfmark: benchmark,
    Wholesome: oneWhole, Talebit: tankToFull,
    // Rival Trainers
    'Cake Split': leftover(0), 'Equal Match': equivalentOf, 'Ribbon Cut': ribbonCut,
    'Whole Check': notWhole, 'Juice Box': leftover(1), 'Order Check': ordering(3, 8, 12, false),
    'Sweet Count': setRest('pack'), 'Closest Call': nearWhole(false, false),
    'Ribbon Leftover': leftover(2), 'Equal Pair': equalPair,
    // Boss Battle
    'Slice Trio': threeParts, 'Four in a Row': ordering(4, 8, 12, true), 'Shop Split': setRest('shop'),
    'Gap Finder': gapFinder, 'Ribbon Relay': ribbonRelay, 'Furthest Out': nearWhole(true, false),
    'Two Tanks': twoTanks, 'Trip Sharing': tripSharing, 'Full Circle': fullCircle, 'Mixed Bag': mixedBag
  };

  function valid(g){
    return !!g && typeof g.question === 'string' && g.question.length > 0 &&
      Array.isArray(g.options) && g.options.length >= 2 &&
      g.options.every(o=> typeof o === 'string' && o.length > 0) &&
      new Set(g.options).size === g.options.length;
  }

  function shuffleOptions(q){
    const answer = q.options[q.correct];
    const options = shuffle(q.options);
    return Object.assign({}, q, {options, correct: options.indexOf(answer)});
  }

  // Returns a new question object shaped like a data.js entry; the entry itself is never changed.
  function build(entry){
    let g = null;
    const gen = GENERATORS[entry.name];
    if(gen){
      try { g = gen(entry); } catch(e){ g = null; }
      if(!valid(g)) g = null;
    }
    const q = Object.assign({}, entry);
    if(g){
      q.question = g.question;
      q.options = g.options;
      q.correct = 0;
      if(g.hint !== undefined) q.hint = g.hint;
      if(g.explain !== undefined) q.explain = g.explain;
      if(g.strategies) q.strategies = g.strategies;
      if(g.num !== undefined){ q.num = g.num; q.den = g.den; }
    }
    const out = shuffleOptions(q);
    out.generated = !!g;
    return out;
  }

  global.QuestionBank = {
    build, shuffleOptions,
    hasGenerator: name=> Object.prototype.hasOwnProperty.call(GENERATORS, name),
    setRandom: fn=> { rnd = fn || Math.random; }
  };
})(window);
