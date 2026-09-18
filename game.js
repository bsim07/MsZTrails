(function(){

/* ================= STATE ================= */
const state = {
  pos:{...START},
  caught:{},           // fractlingId -> true
  records:{},          // fractlingId -> {yourAnswer, correctAnswer, strategy, confidence, attempts, neededHint}
  classStats:{},       // fractlingId -> {correct, wrong, students}
  battle:null,         // {id, wrongCount}
  slotAssignment:{},   // slotIndex -> fractlingId or null (decoy)
  sessionFractlingIds:[], // this LEVEL's 10 target Fractlings
  level1TargetIds:[],  // remembered so Level 2 can mix in unused ones + rematches
  levelResolved:{},    // fractlingId -> true, reset every level (drives progress bar + tile look)
  level:1,             // 1 = Explore, 2 = Bonus Round, 3 = Boss Battle
  focusTags:[],        // optional: tags the player chose to focus on for Level 1
  bossBattle:null,      // {qIndex, correctCount, questions, missed}
  bossPassed:false,
  exitNote:"",
  trainerBadges:{},    // trainerKey -> true
  trainerBattle:null,  // {key, qIndex, correctCount, questions}
  trainerPositions:{}, // "row,col" -> trainerKey, reshuffled every playthrough
  trainerPosByKey:{},  // trainerKey -> {row,col}
  streak:0,
  bestStreak:0,
  muted:false,
  playerName:"",
  storageKey:"",
  avatar:"male",
};

/* ================= HELPERS ================= */
// Game-specific helpers (pure helpers live in utils.js)

function assignSlots(mode){
  let targetIds;
  if(state.level <= 1){
    const allIds = FRACTLINGS.map(f=>f.id);
    if(state.focusTags.length===0){
      targetIds = shuffleArray([...allIds]).slice(0,10);
    } else {
      // Strict filter: a chosen focus should ONLY show that category's questions,
      // never padded out with unrelated ones — a shorter, genuinely-focused round
      // is better than a diluted one.
      const matched = shuffleArray(allIds.filter(id => state.focusTags.includes(FRACTLINGS.find(f=>f.id===id).tag)));
      targetIds = matched.slice(0,10);
    }
    state.level1TargetIds = targetIds;
  } else {
    const unused = FRACTLINGS.map(f=>f.id).filter(id => !state.level1TargetIds.includes(id));
    const struggleScore = id=>{
      const r = state.records[id] || {};
      return (r.attempts||1) + (r.neededHint?1:0);
    };
    const reviewSorted = [...state.level1TargetIds].sort((a,b)=> struggleScore(b)-struggleScore(a));
    if(mode==='new'){
      targetIds = shuffleArray([...unused]).slice(0,10);
    } else if(mode==='review'){
      targetIds = shuffleArray(reviewSorted.slice(0,6));
    } else {
      const reviewPicks = reviewSorted.slice(0, Math.max(0, 10-unused.length));
      targetIds = shuffleArray([...unused, ...reviewPicks]).slice(0,10);
    }
  }
  state.sessionFractlingIds = targetIds;
  state.rarityByFractling = Rarity.assign(targetIds);
  Rarity.setSession(state.rarityByFractling);
  state.levelResolved = {};

  const allSlots = shuffleArray(Array.from({length:TOTAL_SLOTS}, (_,i)=>i));
  const filled = allSlots.slice(0, targetIds.length);
  const order = shuffleArray([...targetIds]);
  state.slotAssignment = {};
  allSlots.forEach(s => state.slotAssignment[s] = null);
  filled.forEach((slotIdx, i) => { state.slotAssignment[slotIdx] = order[i]; });
}

function slotForFractling(fid){
  return Object.keys(state.slotAssignment).find(k => String(state.slotAssignment[k]) === String(fid));
}

function assignTrainerPositions(){
  const shuffled = shuffleArray([...TRAINER_CANDIDATES]);
  const keys = Object.keys(TRAINERS);
  state.trainerPositions = {};
  state.trainerPosByKey = {};
  keys.forEach((k, i)=>{
    const pos = shuffled[i];
    state.trainerPositions[pos.row+','+pos.col] = k;
    state.trainerPosByKey[k] = pos;
  });
}

/* ---- Sound effects (Web Audio, no external files) ---- */
let audioCtx = null;
function ensureAudio(){
  if(!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audioCtx=null; } }
  return audioCtx;
}
function playTone(freq, dur, type, vol, delay){
  if(state.muted) return;
  const ctx = ensureAudio(); if(!ctx) return;
  setTimeout(()=>{
    try{
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type||'sine'; o.frequency.value = freq; g.gain.value = vol!=null?vol:0.15;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime;
      o.start(t);
      g.gain.exponentialRampToValueAtTime(0.001, t+dur);
      o.stop(t+dur+0.02);
    }catch(e){}
  }, delay||0);
}
function sfxCorrect(){ playTone(880,0.12,'sine',0.16,0); playTone(1175,0.14,'sine',0.16,90); }
function sfxWrong(){ playTone(160,0.22,'sawtooth',0.12,0); }
function sfxCatch(){ [660,880,1100,1320].forEach((f,i)=>playTone(f,0.16,'sine',0.15,i*110)); }
function sfxBadge(){ [520,660,780,1040,1320].forEach((f,i)=>playTone(f,0.18,'triangle',0.16,i*100)); }
function sfxDecoy(){ playTone(300,0.1,'sine',0.08,0); }
function sfxFootstep(){
  playTone(120,0.06,'triangle',0.04,0);
}
function sfxEncounter(){
  playTone(523,0.12,'sine',0.12,0);
  playTone(659,0.14,'sine',0.12,80);
}
function sfxGuide(){
  playTone(440,0.18,'sine',0.12,0);
  playTone(554,0.22,'sine',0.1,150);
}
function sfxTrainerAppear(){
  playTone(196,0.16,'sawtooth',0.14,0);
  playTone(247,0.18,'sawtooth',0.14,120);
  playTone(294,0.22,'sawtooth',0.14,240);
}

/* ================= BACKGROUND MUSIC (procedural, no files needed) ================= */
let bgmNodes = null; // { ctx, o, g, interval }
const BGM_NOTES = [262,330,392,523,392,330,262,330,392,440,392,330];
function createBgmOscillator(ctx, freq){
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.value = 0.05;
  o.connect(g); g.connect(ctx.destination);
  return {o, g};
}
function startBackgroundMusic(){
  if(bgmNodes || state.muted) return;
  const ctx = ensureAudio(); if(!ctx) return;
  if(ctx.state === 'suspended') ctx.resume().catch(()=>{});
  const master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  const pad1 = ctx.createOscillator(); pad1.type='sine'; pad1.frequency.value=196;
  const pad1g = ctx.createGain(); pad1g.gain.value=0.09;
  const pad2 = ctx.createOscillator(); pad2.type='sine'; pad2.frequency.value=246.94;
  const pad2g = ctx.createGain(); pad2g.gain.value=0.07;
  pad1.connect(pad1g); pad1g.connect(master); pad2.connect(pad2g); pad2g.connect(master);
  pad1.start(); pad2.start();
  let step = 0;
  function playMelodyNote(){
    if(state.muted) return;
    const o = ctx.createOscillator(); o.type='triangle'; o.frequency.value=BGM_NOTES[step++ % BGM_NOTES.length];
    const g = ctx.createGain(); g.gain.value=0;
    o.connect(g); g.connect(master);
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.22, t+0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.6);
    o.start(t); o.stop(t+0.65);
  }
  playMelodyNote();
  const interval = setInterval(playMelodyNote, 500);
  bgmNodes = {ctx, master, pad1, pad2, interval};
}
function stopBackgroundMusic(){
  if(!bgmNodes) return;
  clearInterval(bgmNodes.interval);
  try{ bgmNodes.pad1.stop(); bgmNodes.pad2.stop(); }catch(e){}
  try{ bgmNodes.master.disconnect(); }catch(e){}
  bgmNodes = null;
}
function toggleAudioMute(){
  state.muted = !state.muted;
  document.getElementById('muteBtn').textContent = state.muted ? '🔇' : '🔊';
  if(state.muted){
    stopBackgroundMusic();
  } else {
    startBackgroundMusic();
  }
}

