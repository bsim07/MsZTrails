/* Checks every generated question against an independent solver, so a wrong answer key
 * or a duplicate-looking option can never reach students.
 * Loads data.js and questions.js in a sandbox: no browser needed.
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sandbox = {console, Math};
sandbox.window = sandbox;
vm.createContext(sandbox);
for(const file of ['data.js', 'questions.js']){
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, {filename: file});
}
const read = name=> vm.runInContext(name, sandbox);
const FRACTLINGS = read('FRACTLINGS'), TRAINER_POOL = read('TRAINER_POOL'), BOSS_POOL = read('BOSS_POOL');
const QB = sandbox.QuestionBank;

function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const fr = text=> [...text.matchAll(/(\d+)\/(\d+)/g)].map(m=> ({n: +m[1], d: +m[2]}));
const num = (re, text)=> +text.match(re)[1];
const value = s=> { const [n, d] = s.split('/').map(Number); return {n, d}; };
const sameValue = (a, b)=> a.n * b.d === b.n * a.d;
const exactlyOne = (list, test, label)=> {
  const hits = list.filter(test);
  assert.equal(hits.length, 1, label + ': expected exactly one matching option, got ' + hits.length);
  return hits[0];
};

function ordered(q){
  const asc = /SMALLEST to LARGEST/.test(q.question);
  const f = fr(q.question);
  return f.map(x=> x.n).sort((a, b)=> asc ? a - b : b - a).map(x=> x + '/' + f[0].d).join(', ');
}
function sum2(q){ const f = fr(q.question); return (f[0].n + f[1].n) + '/' + f[0].d; }
function diff2(q){ const f = fr(q.question); return (f[0].n - f[1].n) + '/' + f[0].d; }
function leftover(q){ const f = fr(q.question); return (f[0].d - f[0].n - f[1].n) + '/' + f[0].d; }
function ofSet(q){ const N = num(/(?:are|has) (\d+) /, q.question); const f = fr(q.question)[0]; return String(N / f.d); }
function restOfSet(q){ const N = num(/has (\d+) /, q.question); const f = fr(q.question)[0]; return String(N - f.n * N / f.d); }
function closest(q){ const f = fr(q.question); return Math.max(...f.map(x=> x.n)) + '/' + f[0].d; }
function furthest(q){ const f = fr(q.question); return Math.min(...f.map(x=> x.n)) + '/' + f[0].d; }

const SOLVE = {
  Halvo: q=> { const m = q.question.match(/into (\d+) equal parts and (\d+) of them/); return m[2] + '/' + m[1]; },
  Triqua: q=> { const m = q.question.match(/cut into (\d+) equal \w+\. \S+ eats (\d+)/); return m[2] + '/' + m[1]; },
  Quadrin: q=> {
    const m = q.question.match(/Which fraction is (greater|smaller): (\d+)\/(\d+) or (\d+)\/(\d+)\?/);
    const pick = m[1] === 'greater' ? Math.max : Math.min;
    return pick(+m[2], +m[4]) + '/' + m[3];
  },
  Ordelle: ordered, Lineup: ordered, 'Four in a Row': ordered,
  Addix: sum2, Sumora: sum2, Plusix: sum2, Combino: sum2, Wordlet: sum2, Addelle: sum2, Storyfrac: sum2,
  Subtra: diff2, Subtrix: diff2, Minuso: diff2, Takeway: diff2, 'Two Tanks': diff2,
  Setto: ofSet, Groupzy: ofSet, Sharemint: ofSet, Piecewise: ofSet,
  Nearone: closest, 'Closest Call': closest, 'Furthest Out': furthest,
  Partly: q=> {
    const m = q.question.match(/In the fraction (\d+)\/(\d+), what does the (\d+) represent/);
    return m[3] === m[2] ? 'Total equal parts the whole is divided into' : 'Number of equal parts being counted';
  },
  Halfmark: q=> {
    const m = q.question.match(/Is (\d+)\/(\d+) more than/);
    return 2 * m[1] < m[2] ? 'Less than 1/2' : 2 * m[1] > m[2] ? 'More than 1/2' : 'Exactly 1/2';
  },
  Wholesome: q=> exactlyOne(q.options, o=> { const v = value(o); return v.n === v.d; }, 'Wholesome'),
  Talebit: q=> { const f = fr(q.question)[0]; return (f.d - f.n) + '/' + f.d; },
  'Cake Split': leftover, 'Juice Box': leftover, 'Ribbon Leftover': leftover,
  'Equal Match': q=> { const b = fr(q.question)[0]; return exactlyOne(q.options, o=> sameValue(value(o), b), 'Equal Match'); },
  'Ribbon Cut': q=> { const L = num(/(\d+)m long/, q.question); return (L - L / fr(q.question)[0].d) + 'm'; },
  'Whole Check': q=> exactlyOne(q.options, o=> { const v = value(o); return v.n !== v.d; }, 'Whole Check'),
  'Order Check': q=> {
    const asc = /SMALLEST to LARGEST/.test(q.question);
    return exactlyOne(q.options, o=> {
      const nums = o.split(', ').map(s=> +s.split('/')[0]);
      return nums.every((x, i)=> i === 0 || (asc ? nums[i - 1] < x : nums[i - 1] > x));
    }, 'Order Check');
  },
  'Sweet Count': restOfSet, 'Shop Split': restOfSet,
  'Equal Pair': q=> exactlyOne(q.options, o=> {
    const [x, y] = o.split(' and ').map(value);
    return sameValue(x, y);
  }, 'Equal Pair'),
  'Slice Trio': q=> { const f = fr(q.question); return (f[0].d - f[0].n - f[1].n - f[2].n) + '/' + f[0].d; },
  'Gap Finder': q=> { const m = q.question.match(/(\d+)\/(\d+) is equivalent to \?\/(\d+)/); return String(m[1] * (m[3] / m[2])); },
  'Ribbon Relay': q=> { const L = num(/(\d+)m long/, q.question); const f = fr(q.question); return (L - L / f[0].d - L / f[1].d) + 'm'; },
  'Trip Sharing': q=> { const N = num(/^(\d+) students/, q.question); const f = fr(q.question); return String(N / f[0].d - N / f[1].d); },
  'Full Circle': q=> { const f = fr(q.question)[0]; return (f.d - f.n) + '/' + f.d; },
  'Mixed Bag': q=> { const N = num(/has (\d+) marbles/, q.question); const f = fr(q.question); return String(N - N / f[0].d - N / f[1].d); }
};

let checks = 0;
const check = (name, pass)=> { assert.ok(pass, name); checks++; console.log('ok  ' + name); };

const banks = [['Fractling', FRACTLINGS], ['Trainer', TRAINER_POOL], ['Boss', BOSS_POOL]];
const all = banks.flatMap(([, list])=> list);
check('45 questions across the three banks', all.length === 45);
check('every entry has a generator', all.every(e=> QB.hasGenerator(e.name)));
check('every entry has an independent solver', all.every(e=> typeof SOLVE[e.name] === 'function'));

const RUNS = 1500;
for(const [label, list] of banks){
  for(const entry of list){
    QB.setRandom(mulberry32(entry.name.split('').reduce((a, c)=> a * 31 + c.charCodeAt(0) | 0, 7)));
    const before = JSON.stringify(entry);
    const positions = [0, 0, 0, 0];
    const seen = new Set();
    for(let i = 0; i < RUNS; i++){
      const q = QB.build(entry);
      const where = `${label} ${entry.name} #${i} "${q.question}" -> ${JSON.stringify(q.options)}`;
      assert.equal(q.generated, true, 'generator fell back: ' + where);
      assert.equal(q.options.length, 4, 'needs 4 options: ' + where);
      assert.equal(new Set(q.options).size, 4, 'duplicate option text: ' + where);
      assert.ok(q.correct >= 0 && q.correct < 4, 'correct index out of range: ' + where);
      const answer = q.options[q.correct];
      assert.equal(answer, SOLVE[entry.name](q), 'wrong answer key: ' + where);
      q.options.forEach(o=> {
        if(/^\d+\/\d+$/.test(o)){
          const v = value(o);
          assert.ok(v.n >= 1 && v.d >= 1, 'fraction needs a positive numerator and denominator: ' + where);
        }
      });
      if(entry.name !== 'Whole Check' && q.options.every(o=> /^\d+\/\d+$/.test(o))){
        const vals = q.options.map(value);
        vals.forEach((v, a)=> vals.forEach((w, b)=> assert.ok(a === b || !sameValue(v, w), 'two options equal in value: ' + where)));
      }
      if(/^[\d\/, m]+$/.test(answer)) assert.ok(q.explain.includes(answer), 'explanation does not state the answer: ' + where);
      assert.ok(!/undefined|NaN|Infinity|null/.test(q.question + q.explain + q.options.join('|')), 'bad text: ' + where);
      positions[q.correct]++;
      seen.add(q.question + '|' + [...q.options].sort().join());
    }
    assert.equal(JSON.stringify(entry), before, entry.name + ' bank entry was modified');
    check(`${label} "${entry.name}": ${RUNS} variants correct, ${seen.size} distinct questions`, seen.size >= 5);
    check(`${label} "${entry.name}": answer position is shuffled`, positions.every(p=> p / RUNS > 0.19 && p / RUNS < 0.31));
  }
}

// The hand-written fallback must still shuffle without losing its answer.
QB.setRandom(mulberry32(1));
const fallbackEntry = Object.assign({}, FRACTLINGS[2], {name: 'No generator'});
let fallbackOk = true;
for(let i = 0; i < 200; i++){
  const q = QB.build(fallbackEntry);
  fallbackOk = fallbackOk && q.generated === false && q.question === fallbackEntry.question &&
    q.options[q.correct] === fallbackEntry.options[fallbackEntry.correct] &&
    [...q.options].sort().join() === [...fallbackEntry.options].sort().join();
}
check('hand-written fallback keeps its answer while shuffling', fallbackOk);

console.log(`${checks}/${checks} question checks passed`);
