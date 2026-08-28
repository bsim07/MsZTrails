function pieBackground(numerator, denominator, color){
  const sweep = 360 * numerator / denominator;
  const spokeStep = 360 / denominator;
  const spokes = `repeating-conic-gradient(from 0deg, rgba(0,0,0,0.12) 0deg ${Math.max(spokeStep-2,0.5)}deg, transparent ${Math.max(spokeStep-2,0.5)}deg ${spokeStep}deg)`;
  const fill = `conic-gradient(${color} 0deg ${sweep}deg, #ffffff ${sweep}deg 360deg)`;
  return `${spokes}, ${fill}`;
}

function makePieEl(f, size){
  const el = document.createElement('div');
  el.className = 'pie';
  el.style.width = size+'px';
  el.style.height = size+'px';
  el.style.backgroundImage = pieBackground(f.num, f.den, f.color);
  el.style.setProperty('--ear-color', f.ear);
  el.innerHTML = `
    <div class="ear l"></div><div class="ear r"></div>
    <div class="eye l"></div><div class="eye r"></div>
    <div class="mouth"></div>`;
  return el;
}

function shuffleStable(arr){ return arr; }

function formatFractionText(str){
  return String(str).replace(/(\d+)\/(\d+)/g, (m, n, d) =>
    `<span class="frac"><span class="num">${n}</span><span class="den">${d}</span></span>`
  );
}

function shuffleArray(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

function slugify(name){
  return (name||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40) || 'anonymous';
}

function timeAgo(ts){
  const diff = Math.max(0, Date.now()-ts);
  const mins = Math.floor(diff/60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return mins+'m ago';
  const hrs = Math.floor(mins/60);
  if(hrs < 24) return hrs+'h ago';
  return Math.floor(hrs/24)+'d ago';
}

function stripTags(html){ return String(html).replace(/<[^>]*>/g,''); }

function escapeHtml(str){
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}