const DECOY_MESSAGES = [
  "🍃 Just rustling leaves... no Fractling here.",
  "🌾 Empty patch — keep exploring!",
  "🦗 Only a cricket chirping in there.",
  "🍂 Nothing this time. Try another patch!"
];
function showDecoyRustle(slotIdx){
  sfxDecoy();
  toast(DECOY_MESSAGES[Math.floor(Math.random()*DECOY_MESSAGES.length)]);
  if(slotIdx!==undefined && slotTileEls[slotIdx]){
    slotTileEls[slotIdx].classList.add('checked-empty');
  }
}

/* ================= TITLE SCREEN CRITTERS ================= */
function renderTitleCritters(){
  const wrap = document.getElementById('titleCritters');
  [0,4,8].forEach(i=>{
    const f = FRACTLINGS[i];
    const pie = makePieEl(f, 48);
    pie.classList.add('mini-pie');
    pie.style.animation = 'none';
    wrap.appendChild(pie);
  });
}
renderTitleCritters();

function renderFocusPicker(){
  const wrap = document.getElementById('focusPickerButtons');
  CATEGORY_GROUPS.forEach(group=>{
    const b = document.createElement('button');
    b.className = 'focus-pill';
    b.textContent = group.label;
    b.dataset.key = group.key;
    b.addEventListener('click', ()=>{
      b.classList.toggle('selected');
      const active = wrap.querySelectorAll('.focus-pill.selected');
      state.focusTags = Array.from(active).flatMap(el=>{
        const g = CATEGORY_GROUPS.find(x=>x.key===el.dataset.key);
        return g ? g.tags : [];
      });
    });
    wrap.appendChild(b);
  });
}
renderFocusPicker();

/* ================= AVATAR PICKER ================= */
function renderAvatarPicker(){
  const wrap = document.getElementById('avatarPickerButtons');
  wrap.querySelectorAll('.avatar-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      wrap.querySelectorAll('.avatar-btn').forEach(x=>x.classList.remove('selected'));
      b.classList.add('selected');
      state.avatar = b.dataset.avatar;
      applyAvatarToPlayer();
    });
  });
}
renderAvatarPicker();

function applyAvatarToPlayer(){
  const player = document.getElementById('player');
  if(!player) return;
  player.dataset.avatar = state.avatar;
}

/* ================= iOS ADD-TO-HOME-SCREEN HINT ================= */
function showIosInstallHint(){
  const hint = document.getElementById('iosInstallHint');
  if(!hint) return;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if(isIos && !isStandalone) hint.classList.remove('hidden');
}
showIosInstallHint();

const TILE = 16;
const SPRITE_H = 24;

function pixelScale(){
  return parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--px'), 10) || 3;
}

function tileVariant(r, c, n){
  return ((r * 73856093) ^ (c * 19349663)) % n;
}

function pathEdges(r, c){
  const isPath = (rr, cc) => {
    if(rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) return true;
    const v = MAP[rr][cc];
    return v === '.' || (v && v[0] === 'N');
  };
  let s = '';
  if(!isPath(r-1, c)) s += 'n';
  if(!isPath(r+1, c)) s += 's';
  if(!isPath(r, c+1)) s += 'e';
  if(!isPath(r, c-1)) s += 'w';
  const ok = ['n','s','e','w','ne','nw','se','sw','ns','ew'];
  return ok.includes(s) ? 'edge-' + s : '';
}

/* --px is owned by assets/pixel-scale.js, which knows about both the title
   screen and the map. Keep the map in step after it changes. */
window.addEventListener('resize', ()=>{ positionPlayer(); updateCamera(); });

function showEncounterAlert(){
  const player = document.getElementById('player');
  if(!player) return;
  const a = document.createElement('div');
  a.className = 'encounter-alert';
  player.appendChild(a);
  setTimeout(()=> a.remove(), 700);
}

/* ================= MAP RENDER ================= */
const mapGrid = document.getElementById('mapGrid');
let mapWorld = null;
let tileEls = [];
let slotTileEls = {};
let trainerTileEls = {};

function initMap(){
  setPixelScale();
  mapGrid.innerHTML = '';
  tileEls = [];
  slotTileEls = {};
  trainerTileEls = {};

  mapWorld = document.createElement('div');
  mapWorld.id = 'mapWorld';
  mapGrid.appendChild(mapWorld);

  for(let r=0;r<ROWS;r++){
    const rowArr = [];
    for(let c=0;c<COLS;c++){
      const val = MAP[r][c];
      const t = document.createElement('div');
      t.className = 'tile';
      if(val==='#'){ t.classList.add('t-tree', 'v' + tileVariant(r,c,4)); }
      else if(val=='.'){
        t.classList.add('t-path');
        if(tileVariant(r,c,2)) t.classList.add('v1');
        const e = pathEdges(r,c);
        if(e) t.classList.add(e);
      }
      else if(val==='g'){ t.classList.add('t-grassbg', 'v' + tileVariant(r,c,4)); }
      else if(val==='h'){ t.classList.add('t-hill'); }
      else if(val==='w'){ t.classList.add('t-water'); }
      else if(val==='f'){ t.classList.add('t-flowers'); }
      else if(val==='t'){ t.classList.add('t-thicket'); }
      else if(val==='b'){ t.classList.add('t-bush'); }
      else if(val==='r'){ t.classList.add('t-rock'); }
      else if(val==='m'){ t.classList.add('t-mushroom'); }
      else if(val && val[0]==='S'){
        t.classList.add('t-grass');
        const slotIdx = +val.slice(1);
        t.dataset.slot = slotIdx;
        t.style.animationDelay = (tileVariant(r,c,8) * 0.2).toFixed(1) + 's';
        slotTileEls[slotIdx] = t;
      }
      else if(val && val[0]==='N'){
        t.classList.add('t-guide');
        t.dataset.guide = val;
        t.innerHTML = '<span class="npc"></span>';
      }
      mapWorld.appendChild(t);
      rowArr.push(t);
    }
    tileEls.push(rowArr);
  }
  Object.entries(state.trainerPosByKey).forEach(([key, pos])=>{
    if(pos.row < 0 || pos.row >= ROWS || pos.col < 0 || pos.col >= COLS) return;
    const tile = tileEls[pos.row][pos.col];
    if(!tile) return;
    tile.className = 'tile t-trainer';
    tile.dataset.trainer = key;
    tile.innerHTML = '<span class="npc"></span>';
    if(state.trainerBadges[key]) tile.classList.add('beaten');
    trainerTileEls[key] = tile;
  });
  const player = document.createElement('div');
  player.id = 'player';
  player.dataset.avatar = state.avatar;
  player.innerHTML = '<span class="sprite face-down"></span>';
  mapGrid.appendChild(player);
  positionPlayer();
  refreshCaughtTiles();
  updateProximityGlow();
  updateCamera();
}

function positionPlayer(){
  const player = document.getElementById('player');
  if(!player) return;
  const px = pixelScale();
  const midC = Math.floor(VIEWPORT_COLS/2);
  const midR = Math.floor(VIEWPORT_ROWS/2);
  const viewCol = Math.min(Math.max(state.pos.col - midC, 0), COLS - VIEWPORT_COLS);
  const viewRow = Math.min(Math.max(state.pos.row - midR, 0), ROWS - VIEWPORT_ROWS);
  player.style.left = ((state.pos.col - viewCol) * TILE * px) + 'px';
  player.style.top  = (((state.pos.row - viewRow) * TILE) - (SPRITE_H - TILE)) * px + 'px';
}

function updateCamera(){
  if(!mapWorld) return;
  const px = pixelScale();
  const midC = Math.floor(VIEWPORT_COLS/2);
  const midR = Math.floor(VIEWPORT_ROWS/2);
  const viewCol = Math.min(Math.max(state.pos.col - midC, 0), COLS - VIEWPORT_COLS);
  const viewRow = Math.min(Math.max(state.pos.row - midR, 0), ROWS - VIEWPORT_ROWS);
  mapWorld.style.transform =
    `translate(${-viewCol * TILE * px}px, ${-viewRow * TILE * px}px)`;
}

function refreshCaughtTiles(){
  Object.keys(state.levelResolved).forEach(fid=>{
    const slotIdx = slotForFractling(fid);
    if(slotIdx!==undefined && slotTileEls[slotIdx]) slotTileEls[slotIdx].classList.add('caught');
  });
  revealLastFractling();
}

