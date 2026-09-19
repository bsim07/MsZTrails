/* Google Sheets transport and durable, latest-snapshot retry queue. */
(function(global){
  'use strict';
  const QUEUE_PREFIX = 'ft_sheets_pending_v1:';
  const config = global.FRACTION_TRAILS_CONFIG || {};
  const endpoint = String(config.sheetsUrl || '').trim();
  const configured = !!endpoint;
  const validEndpoint = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
  let queue = {};
  let durable = true;
  let busy = false;
  let timer;
  let failures = 0;
  let session = null;
  let lastMessage = configured ? 'Waiting to start' : 'Results saved on this device';
  function readPending(){
    try {
      Object.keys(localStorage).filter(key=>key.startsWith(QUEUE_PREFIX)).forEach(key=>{
        try {
          const stored = JSON.parse(localStorage.getItem(key));
          if(stored && stored.body && (!queue[key] || stored.body.revision > queue[key].body.revision)) queue[key] = stored;
        } catch(e){ /* One damaged entry must not stop other sessions syncing. */ }
      });
    } catch(e){ durable = false; }
  }
  readPending();

  function status(message){
    lastMessage = message;
    global.dispatchEvent(new CustomEvent('ft-sync-status', {detail:message}));
  }
  function persist(key){
    // A separate key per session prevents another open tab overwriting this queue.
    try { localStorage.setItem(key, JSON.stringify(queue[key])); durable = true; }
    catch(e){ durable = false; }
  }
  function pending(){
    readPending();
    return Object.entries(queue).filter(([,e])=>e && e.endpoint === endpoint && e.body && e.body.sessionId);
  }
  function schedule(delay){
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }
  async function request(body){
    if(!validEndpoint) throw new Error('The Google Sheets connection URL needs to be configured.');
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 20000);
    try {
      // text/plain is a simple cross-origin request: Apps Script has no OPTIONS handler.
      // Keep credentials in the POST body, never query strings. Read the acknowledgement;
      // an opaque no-cors response is NOT evidence that anything was saved.
      const response = await fetch(endpoint, {
        method:'POST', mode:'cors', credentials:'omit', redirect:'follow',
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify(body), signal:controller.signal
      });
      if(!response.ok) throw new Error('Google Sheets could not be reached.');
      let result;
      try { result = await response.json(); }
      catch(e){ throw new Error('Check the Apps Script deployment: execute as owner, access Anyone.'); }
      if(!result || result.ok !== true) throw new Error(result && result.error || 'Google Sheets rejected the update.');
      return result;
    } finally { clearTimeout(timeout); }
  }
  function startSession(classCode, studentId){
    session = {
      classCode:String(classCode).trim().toUpperCase(),
      studentId:String(studentId).trim().toUpperCase(),
      sessionId:global.crypto.randomUUID(), revision:0,
      startedAt:Date.now()
    };
    return session.sessionId;
  }
  function enqueue(payload){
    if(!configured || !session) return;
    const body = {action:'submit', ...session, revision:++session.revision, payload};
    const key = QUEUE_PREFIX + session.sessionId;
    queue[key] = {endpoint, body};
    persist(key);
    status(durable ? 'Saved on this device · waiting to sync' : 'Waiting to sync · keep this tab open');
    schedule(1200);
  }
  async function flush(){
    if(!configured || busy || !pending().length) return;
    if(!navigator.onLine){
      status(durable ? 'Offline · saved on this device' : 'Offline · keep this tab open to preserve results');
      schedule(30000);
      return;
    }
    busy = true;
    let failed = false;
    status('Syncing with your teacher…');
    try {
      // Do not let one rejected class code prevent other sessions from syncing.
      for(const [key, entry] of pending()){
        try {
          const result = await request(entry.body);
          if(result.sessionId !== entry.body.sessionId || !Number.isSafeInteger(result.revision) || result.revision < entry.body.revision){
            throw new Error('The server did not confirm this update.');
          }
          // A newer snapshot may have been queued while this request was in flight.
          readPending();
          if(queue[key] && queue[key].body.revision <= result.revision){
            try { localStorage.removeItem(key); } catch(e){ /* A repeated save is idempotent. */ }
            delete queue[key];
          }
        } catch(e){ failed = true; status('Not synced · ' + e.message); }
      }
      if(!pending().length){
        failures = 0;
        status('Synced with your teacher at ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
      } else if(!failed) status('New progress waiting to sync');
    } finally {
      busy = false;
      if(pending().length) schedule(failed ? Math.min(120000, 5000 * Math.pow(2, failures++)) : 1200);
    }
  }
  global.addEventListener('online', ()=>schedule(0));
  global.FTCloud = {
    configured, startSession, enqueue, retry:()=>schedule(0),
    getStatus:()=>lastMessage,
    list:(classCode, teacherKey)=>request({action:'list', classCode:String(classCode).trim().toUpperCase(), teacherKey})
  };
  if(configured && pending().length) schedule(1500);
})(window);