function revealLastFractling(){
  // Safety net: once only one Fractling is left this level, give it a gentle glow so
  // students aren't stuck re-checking already-empty patches for ages at the tail end.
  document.querySelectorAll('.hint-glow').forEach(el=>el.classList.remove('hint-glow'));
  const remaining = state.sessionFractlingIds.filter(id => !state.levelResolved[id]);
  if(remaining.length === 1){
    const slotIdx = slotForFractling(remaining[0]);
    if(slotIdx!==undefined && slotTileEls[slotIdx] && !slotTileEls[slotIdx].classList.contains('caught')){
      slotTileEls[slotIdx].classList.add('hint-glow');
    }
  }
}

function recenterCameraIfNeeded(){
  const midC = Math.floor(VIEWPORT_COLS/2);
  const midR = Math.floor(VIEWPORT_ROWS/2);
  const minVisibleCol = state.pos.col - midC;
  const maxVisibleCol = state.pos.col + midC;
  const minVisibleRow = state.pos.row - midR;
  const maxVisibleRow = state.pos.row + midR;
  if(minVisibleCol < 0 || maxVisibleCol >= COLS || minVisibleRow < 0 || maxVisibleRow >= ROWS){
    updateCamera();
  }
}

function setPlayerWalking(isWalking){
  const sprite = document.querySelector('#player .sprite');
  if(sprite) sprite.classList.toggle('walking', isWalking);
}

function setPlayerDirection(dx,dy){
  const sprite = document.querySelector('#player .sprite');
  if(!sprite) return;
  sprite.classList.remove('face-up','face-down','face-left','face-right');
  if(dx > 0){
    sprite.classList.add('face-right');
  } else if(dx < 0){
    sprite.classList.add('face-left');
  } else if(dy < 0){
    sprite.classList.add('face-up');
  } else {
    sprite.classList.add('face-down');
  }
}

function tryMove(dx,dy){
  if(state.battle || state.trainerBattle) return; // no moving mid-battle
  setPlayerDirection(dx,dy);
  const nr = state.pos.row+dy, nc = state.pos.col+dx;
  if(nr<0||nr>=ROWS||nc<0||nc>=COLS) return;
  const val = MAP[nr][nc];
  // Only border trees, thickets, water and hills are impassable; everything else is walkable.
  if(val==='#' || val==='t' || val==='w' || val==='h') return;
  setPlayerWalking(true);
  state.pos = {row:nr, col:nc};
  positionPlayer();
  updateCamera();
  updateProximityGlow();
  sfxFootstep();
  setTimeout(()=> setPlayerWalking(false), 180);
  const trainerKey = state.trainerPositions[nr+','+nc];
  if(trainerKey){
    sfxTrainerAppear();
    startTrainerBattle(trainerKey);
    return;
  }
  if(val && val[0]==='S'){
    const slotIdx = +val.slice(1);
    const fid = state.slotAssignment[slotIdx];
    if(fid===null || fid===undefined){
      showDecoyRustle(slotIdx);
    } else if(!state.levelResolved[fid]){
      sfxEncounter();
      showEncounterAlert();
      setTimeout(()=> startEncounter(fid), 420);
    }
  } else if(val && val[0]==='N'){
    sfxGuide();
    openGuideDialog(val);
  }
}

// Gentle "warmer/colder" cue: any uncaught Fractling patch directly next to the player
// gets a soft golden glow, so hunting for the last one or two doesn't drag on forever.
function updateProximityGlow(){
  document.querySelectorAll('.t-grass.near').forEach(el=> el.classList.remove('near'));
  const {row,col} = state.pos;
  [[row-1,col],[row+1,col],[row,col-1],[row,col+1]].forEach(([r,c])=>{
    if(r<0||r>=ROWS||c<0||c>=COLS) return;
    const val = MAP[r][c];
    if(!(val && val[0]==='S')) return;
    const slotIdx = +val.slice(1);
    const fid = state.slotAssignment[slotIdx];
    if(fid!==null && fid!==undefined && !state.levelResolved[fid] && slotTileEls[slotIdx]){
      slotTileEls[slotIdx].classList.add('near');
    }
  });
  revealLastFractling();
}

function isVisible(r, c){
  const midC = Math.floor(VIEWPORT_COLS/2);
  const midR = Math.floor(VIEWPORT_ROWS/2);
  const viewCol = Math.min(Math.max(state.pos.col - midC, 0), COLS - VIEWPORT_COLS);
  const viewRow = Math.min(Math.max(state.pos.row - midR, 0), ROWS - VIEWPORT_ROWS);
  return c >= viewCol && c < viewCol + VIEWPORT_COLS && r >= viewRow && r < viewRow + VIEWPORT_ROWS;
}

document.addEventListener('keydown', (e)=>{
  const gameScreen = document.getElementById('screen-game');
  const active = document.activeElement;
  const editing = active && (
    active.matches('input, textarea, select') ||
    active.isContentEditable
  );
  if(!gameScreen || gameScreen.classList.contains('hidden') || editing) return;
  const k = e.key.toLowerCase();
  const map = {arrowup:[0,-1], w:[0,-1], arrowdown:[0,1], s:[0,1], arrowleft:[-1,0], a:[-1,0], arrowright:[1,0], d:[1,0]};
  if(map[k]){
    e.preventDefault();
    tryMove(map[k][0], map[k][1]);
  }
});
document.getElementById('dpad').querySelectorAll('button').forEach(b=>{
  const move = (event)=>{
    event.preventDefault();
    tryMove(+b.dataset.dx, +b.dataset.dy);
  };
  b.addEventListener('pointerdown', move, {passive:false});
});

/* Swipe gestures on the map, so touch users aren't limited to the D-pad */
(function setupSwipe(){
  const grid = document.getElementById('mapGrid');
  let startX=0, startY=0, tracking=false;
  const THRESHOLD = 24;
  grid.addEventListener('touchstart', (e)=>{
    if(e.touches.length!==1) return;
    tracking = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, {passive:true});
  grid.addEventListener('touchend', (e)=>{
    if(!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX, dy = t.clientY - startY;
    if(Math.max(Math.abs(dx), Math.abs(dy)) < THRESHOLD) return;
    if(Math.abs(dx) > Math.abs(dy)){
      tryMove(dx > 0 ? 1 : -1, 0);
    } else {
      tryMove(0, dy > 0 ? 1 : -1);
    }
  }, {passive:true});
})();

/* ================= MODAL SYSTEM ================= */
const modalRoot = document.getElementById('modalRoot');
let modalPointerActivation = false;
function openModal(html){
  modalRoot.innerHTML = `<div class="modal-overlay" id="curOverlay"><div class="modal-card">${html}</div></div>`;
  const overlay = document.getElementById('curOverlay');
  overlay.addEventListener('click', (event)=>{
    if(event.target === overlay) closeModal();
  });
  return overlay;
}
function closeModal(){ modalRoot.innerHTML=''; }

modalRoot.addEventListener('click', (event)=>{
  if(modalPointerActivation){
    modalPointerActivation = false;
    event.preventDefault();
    return;
  }
  const closeButton = event.target.closest('[data-close]');
  if(closeButton){
    event.preventDefault();
    event.stopPropagation();
    closeModal();
  }
});
modalRoot.addEventListener('pointerup', (event)=>{
  const button = event.target.closest('button');
  if(!button || button.disabled) return;
  modalPointerActivation = true;
  button.click();
});
document.addEventListener('keydown', (event)=>{
  if(event.key === 'Escape' && document.getElementById('curOverlay')) closeModal();
});

/* ================= GUIDE DIALOG ================= */
function openGuideDialog(key){
  const g = GUIDES[key];
  let idx = Math.floor(Math.random()*g.tips.length);
  if(g.tips.length>1 && idx===lastTipIndex[key]){
    idx = (idx+1) % g.tips.length;
  }
  lastTipIndex[key] = idx;
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="dialog-head"><span class="avatar">${g.avatar}</span><span class="name">${g.name}</span></div>
    <div class="dialog-body"><div class="bubble">${formatFractionText(g.tips[idx])}</div></div>
    <div class="dialog-foot"><button class="btn-primary" data-close>Thanks!</button></div>
  `);
  overlay.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', closeModal));
}

/* ================= BATTLE ================= */
function startEncounter(id){
  const f = FRACTLINGS[id];
  state.battle = {id, wrongCount:0};
  renderBattleFight(f);
}

function rarityKey(f){ return (window.Rarity && Rarity.of(f.id)) || 'common'; }
function rarityLabel(f){ return (window.Rarity && Rarity.LABELS[rarityKey(f)]) || 'Common'; }

function renderBattleFight(f){
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="battle-head">
      <h3>A wild Fractling appeared!</h3>
      <div class="sub">Answer correctly to weaken it</div>
    </div>
    <div class="creature-stage" id="creatureStage" data-rarity="${rarityKey(f)}">
      <div class="creature-name">${f.name}</div>
      <div class="creature-tag">${f.tag}</div>
      <span class="rarity-badge" data-rarity="${rarityKey(f)}" style="--species-color:${f.color}">${rarityLabel(f)} Fractling</span>
      <div class="hp-wrap"><div class="hp-bar" id="hpBar"></div></div>
    </div>
    <div class="battle-body">
      <div class="q-box">${formatFractionText(f.question)}</div>
      <div class="feedback" id="feedback"></div>
      <div class="options" id="optionsWrap"></div>
    </div>
    <div class="hint-box" id="hintBox">${formatFractionText(f.hint)}</div>
    <div class="battle-actions">
      <button class="btn-secondary" id="hintBtn">💡 Ask for a hint</button>
    </div>
  `);
  const stage = document.getElementById('creatureStage');
  const modal = stage.closest('.modal-card');
  if(modal) modal.dataset.rarity = rarityKey(f);
  const pie = makePieEl(f, 110);
  pie.id = 'battlePie';
  stage.insertBefore(pie, stage.firstChild);

  const optsWrap = document.getElementById('optionsWrap');
  f.options.forEach((opt, idx)=>{
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.innerHTML = formatFractionText(opt);
    b.addEventListener('click', ()=> handleAnswer(idx, f));
    optsWrap.appendChild(b);
  });

  document.getElementById('hintBtn').addEventListener('click', ()=>{
    document.getElementById('hintBox').classList.add('show');
  });
  overlay.querySelector('[data-close]').addEventListener('click', ()=>{ state.battle=null; closeModal(); });
}

function handleAnswer(idx, f){
  const opts = document.querySelectorAll('.opt-btn');
  opts.forEach(b=>b.disabled = true);
  const feedback = document.getElementById('feedback');
  const pie = document.getElementById('battlePie');
  const hpBar = document.getElementById('hpBar');

  if(idx === f.correct){
    opts[idx].classList.add('correct');
    feedback.textContent = "Critical hit! That's correct!";
    feedback.className = 'feedback good';
    pie.classList.add('hit');
    hpBar.style.width = '0%';
    sfxCorrect();
    const usedHint = document.getElementById('hintBox').classList.contains('show');
    state.records[f.id] = state.records[f.id] || {};
    state.records[f.id].yourAnswer = f.options[idx];
    state.records[f.id].correctAnswer = f.options[f.correct];
    state.records[f.id].question = f.question;
    state.records[f.id].attempts = (state.battle.wrongCount||0) + 1;
    state.records[f.id].wrongAttempts = state.battle.wrongCount||0;
    state.records[f.id].neededHint = usedHint;
    Rarity.record(f.id, true, usedHint);
    if(state.battle.wrongCount===0){
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
    }
    updateStreakUI();
    setTimeout(()=>{ renderReflect(f); }, 900);
  } else {
    opts[idx].classList.add('wrong');
    feedback.textContent = "Not quite — give it another go!";
    feedback.className = 'feedback bad';
    pie.classList.remove('hit'); void pie.offsetWidth; pie.classList.add('hit');
    sfxWrong();
    state.records[f.id] = state.records[f.id] || {question:f.question};
    state.records[f.id].wrongAttempts = (state.records[f.id].wrongAttempts||0) + 1;
    Rarity.record(f.id, false, false);
    state.battle.wrongCount++;
    state.streak = 0;
    updateStreakUI();
    if(state.battle.wrongCount>=1){
      document.getElementById('hintBox').classList.add('show');
    }
    setTimeout(()=>{ opts.forEach((b,i)=>{ if(i!==idx){ b.disabled=false; } b.classList.remove('wrong'); }); }, 700);
  }
}

function updateStreakUI(){
  const wrap = document.getElementById('streakWrap');
  const text = document.getElementById('streakText');
  if(!wrap || !text) return;
  text.textContent = state.streak;
  wrap.classList.toggle('hidden', state.streak < 2);
}

function renderReflect(f){
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="battle-head" style="background:linear-gradient(180deg,#B98CE0,#9463C9);">
      <h3>Nice work!</h3>
      <div class="sub">Reflect before you catch ${f.name}</div>
    </div>
    <div class="creature-stage" id="reflectStage" style="margin-top:-32px;"></div>
    <div class="reflect-title">How did you figure out your answer?</div>
    <div class="reflect-sub">Pick the one closest to how you actually thought</div>
    <div class="choice-list" id="stratList"></div>
    <div class="reflect-title" style="margin-top:16px;">How confident do you feel?</div>
    <div class="conf-row" id="confRow"></div>
    <div class="catch-actions">
      <button class="btn-primary" id="catchBtn" disabled>🌀 Focus &amp; Catch!</button>
    </div>
  `);
  const stage = document.getElementById('reflectStage');
  const pie = makePieEl(f, 90);
  pie.style.animation = 'idle 2.6s ease-in-out infinite';
  stage.appendChild(pie);

  let stratIdx = null, confIdx = null;
  const stratList = document.getElementById('stratList');
  f.strategies.forEach((s, i)=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className='choice-btn';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = formatFractionText(s);
    b.addEventListener('click', (event)=>{
      event.preventDefault();
      stratList.querySelectorAll('.choice-btn').forEach(x=>x.classList.remove('selected'));
      stratList.querySelectorAll('.choice-btn').forEach(x=>x.setAttribute('aria-pressed', 'false'));
      b.classList.add('selected');
      b.setAttribute('aria-pressed', 'true');
      stratIdx = i;
      checkReady();
    });
    stratList.appendChild(b);
  });
  const confRow = document.getElementById('confRow');
  CONFIDENCE.forEach((c,i)=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className='conf-btn';
    b.setAttribute('aria-pressed', 'false');
    b.textContent = c;
    b.addEventListener('click', (event)=>{
      event.preventDefault();
      confRow.querySelectorAll('.conf-btn').forEach(x=>x.classList.remove('selected'));
      confRow.querySelectorAll('.conf-btn').forEach(x=>x.setAttribute('aria-pressed', 'false'));
      b.classList.add('selected');
      b.setAttribute('aria-pressed', 'true');
      confIdx = i;
      checkReady();
    });
    confRow.appendChild(b);
  });
  function checkReady(){
    const catchButton = document.getElementById('catchBtn');
    const ready = stratIdx!==null && confIdx!==null;
    catchButton.disabled = !ready;
    catchButton.setAttribute('aria-disabled', String(!ready));
    catchButton.textContent = ready ? '🌀 Focus & Catch!' : 'Choose both answers';
  }
  document.getElementById('catchBtn').addEventListener('click', (event)=>{
    event.preventDefault();
    if(stratIdx===null || confIdx===null) return;
    state.records[f.id].strategy = f.strategies[stratIdx];
    state.records[f.id].strategyCatIdx = stratIdx;
    state.records[f.id].confidence = CONFIDENCE[confIdx];
    state.records[f.id].explain = f.explain;
    doCatchAnimation(f, pie, stage);
  });
  overlay.querySelector('[data-close]').addEventListener('click', ()=>{ state.battle=null; closeModal(); });
}

function doCatchAnimation(f, pieEl, stage){
  document.querySelectorAll('.choice-btn, .conf-btn, #catchBtn').forEach(b=>b.disabled=true);
  const sparkleLayer = document.createElement('div');
  sparkleLayer.className = 'sparkle-layer';
  stage.style.position = 'relative';
  stage.appendChild(sparkleLayer);
  const emojis = ['✨','⭐','🌟','💫'];
  for(let i=0;i<10;i++){
    const s = document.createElement('div');
    s.className = 'sparkle';
    s.textContent = emojis[i%emojis.length];
    const angle = (i/10)*2*Math.PI;
    s.style.setProperty('--dx', (Math.cos(angle)*70)+'px');
    s.style.setProperty('--dy', (Math.sin(angle)*70)+'px');
    s.style.left = '50%'; s.style.top='20px';
    s.style.animationDelay = (i*30)+'ms';
    sparkleLayer.appendChild(s);
  }
  pieEl.classList.add('faint');
  sfxCatch();
  setTimeout(()=>{
    state.caught[f.id] = true;
    state.levelResolved[f.id] = true;
    state.battle = null;
    updateProgress();
    refreshCaughtTiles();
    updateProximityGlow();
    closeModal();
    saveProgress();
    if(Object.keys(state.levelResolved).length === state.sessionFractlingIds.length){
      setTimeout(()=> renderLevelComplete(state.level), 400);
    } else {
      toast(`${f.name} was added to your Journal! 📖`);
    }
  }, 950);
}

function toast(msg){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;left:50%;bottom:26px;transform:translateX(-50%);
    background:#2A3B2A;color:#fff;padding:10px 18px;border-radius:999px;font-weight:800;
    font-size:0.85em;box-shadow:0 6px 16px rgba(0,0,0,0.3);z-index:200;font-family:'Nunito';`;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(()=>t.remove(),400); }, 1800);
}

function updateProgress(){
  const n = Object.keys(state.levelResolved).length;
  const total = state.sessionFractlingIds.length || 10;
  document.getElementById('progressText').textContent = `${n}/${total}`;
  document.getElementById('progressBarInner').style.width = (n/total*100)+'%';
  const lvlLabel = document.getElementById('levelLabel');
  if(lvlLabel){
    const names = {1:'Level 1 · Explore', 2:'Level 2 · Bonus Round', 3:'Level 3 · Boss Battle'};
    lvlLabel.textContent = names[state.level] || ('Level '+state.level);
  }
}

/* ================= TRAINER BATTLES ================= */
function startTrainerBattle(key){
  if(state.trainerBattle) return;
  const t = TRAINERS[key];
  const pool = shuffleArray([...TRAINER_POOL]);
  const qs = pool.slice(0,3);
  state.trainerBattle = {key, qIndex:0, correctCount:0, questions:qs, wrongThisQ:0, missed:[]};
  renderTrainerIntro(key, t);
}

function renderTrainerIntro(key, t){
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="dialog-head" style="background:linear-gradient(180deg,#7BC1EE,#4E9FDA);">
      <span class="avatar">${t.avatar}</span><span class="name" style="color:#fff;">${t.name}</span>
    </div>
    <div class="dialog-body"><div class="bubble">${t.intro}</div></div>
    <div class="dialog-foot">
      <button class="btn-secondary" data-close style="margin-right:8px;">Not now</button>
      <button class="btn-primary" id="beginTrainerBtn">⚔️ Begin Battle</button>
    </div>
  `);
  overlay.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', ()=>{ state.trainerBattle=null; closeModal(); }));
  document.getElementById('beginTrainerBtn').addEventListener('click', renderTrainerQuestion);
}

function renderTrainerQuestion(){
  const tb = state.trainerBattle;
  const t = TRAINERS[tb.key];
  const f = tb.questions[tb.qIndex];
  tb.wrongThisQ = 0;
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="battle-head">
      <h3>${t.name}'s Challenge</h3>
      <div class="sub">Question ${tb.qIndex+1} of ${tb.questions.length}</div>
    </div>
    <div class="creature-stage" id="creatureStage">
      <div class="creature-name">${f.name}</div>
      <div class="creature-tag">${f.tag}</div>
    </div>
    <div class="battle-body">
      <div class="q-box">${formatFractionText(f.question)}</div>
      <div class="feedback" id="trainerFeedback"></div>
      <div class="options" id="trainerOptionsWrap"></div>
    </div>
  `);
  const stage = document.getElementById('creatureStage');
  const pie = makePieEl(f, 90);
  pie.id = 'trainerPie';
  stage.insertBefore(pie, stage.firstChild);

  const optsWrap = document.getElementById('trainerOptionsWrap');
  f.options.forEach((opt, idx)=>{
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.innerHTML = formatFractionText(opt);
    b.addEventListener('click', ()=> handleTrainerAnswer(idx, f));
    optsWrap.appendChild(b);
  });
  overlay.querySelector('[data-close]').addEventListener('click', ()=>{ state.trainerBattle=null; closeModal(); });
}

function handleTrainerAnswer(idx, f){
  const tb = state.trainerBattle;
  const opts = document.querySelectorAll('#trainerOptionsWrap .opt-btn');
  opts.forEach(b=>b.disabled = true);
  const feedback = document.getElementById('trainerFeedback');
  const pie = document.getElementById('trainerPie');

  if(idx === f.correct){
    opts[idx].classList.add('correct');
    feedback.textContent = "Correct!";
    feedback.className = 'feedback good';
    pie.classList.add('hit');
    sfxCorrect();
    Rarity.record(f.id, true, false);
    if(tb.wrongThisQ===0) tb.correctCount++;
    else tb.missed.push(f);
  } else {
    opts[idx].classList.add('wrong');
    opts[f.correct].classList.add('correct');
    feedback.innerHTML = `The correct answer was ${formatFractionText(f.options[f.correct])}`;
    feedback.className = 'feedback bad';
    sfxWrong();
    Rarity.record(f.id, false, false);
    tb.wrongThisQ++;
    tb.missed.push(f);
  }
  setTimeout(()=>{
    tb.qIndex++;
    if(tb.qIndex < tb.questions.length){
      renderTrainerQuestion();
    } else {
      finishTrainerBattle();
    }
  }, 1300);
}

function finishTrainerBattle(){
  const tb = state.trainerBattle;
  const t = TRAINERS[tb.key];
  const total = tb.questions.length;
  const passed = tb.correctCount >= 2;
  if(passed){
    state.trainerBadges[tb.key] = true;
    if(trainerTileEls[tb.key]) trainerTileEls[tb.key].classList.add('beaten');
    sfxBadge();
  }
  const missedHtml = tb.missed.length ? `
    <div class="reflect-title" style="text-align:left;margin-top:14px;">Worth a second look</div>
    ${tb.missed.slice(0,3).map(f=>`
      <div class="explain-box" style="margin-top:8px;">
        <b>${f.name}:</b> ${formatFractionText(f.explain)}
      </div>`).join('')}
  ` : '';
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="end-head" style="background:linear-gradient(180deg,${passed?'#B7EAC0,#5FC96B':'#FFD877,#FF9F5A'});">
      <h2>${passed? '🏅 Badge earned!' : 'Good effort!'}</h2>
      <div>You scored ${tb.correctCount}/${total} against ${t.name}</div>
    </div>
    <div class="end-body">
      ${passed
        ? `<p style="font-weight:700;color:#3E5A34;">${t.name} hands you a badge. Come back anytime for more practice!</p>`
        : `<p style="font-weight:700;color:#5B3A00;">You need 2 out of 3 correct to earn the badge. ${t.name} is happy to rematch anytime!</p>`}
      ${missedHtml}
    </div>
    <div class="end-foot"><button class="btn-primary" id="trainerContinueBtn">Continue</button></div>
  `);
  overlay.querySelector('[data-close]').addEventListener('click', closeAfterTrainer);
  document.getElementById('trainerContinueBtn').addEventListener('click', closeAfterTrainer);
  function closeAfterTrainer(){
    state.trainerBattle = null;
    closeModal();
    saveProgress();
  }
}


/* ================= JOURNAL ================= */
document.getElementById('journalBtn').addEventListener('click', renderJournal);

function renderJournal(){
  const caughtIds = Object.keys(state.caught).map(Number).sort((a,b)=>a-b);
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="journal-head">
      <h3>📖 Fractling Journal</h3>
      <p>${caughtIds.length} caught · Tap a Fractling to revisit your reflection</p>
    </div>
    <div class="journal-grid" id="journalGrid"></div>
    ${caughtIds.length===0 ? '<div class="dash-empty">You haven\'t caught any Fractlings yet — explore the tall grass!</div>' : ''}
  `);
  const grid = document.getElementById('journalGrid');
  caughtIds.forEach(fid=>{
    const f = FRACTLINGS.find(x=>x.id===fid);
    if(!f) return;
    const slot = document.createElement('div');
    slot.className = 'slot';
    const pie = makePieEl(f, 52);
    pie.style.animation = 'none';
    slot.appendChild(pie);
    const nm = document.createElement('div');
    nm.className = 'slot-name';
    nm.textContent = f.name;
    slot.appendChild(nm);
    const rarity = document.createElement('div');
    rarity.className = 'rarity-badge';
    rarity.dataset.rarity = rarityKey(f);
    rarity.style.setProperty('--species-color', f.color);
    rarity.textContent = rarityLabel(f);
    slot.appendChild(rarity);
    slot.addEventListener('click', ()=> renderDetail(f));
    grid.appendChild(slot);
  });
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
}

function renderDetail(f){
  const rec = state.records[f.id];
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="journal-head">
      <h3>${f.name}</h3>
      <p>${f.tag}</p>
    </div>
    <div class="detail-body">
      <div class="detail-q">${formatFractionText(rec.question)}</div>
      <div class="detail-row"><span class="tag you">You answered</span><span>${formatFractionText(rec.yourAnswer)}</span></div>
      <div class="detail-row"><span class="tag correct">Correct answer</span><span>${formatFractionText(rec.correctAnswer)}</span></div>
      <div class="detail-row"><span class="tag strat">Your strategy</span><span>${rec.strategy}</span></div>
      <div class="detail-row"><span class="tag conf">Confidence</span><span>${rec.confidence}</span></div>
      <div class="detail-row"><span class="tag you">Tries taken</span><span>${rec.attempts||1}${rec.neededHint? ' (used a hint)':''}</span></div>
      <div class="explain-box"><b>How to solve it:</b><br>${formatFractionText(rec.explain)}</div>
    </div>
    <div class="detail-foot"><button class="btn-secondary" id="backToJournal">← Back to Journal</button></div>
  `);
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  document.getElementById('backToJournal').addEventListener('click', renderJournal);
}

/* ================= END SCREEN ================= */
function buildSummaryBarsHtml(){
  const tally = [0,0,0,0];
  Object.values(state.records).forEach(r=>{
    if(typeof r.strategyCatIdx === 'number') tally[r.strategyCatIdx]++;
  });
  const max = Math.max(...tally,1);
  const shortLabels = ["Applied a fraction rule","Visualised / drew it","Used another method","Guessed"];
  return tally.map((v,i)=>`
    <div class="bar-row">
      <div class="bar-label">${shortLabels[i]}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(v/max*100)}%"></div></div>
      <div>${v}</div>
    </div>`).join('');
}

function buildBadgeStreakHtml(){
  const badgeCount = Object.keys(state.trainerBadges).length;
  return `
    <div class="detail-row" style="margin-top:6px;">
      <span class="tag strat">🏅 Trainer badges</span><span>${badgeCount} / ${Object.keys(TRAINERS).length}</span>
    </div>
    <div class="detail-row">
      <span class="tag conf">🔥 Best streak</span><span>${state.bestStreak} in a row, first try</span>
    </div>`;
}

function exitNoteHtml(){
  return `
    <div class="reflect-title" style="text-align:left;margin-top:14px;">Before you finish up</div>
    <div class="reflect-sub" style="text-align:left;">Which fraction skill feels solid now? Which would you like more practice on?</div>
    <textarea id="exitNoteBox" placeholder="e.g. I'm good at comparing fractions now, but adding still trips me up..."
      style="width:100%;min-height:70px;font-family:'Nunito';font-size:16px;border:2px solid #E1EEF7;
      border-radius:10px;padding:10px;resize:vertical;">${escapeHtml(state.exitNote||'')}</textarea>`;
}
function wireExitNote(){
  const box = document.getElementById('exitNoteBox');
  if(box) box.addEventListener('input', ()=>{ state.exitNote = box.value; });
}

function resetToFreshGame(){
  regenerateLandscape();
  state.pos = {...START};
  state.caught = {};
  state.records = {};
  state.battle = null;
  state.trainerBattle = null;
  state.bossBattle = null;
  state.bossPassed = false;
  state.streak = 0;
  state.level = 1;
  state.exitNote = '';
  assignSlots();
  assignTrainerPositions();
  initMap();
  updateProgress();
  updateStreakUI();
  closeModal();
}

function renderLevelComplete(level){
  const copy = {
    1:{title:'🏁 Level 1 Complete!', sub:"You've explored the fraction basics — nice work!", nextLabel:'➡️ Bonus Round'},
    2:{title:'🎉 Bonus Round Complete!', sub:'You tackled fresh Fractlings and revisited your trickiest ones.', nextLabel:'⚔️ Final Challenge'},
  }[level];

  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="end-head">
      <h2>${copy.title}</h2>
      <div>${copy.sub}</div>
    </div>
    <div class="end-body">
      <div class="reflect-title" style="text-align:left;">Your strategies, at a glance</div>
      ${buildSummaryBarsHtml()}
      ${buildBadgeStreakHtml()}
      ${exitNoteHtml()}
    </div>
    <div class="end-foot">
      <button class="btn-secondary" id="openJournalFromEnd">📖 Journal</button>
      <button class="btn-secondary" id="exportFromEnd">📤 Share Results</button>
      <button class="btn-secondary" id="stopHereBtn">🏁 Stop Here</button>
      <button class="btn-primary" id="continueLevelBtn">${copy.nextLabel} →</button>
    </div>
  `);
  wireExitNote();
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  document.getElementById('openJournalFromEnd').addEventListener('click', renderJournal);
  document.getElementById('exportFromEnd').addEventListener('click', renderExportModal);
  document.getElementById('stopHereBtn').addEventListener('click', ()=>{
    saveProgress();
    closeModal();
    toast('Great session! Come back anytime to continue exploring. 🌿');
  });
  document.getElementById('continueLevelBtn').addEventListener('click', ()=>{
    closeModal();
    if(level===1){
      renderBonusChoice();
    } else if(level===2){
      startBossBattle();
    }
  });
  if(level===1){
    const skipRow = document.createElement('div');
    skipRow.style.cssText = 'text-align:center;padding:0 20px 18px;';
    skipRow.innerHTML = `<button class="teacher-link" id="skipToBossBtn" style="color:#5B7F99;">Or skip straight to the Boss Battle →</button>`;
    overlay.querySelector('.end-body').after(skipRow);
    document.getElementById('skipToBossBtn').addEventListener('click', ()=>{
      closeModal();
      startBossBattle();
    });
  }
}

function renderBonusChoice(){
  const unusedCount = FRACTLINGS.length - state.level1TargetIds.length;
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="journal-head" style="background:linear-gradient(180deg,#63C97D,#3FA25B);">
      <h3>🌟 Choose Your Bonus Round</h3>
      <p>You pick what this round focuses on</p>
    </div>
    <div class="choice-list" style="padding:16px 20px 4px;">
      <button class="choice-btn" id="modeNew" style="font-size:0.95em;">
        🆕 <b>New Territory</b><br><span style="font-weight:600;font-size:0.9em;">Meet ${unusedCount} brand-new Fractlings you haven't seen yet.</span>
      </button>
      <button class="choice-btn" id="modeReview" style="font-size:0.95em;">
        🔁 <b>Rematch Trail</b><br><span style="font-weight:600;font-size:0.9em;">Revisit your trickiest questions from Level 1 for extra practice.</span>
      </button>
      <button class="choice-btn" id="modeMixed" style="font-size:0.95em;">
        🎲 <b>Mixed Trail</b><br><span style="font-weight:600;font-size:0.9em;">A bit of both — new Fractlings plus your toughest rematches.</span>
      </button>
    </div>
    <div class="detail-foot"></div>
  `);
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  const go = (mode)=>{
    closeModal();
    state.level = 2;
    regenerateLandscape();
    state.pos = {...START};
    assignSlots(mode);
    assignTrainerPositions();
    initMap();
    updateProgress();
    const msgs = {new:'New Territory unlocked — 6 fresh Fractlings await! 🌟', review:'Rematch Trail begins — time to conquer your trickiest ones! 🔁', mixed:'Bonus Round begins! New Fractlings + your trickiest rematches. 🌟'};
    toast(msgs[mode]);
  };
  document.getElementById('modeNew').addEventListener('click', ()=>go('new'));
  document.getElementById('modeReview').addEventListener('click', ()=>go('review'));
  document.getElementById('modeMixed').addEventListener('click', ()=>go('mixed'));
}

/* ================= BOSS BATTLE (Level 3) ================= */
function startBossBattle(){
  state.level = 3;
  state.bossBattle = {qIndex:0, correctCount:0, questions: shuffleArray([...BOSS_POOL]).slice(0,6), missed:[]};
  updateProgress();
  renderBossIntro();
}

function renderBossIntro(){
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="end-head" style="background:linear-gradient(180deg,#FFD877,#E0933F);">
      <h2>⚔️ The Fraction Boss Battle</h2>
      <div>6 brand-new, multi-step questions you won't have seen before. Score 4 or more to earn your Fraction Master badge!</div>
    </div>
    <div class="end-foot"><button class="btn-primary" id="beginBossBtn">Begin</button></div>
  `);
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  document.getElementById('beginBossBtn').addEventListener('click', renderBossQuestion);
}

function renderBossQuestion(){
  const bb = state.bossBattle;
  const f = bb.questions[bb.qIndex];
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="battle-head" style="background:linear-gradient(180deg,#FFD877,#E0933F);">
      <h3>Boss Battle</h3>
      <div class="sub">Question ${bb.qIndex+1} of ${bb.questions.length}</div>
    </div>
    <div class="creature-stage" id="creatureStage">
      <div class="creature-name">${f.name}</div>
      <div class="creature-tag">${f.tag}</div>
    </div>
    <div class="battle-body">
      <div class="q-box">${formatFractionText(f.question)}</div>
      <div class="feedback" id="bossFeedback"></div>
      <div class="options" id="bossOptionsWrap"></div>
    </div>
  `);
  const stage = document.getElementById('creatureStage');
  const pie = makePieEl(f, 90);
  pie.id = 'bossPie';
  stage.insertBefore(pie, stage.firstChild);

  const optsWrap = document.getElementById('bossOptionsWrap');
  f.options.forEach((opt, idx)=>{
    const b = document.createElement('button');
    b.className = 'opt-btn';
    b.innerHTML = formatFractionText(opt);
    b.addEventListener('click', ()=> handleBossAnswer(idx, f));
    optsWrap.appendChild(b);
  });
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
}

function handleBossAnswer(idx, f){
  const bb = state.bossBattle;
  const opts = document.querySelectorAll('#bossOptionsWrap .opt-btn');
  opts.forEach(b=>b.disabled = true);
  const feedback = document.getElementById('bossFeedback');
  const pie = document.getElementById('bossPie');

  if(idx === f.correct){
    opts[idx].classList.add('correct');
    feedback.textContent = "Correct!";
    feedback.className = 'feedback good';
    pie.classList.add('hit');
    sfxCorrect();
    Rarity.record(f.id, true, false);
    bb.correctCount++;
  } else {
    opts[idx].classList.add('wrong');
    opts[f.correct].classList.add('correct');
    feedback.innerHTML = `The correct answer was ${formatFractionText(f.options[f.correct])}`;
    feedback.className = 'feedback bad';
    sfxWrong();
    Rarity.record(f.id, false, false);
    bb.missed.push(f);
  }
  setTimeout(()=>{
    bb.qIndex++;
    if(bb.qIndex < bb.questions.length){
      renderBossQuestion();
    } else {
      finishBoss();
    }
  }, 1300);
}

function finishBoss(){
  const bb = state.bossBattle;
  const total = bb.questions.length;
  const passed = bb.correctCount >= 4;
  state.bossPassed = passed;
  if(passed) sfxBadge();
  saveProgress();

  const missedHtml = bb.missed.length ? `
    <div class="reflect-title" style="text-align:left;margin-top:14px;">Worth a second look</div>
    ${bb.missed.slice(0,3).map(f=>`
      <div class="explain-box" style="margin-top:8px;"><b>${f.name}:</b> ${formatFractionText(f.explain)}</div>
    `).join('')}
  ` : '';

  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="end-head" style="background:linear-gradient(180deg,${passed?'#FFE08A,#F5B942':'#FFD877,#FF9F5A'});">
      <h2>${passed? '🎓 Fraction Master!' : 'So close!'}</h2>
      <div>${state.playerName} scored ${bb.correctCount}/${total} in the Boss Battle</div>
    </div>
    <div class="end-body">
      ${passed
        ? `<p style="font-weight:700;color:#5B3A00;">You've completed the whole Fraction Trail — explorer, bonus rematches, and the boss battle. Amazing work!</p>`
        : `<p style="font-weight:700;color:#5B3A00;">You need 4 out of 6 correct for the Fraction Master badge. Want to retake just the Boss Battle?</p>`}
      ${missedHtml}
      ${exitNoteHtml()}
    </div>
    <div class="end-foot">
      <button class="btn-secondary" id="openJournalFromBoss">📖 Journal</button>
      <button class="btn-secondary" id="exportFromBoss">📤 Share Results</button>
      ${passed ? '' : '<button class="btn-secondary" id="retryBossBtn">🔁 Retry Boss</button>'}
      <button class="btn-primary" id="restartBtn">🔄 Play Again</button>
    </div>
  `);
  wireExitNote();
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  document.getElementById('openJournalFromBoss').addEventListener('click', renderJournal);
  document.getElementById('exportFromBoss').addEventListener('click', renderExportModal);
  document.getElementById('restartBtn').addEventListener('click', resetToFreshGame);
  if(!passed){
    document.getElementById('retryBossBtn').addEventListener('click', ()=>{
      closeModal();
      startBossBattle();
    });
  }
}


/* ================= TEACHER TRACKING (shared storage) ================= */



async function saveProgress(){
  const payload = {
    name: state.playerName,
    updatedAt: Date.now(),
    level: state.level,
    bossPassed: state.bossPassed,
    caughtCount: Object.keys(state.caught).length,
    trainerBadges: Object.keys(state.trainerBadges),
    bestStreak: state.bestStreak,
    exitNote: state.exitNote,
    records: Object.entries(state.records).map(([fid, r])=>{
      const f = FRACTLINGS.find(x=>String(x.id)===String(fid));
      return {
        fractling: f? f.name : fid,
        tag: f? f.tag : '',
        question: r.question,
        yourAnswer: r.yourAnswer,
        correctAnswer: r.correctAnswer,
        attempts: r.attempts,
        wrongAttempts: r.wrongAttempts||0,
        correct: r.correctAnswer === r.yourAnswer,
        neededHint: r.neededHint,
        strategy: r.strategy,
        confidence: r.confidence
      };
    })
  };
  if(state.storageKey){
    try{ localStorage.setItem(state.storageKey, JSON.stringify(payload)); }catch(e){}
  }
  if(typeof window.storage === 'undefined') return;
  try{
    await window.storage.set(state.storageKey, JSON.stringify(payload), true);
  }catch(e){
    console.error('Could not save progress:', e);
  }
}



async function renderDashboard(){
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="journal-head" style="background:linear-gradient(180deg,#4E9FDA,#2E6FA8);">
      <h3>👩‍🏫 Class Dashboard</h3>
      <p>Live progress from every student who has played on this device or link</p>
    </div>
    <div id="dashContent"><div class="dash-empty">Checking for class data…</div></div>
    <div class="detail-foot">
      <button class="btn-secondary" id="dashRefreshBtn">🔄 Refresh</button>
    </div>
  `);
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  document.getElementById('dashRefreshBtn').addEventListener('click', renderDashboard);
  await loadDashboardData();
}

async function renderTeacherPage(){
  document.body.classList.add('teacher-mode');
  const app = document.getElementById('app');
  app.innerHTML = `
    <main id="teacherPage">
      <header class="teacher-page-head">
        <div>
          <div class="teacher-kicker">Fraction Trails</div>
          <h1>Teacher Dashboard</h1>
          <p>Track student progress, caught Fractlings, and fraction skills.</p>
        </div>
        <button class="btn-secondary" id="teacherRefreshBtn" type="button">Refresh results</button>
      </header>
      <section class="teacher-page-content">
        <div id="dashContent"><div class="dash-empty">Checking for class data...</div></div>
      </section>
    </main>
  `;
  document.getElementById('teacherRefreshBtn').addEventListener('click', renderTeacherPage);
  await loadDashboardData();
}

async function loadDashboardData(){
  const content = document.getElementById('dashContent');
  if(!content) return;
  let keysRes;
  let localOnly = false;
  if(typeof window.storage === 'undefined'){
    localOnly = true;
    keysRes = {keys:Object.keys(localStorage).filter(key=>key.indexOf('ft_response:')===0)};
  } else {
    try{
      keysRes = await window.storage.list('ft_response:', true);
    }catch(e){
      content.innerHTML = `<div class="dash-empty">Couldn't load class data right now — try the 📤 My Results export instead.</div>`;
      return;
    }
  }
  const keys = (keysRes && keysRes.keys) || [];
  if(keys.length===0){
    content.innerHTML = `<div class="dash-empty">No student data yet — play the game to create your first entry!</div>`;
    return;
  }
  const students = [];
  for(const k of keys){
    try{
      if(localOnly){
        const value = localStorage.getItem(k);
        if(value) students.push(JSON.parse(value));
      } else {
        const res = await window.storage.get(k, true);
        if(res && res.value) students.push(JSON.parse(res.value));
      }
    }catch(e){ /* skip unreadable entry */ }
  }
  students.sort((a,b)=> b.updatedAt - a.updatedAt);

  const rows = students.map(s=>`
    ${(() => {
      const records = s.records||[];
      const correct = records.filter(r=>r.correct).length;
      const wrong = records.reduce((sum,r)=>sum+(r.wrongAttempts||0),0);
      return `<tr>
      <td>${s.name||'Anonymous'}</td>
      <td>${s.level===3 ? (s.bossPassed?'L3 🎓':'L3') : 'L'+(s.level||1)}</td>
      <td>${correct}</td>
      <td>${wrong}</td>
      <td>${s.caughtCount||0} caught</td>
      <td>${(s.trainerBadges||[]).length}/${Object.keys(TRAINERS).length}</td>
      <td>${timeAgo(s.updatedAt)}</td>
    </tr>`;
    })()}
  `).join('');

  // Class-wide difficulty: average attempts per Fractling across students who caught it
  const diff = {};
  students.forEach(s=>{
    (s.records||[]).forEach(r=>{
      if(!diff[r.fractling]) diff[r.fractling] = {correct:0,wrong:0,tag:r.tag};
      if(r.correct) diff[r.fractling].correct++;
      diff[r.fractling].wrong += (r.wrongAttempts||0);
    });
  });
  const diffRows = Object.entries(diff)
    .map(([name,d])=>({name, tag:d.tag, correct:d.correct, wrong:d.wrong}))
    .sort((a,b)=> b.wrong-a.wrong)
    .slice(0,5);
  const diffHtml = diffRows.length ? diffRows.map(d=>`
      <div class="bar-row">
        <div class="bar-label">${d.name} (${d.tag})</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, d.wrong/Math.max(1,d.correct+d.wrong)*100)}%"></div></div>
        <div>${d.correct} correct / ${d.wrong} wrong</div>
      </div>`).join('') : '';
  const easyRows = Object.entries(diff)
    .map(([name,d])=>({name, tag:d.tag, correct:d.correct, wrong:d.wrong}))
    .sort((a,b)=> b.correct-a.correct)
    .slice(0,5);
  const easyHtml = easyRows.length ? easyRows.map(d=>`
      <div class="bar-row">
        <div class="bar-label">${d.name} (${d.tag})</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, d.correct/Math.max(1,d.correct+d.wrong)*100)}%"></div></div>
        <div>${d.correct} correct / ${d.wrong} wrong</div>
      </div>`).join('') : '';

  content.innerHTML = `
    <div class="dash-wrap">
      <table class="dash-table">
        <thead><tr><th>Student</th><th>Level</th><th>Correct</th><th>Wrong</th><th>Caught</th><th>Badges</th><th>Last active</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${diffHtml? `<div class="dash-summary">Questions most students get wrong:</div>
    <div style="padding:0 20px 4px;">${diffHtml}</div>` : ''}
    ${easyHtml? `<div class="dash-summary">Questions most students get correct:</div>
    <div style="padding:0 20px 4px;">${easyHtml}</div>` : ''}
    <div class="dash-note">${localOnly ? 'This browser is showing locally saved results. For results from multiple iPads, connect a shared storage or form endpoint.' : 'Data is shared across everyone using this game link — student names are self-entered and not verified.'}</div>
  `;
}


/* ================= EXPORT MY RESULTS (works everywhere, no backend needed) ================= */



function buildResultsText(){
  const caughtIds = Object.keys(state.caught).map(Number).sort((a,b)=>a-b);
  const levelNames = {1:'Level 1 (Explore)', 2:'Level 2 (Bonus Round)', 3:'Level 3 (Boss Battle)'};
  const lines = [];
  lines.push('Fraction Trails — Results');
  lines.push('Name: ' + state.playerName);
  lines.push('Date: ' + new Date().toLocaleString());
  lines.push('Furthest level reached: ' + (levelNames[state.level] || state.level));
  if(state.level===3) lines.push('Boss Battle result: ' + (state.bossPassed ? 'PASSED — 🎓 Fraction Master!' : 'Not yet passed'));
  lines.push('Fractlings caught: ' + caughtIds.length);
  lines.push('Trainer badges: ' + Object.keys(state.trainerBadges).length + '/' + Object.keys(TRAINERS).length);
  lines.push('Best streak (first-try, in a row): ' + state.bestStreak);
  if(state.exitNote && state.exitNote.trim()){
    lines.push('');
    lines.push('Student reflection: ' + state.exitNote.trim());
  }
  lines.push('');
  lines.push('Fractling-by-fractling:');
  caughtIds.forEach((fid, i)=>{
    const f = FRACTLINGS.find(x=>x.id===fid);
    const r = state.records[fid];
    if(!f || !r) return;
    lines.push((i+1)+'. '+f.name+' ('+f.tag+')');
    lines.push('   Question: '+stripTags(f.question));
    lines.push('   Your answer: '+r.yourAnswer+' — '+(r.attempts||1)+' tr'+((r.attempts||1)===1?'y':'ies')+(r.neededHint?', used a hint':''));
    lines.push('   Strategy: '+stripTags(r.strategy));
    lines.push('   Confidence: '+r.confidence);
    lines.push('');
  });
  return lines.join('\n');
}

function copyResultsText(text){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text)
      .then(()=> toast('Copied! Paste it wherever your teacher wants it.'))
      .catch(()=> fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try{ document.execCommand('copy'); toast('Copied!'); }
  catch(e){ toast('Please select the text above and copy it manually.'); }
  document.body.removeChild(ta);
}
function downloadResultsText(text){
  try{
    const blob = new Blob([text], {type:'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'FractionTrails_' + slugify(state.playerName) + '.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Downloaded! Send that file to your teacher.');
  }catch(e){
    toast('Download not supported here — try Copy instead.');
  }
}

function renderExportModal(){
  const text = buildResultsText();
  const overlay = openModal(`
    <button class="modal-close" data-close>×</button>
    <div class="journal-head" style="background:linear-gradient(180deg,#63C97D,#3FA25B);">
      <h3>📤 My Results</h3>
      <p>Share this with your teacher — by email, Google Classroom, or a shared drive folder</p>
    </div>
    <div style="padding:14px 20px 4px;">
      <textarea id="exportText" readonly style="width:100%;height:200px;font-family:monospace;font-size:15px;
        border:2px solid #E1EEF7;border-radius:10px;padding:10px;resize:vertical;">${escapeHtml(text)}</textarea>
    </div>
    <div class="end-foot">
      <button class="btn-secondary" id="copyResultsBtn">📋 Copy</button>
      <button class="btn-primary" id="downloadResultsBtn">⬇️ Download .txt</button>
    </div>
  `);
  overlay.querySelector('[data-close]').addEventListener('click', closeModal);
  document.getElementById('copyResultsBtn').addEventListener('click', ()=> copyResultsText(text));
  document.getElementById('downloadResultsBtn').addEventListener('click', ()=> downloadResultsText(text));
}

/* ================= START / INIT ================= */
function initFractionTrails(){
document.getElementById('startBtn').addEventListener('click', ()=>{
  const nameInput = document.getElementById('nameInput');
  const rawName = nameInput.value.trim();
  if(!rawName){
    nameInput.setCustomValidity('Please enter your name before starting.');
    nameInput.reportValidity();
    nameInput.focus();
    return;
  }
  nameInput.setCustomValidity('');
  state.playerName = rawName;
  state.storageKey = 'ft_response:' + slugify(state.playerName) + '_' + Math.random().toString(36).slice(2,6);
  document.getElementById('screen-title').classList.add('hidden');
  document.getElementById('screen-game').classList.remove('hidden');
  regenerateLandscape();
  state.pos = {...START};
  assignSlots();
  assignTrainerPositions();
  initMap();
  updateProgress();
  updateStreakUI();
  saveProgress();
  startBackgroundMusic();
});

document.getElementById('exportBtn').addEventListener('click', renderExportModal);

document.getElementById('muteBtn').addEventListener('click', toggleAudioMute);

  if(new URLSearchParams(window.location.search).get('teacher') === 'dashboard'){
    renderTeacherPage();
  }
}
window.initFractionTrails = initFractionTrails;

})();