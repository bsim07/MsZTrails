/* Teacher credentials live only in this tab's memory, never localStorage or URLs. */
(function(global){
  'use strict';
  global.renderCloudTeacherPage = function(){
    document.body.classList.add('teacher-mode');
    const app = document.getElementById('app');
    app.innerHTML = `
      <main id="teacherPage">
        <header class="teacher-page-head">
          <div><div class="teacher-kicker">Fraction Trails · Google Sheets</div>
            <h1>Teacher Dashboard</h1><p>Run a session for each class and follow progress across student devices.</p></div>
          <a class="btn-secondary" href="${location.pathname}">Back to game</a>
        </header>
        <section class="teacher-page-content">
          <form id="teacherConnectForm" class="cloud-connect">
            <label>Teacher access key<input id="teacherAccessKey" type="password" required autocomplete="off"></label>
            <button class="btn-primary" type="submit">Connect</button>
          </form>
          <p id="teacherConnectionHelp">Find the key on the private Sheet’s Connection tab. One key covers all your classes; students never need it.</p>
          <div class="cloud-toolbar hidden" id="teacherCloudToolbar">
            <button id="teacherCloudRefresh" type="button" class="btn-secondary">Refresh</button>
            <button id="teacherCloudLock" type="button" class="btn-secondary">Lock dashboard</button>
            <span>Refreshes every 30 seconds while this tab is visible.</span>
          </div>
          <p id="teacherCloudStatus" role="status" aria-live="polite">Enter your teacher access key to connect.</p>
          <div id="teacherSessions" class="hidden">
            <h2>Sessions</h2>
            <form id="teacherCreateForm" class="cloud-connect">
              <label>New session name<input id="teacherNewSessionName" maxlength="60" required autocomplete="off" placeholder="e.g. 3B Fractions, Tuesday"></label>
              <button class="btn-primary" type="submit">Create session</button>
            </form>
            <div id="teacherSessionList"></div>
            <details id="teacherArchived" class="student-details">
              <summary id="teacherArchivedSummary">Archived sessions</summary>
              <div id="teacherArchivedList"></div>
            </details>
          </div>
          <div id="teacherSessionPanel" class="session-panel hidden">
            <h2>Join <span id="teacherQrName"></span></h2>
            <p>Students scan this QR code with their device camera. The class code is filled in for them; they only enter their name and student number.</p>
            <div id="teacherSessionQr" class="session-qr" role="img" aria-label="QR code to join the class"></div>
            <p>Class code: <b id="teacherSessionCode"></b></p>
            <p class="session-link"><a id="teacherSessionLink" target="_blank" rel="noopener"></a></p>
            <button id="teacherSessionHide" type="button" class="btn-secondary">Hide QR code</button>
          </div>
          <div id="dashContent"></div>
        </section>
      </main>`;
    let credentials = null;
    let generation = 0;
    let loading = false;
    let busy = false;
    let interval;
    let sessions = [];
    let selected = null;
    let qrFor = null;
    const $ = id=>document.getElementById(id);
    const connectForm = $('teacherConnectForm');
    const status = $('teacherCloudStatus');
    const content = $('dashContent');
    const esc = value=>escapeHtml(value == null ? '' : value);
    const number = value=>Number.isFinite(value) ? Math.max(0,Math.floor(value)) : 0;
    const when = ms=>ms ? new Date(ms).toLocaleString() : '—';
    function el(tag, attrs, ...kids){
      const node = document.createElement(tag);
      Object.entries(attrs || {}).forEach(([name,value])=>{
        if(name === 'text') node.textContent = value; else node.setAttribute(name,value);
      });
      kids.forEach(kid=>node.append(kid));
      return node;
    }
    const cell = (...kids)=>el('td',{},...kids);
    const button = (label, action, code, extra)=>el('button',{type:'button','class':'btn-secondary' + (extra || ''),'data-action':action,'data-code':code,text:label});

    function hideSessionQr(){
      qrFor = null;
      $('teacherSessionPanel').classList.add('hidden');
      $('teacherSessionQr').replaceChildren();
    }
    function showSessionQr(code){
      const session = sessions.find(s=>s.code === code);
      if(!session || typeof qrcode === 'undefined') return;
      // Only the class code goes in the link; the teacher key never leaves this tab.
      const url = location.href.split(/[?#]/)[0] + '?class=' + encodeURIComponent(code);
      const qr = qrcode(0,'M');
      qr.addData(url);
      qr.make();
      $('teacherSessionQr').innerHTML = qr.createSvgTag({cellSize:6, margin:4, scalable:true});
      $('teacherQrName').textContent = session.name;
      $('teacherSessionCode').textContent = code;
      const link = $('teacherSessionLink');
      link.href = url;
      link.textContent = url;
      qrFor = code;
      $('teacherSessionPanel').classList.remove('hidden');
    }
    function lock(){
      generation++;
      credentials = null;
      clearInterval(interval);
      interval = null;
      sessions = [];
      selected = null;
      hideSessionQr();
      connectForm.reset();
      connectForm.classList.remove('hidden');
      $('teacherCloudToolbar').classList.add('hidden');
      $('teacherSessions').classList.add('hidden');
      $('teacherConnectionHelp').classList.remove('hidden');
      $('teacherSessionList').replaceChildren();
      $('teacherArchivedList').replaceChildren();
      content.replaceChildren();
      status.textContent = 'Dashboard locked. Enter your teacher access key to connect.';
    }

    function renderSessions(){
      const live = sessions.filter(s=>s.status !== 'Archived').sort((a,b)=>(b.createdAt || 0) - (a.createdAt || 0));
      const archived = sessions.filter(s=>s.status === 'Archived').sort((a,b)=>(b.archivedAt || 0) - (a.archivedAt || 0));
      const list = $('teacherSessionList');
      if(!live.length){
        list.replaceChildren(el('div',{'class':'dash-empty',text:'No sessions yet. Name your first session above, then click Create session.'}));
      } else {
        const rows = live.map(s=>{
          const row = el('tr',{'data-code':s.code},
            cell(s.name), cell(el('code',{text:s.code})),
            cell(el('span',{'class':'status-badge status-' + s.status.toLowerCase(),text:s.status === 'Open' ? 'Open' : 'Stopped'})),
            cell(String(number(s.students))), cell(when(s.createdAt)),
            el('td',{'class':'session-actions'},
              button('Results','results',s.code),
              ...(s.status === 'Open' ? [button('QR code','qr',s.code)] : []),
              button(s.status === 'Open' ? 'Stop' : 'Start','toggle',s.code),
              button('Archive','archive',s.code,' danger')));
          if(s.code === selected) row.setAttribute('aria-current','true');
          return row;
        });
        const table = el('table',{'class':'session-table'},
          el('thead',{},el('tr',{},...['Session','Class code','Status','Students','Created','Actions'].map(h=>el('th',{text:h})))),
          el('tbody',{},...rows));
        list.replaceChildren(el('div',{'class':'dash-wrap'},table));
      }
      $('teacherArchivedSummary').textContent = 'Archived sessions (' + archived.length + ')';
      const archivedList = $('teacherArchivedList');
      if(!archived.length){
        archivedList.replaceChildren(el('p',{text:'Nothing archived. Archived sessions keep their results in the Archive tab of your Sheet and can be restored here.'}));
      } else {
        const rows = archived.map(s=>el('tr',{'data-code':s.code},
          cell(s.name), cell(el('code',{text:s.code})), cell(String(number(s.students))), cell(when(s.archivedAt)),
          el('td',{'class':'session-actions'},button('Restore','restore',s.code))));
        const table = el('table',{'class':'session-table'},
          el('thead',{},el('tr',{},...['Session','Class code','Students','Archived','Actions'].map(h=>el('th',{text:h})))),
          el('tbody',{},...rows));
        archivedList.replaceChildren(el('div',{'class':'dash-wrap'},table));
      }
    }

    function renderStudents(students, session){
      students.sort((a,b)=>String(a.studentId).localeCompare(String(b.studentId),undefined,{numeric:true}));
      const heading = `<h2>Results · ${esc(session.name)}</h2>` +
        (session.status === 'Open' ? '' : '<p class="dash-note">This session is stopped, so students cannot send new results. Use Start to let them continue.</p>');
      if(!students.length){
        content.innerHTML = heading + `<div class="dash-empty">No student progress yet. Ask students to scan the session QR code or enter class code ${esc(session.code)}, then start an adventure.</div>`;
        return;
      }
      const rows = students.map(s=>{
        const records = Array.isArray(s.records) ? s.records : [];
        const wrong = records.reduce((n,r)=>n+number(r.wrongAttempts),0);
        const hints = records.filter(r=>r.neededHint).length;
        return `<tr><td>${esc(s.studentId)}</td><td>${esc(s.name)}</td><td>${number(s.level)}</td>
          <td>${s.level === 3 ? 'Boss challenge' : number(s.roundCaught)+' / '+number(s.roundTarget)}</td>
          <td>${number(s.caughtCount)}</td><td>${records.filter(r=>r.correct).length}</td><td>${wrong}</td><td>${hints}</td>
          <td>${Array.isArray(s.trainerBadges) ? s.trainerBadges.length : 0} / 3</td>
          <td>${s.bossTotal ? number(s.bossCorrect)+' / '+number(s.bossTotal)+(s.bossPassed ? ' · Passed' : '') : '—'}</td>
          <td>${esc(new Date(s.receivedAt).toLocaleString())}</td></tr>`;
      }).join('');
      content.innerHTML = heading + `<p><b>${students.length} ${students.length === 1 ? 'student' : 'students'}</b> · Latest session per student ID. Earlier sessions remain in the Sheet.</p>
        <div class="dash-wrap"><table class="dash-table"><thead><tr>
          <th>Student ID</th><th>Name</th><th>Level</th><th>Round progress</th><th>Caught</th><th>Correct records</th><th>Wrong attempts</th><th>Hints</th><th>Badges</th><th>Boss score</th><th>Last synced</th>
        </tr></thead><tbody>${rows}</tbody></table></div>
        <p class="dash-note">Results are student-reported. Correct records include eventual correct answers and trainer rewards; they are not first-try accuracy. Rematches replace the earlier record for that question.</p>
        <h2>Student reflections and question details</h2>
        ${students.map(s=>`<details class="student-details"><summary>${esc(s.studentId)} · ${esc(s.name)}</summary>
          <p><b>Reflection:</b> ${esc(s.exitNote || 'No reflection yet.')}</p><p><b>Best first-try streak:</b> ${number(s.bestStreak)}</p>
          ${(Array.isArray(s.records) ? s.records : []).map(r=>`<div class="cloud-record"><b>${esc(r.fractling)} · ${esc(r.tag)}</b>
            <p>${esc(stripTags(r.question || ''))}</p><p>Answer: ${esc(r.yourAnswer || 'Not answered correctly yet')} · Wrong attempts: ${number(r.wrongAttempts)}${r.neededHint ? ' · Used hint' : ''}</p>
            <p>Strategy: ${esc(stripTags(r.strategy || 'Not selected yet'))} · Confidence: ${esc(r.confidence || 'Not selected yet')}</p></div>`).join('')}
        </details>`).join('')}`;
    }

    async function refresh(){
      if(!credentials || loading) return;
      const current = generation;
      loading = true;
      status.textContent = 'Loading…';
      try {
        const result = await FTCloud.sessions(credentials.key);
        if(current !== generation) return;
        if(!Array.isArray(result.sessions)) throw new Error('The server returned an invalid session list.');
        sessions = result.sessions;
        connectForm.classList.add('hidden');
        $('teacherCloudToolbar').classList.remove('hidden');
        $('teacherSessions').classList.remove('hidden');
        $('teacherConnectionHelp').classList.add('hidden');
        $('teacherAccessKey').value = '';
        if(selected && !sessions.some(s=>s.code === selected && s.status !== 'Archived')) selected = null;
        if(qrFor && !sessions.some(s=>s.code === qrFor && s.status === 'Open')) hideSessionQr();
        renderSessions();
        if(selected){
          const detail = await FTCloud.list(selected, credentials.key);
          if(current !== generation) return;
          if(!Array.isArray(detail.students)) throw new Error('The server returned an invalid class list.');
          renderStudents(detail.students, detail.session);
        } else content.replaceChildren();
        status.textContent = 'Connected · Updated ' + new Date().toLocaleTimeString();
        if(!interval) interval = setInterval(()=>{ if(!document.hidden && !busy) refresh(); },30000);
      } catch(e){
        if(current === generation) status.textContent = 'Could not refresh: ' + e.message + (sessions.length ? ' Showing the previously fetched sessions.' : '');
      } finally { loading = false; }
    }

    // Runs one teacher action, then reloads so the page always shows what the Sheet holds.
    async function act(message, work){
      if(!credentials || busy) return false;
      const current = generation;
      busy = true;
      status.textContent = message;
      try { await work(credentials.key); }
      catch(e){
        busy = false;
        if(current === generation) status.textContent = 'Could not do that: ' + e.message;
        return false;
      }
      busy = false;
      await refresh();
      return true;
    }

    connectForm.addEventListener('submit', event=>{
      event.preventDefault();
      if(loading) return;
      generation++;
      credentials = {key:$('teacherAccessKey').value.trim()};
      refresh();
    });
    $('teacherCreateForm').addEventListener('submit', async event=>{
      event.preventDefault();
      const input = $('teacherNewSessionName');
      const name = input.value.trim();
      if(!name) return;
      let code = null;
      const ok = await act('Creating session…', async key=>{ code = (await FTCloud.createSession(key,name)).session.code; });
      if(!ok) return;
      input.value = '';
      selected = code;
      await refresh();
      showSessionQr(code);
    });
    $('teacherSessions').addEventListener('click', async event=>{
      const target = event.target.closest('button[data-action]');
      if(!target) return;
      const code = target.dataset.code;
      const session = sessions.find(s=>s.code === code);
      if(!session) return;
      switch(target.dataset.action){
        case 'results': selected = code; renderSessions(); await refresh(); break;
        case 'qr': showSessionQr(code); break;
        case 'toggle':
          await act(session.status === 'Open' ? 'Stopping session…' : 'Starting session…',
            key=>FTCloud.setStatus(key, code, session.status === 'Open' ? 'Closed' : 'Open'));
          break;
        case 'archive':
          if(!global.confirm('Archive “' + session.name + '”?\n\nStudents will no longer be able to join. Its results move to the Archive tab of your Google Sheet, and you can restore it from Archived sessions.')) break;
          await act('Archiving session…', key=>FTCloud.archive(key, code));
          break;
        case 'restore':
          await act('Restoring session…', key=>FTCloud.restore(key, code));
          break;
      }
    });
    $('teacherCloudRefresh').addEventListener('click',refresh);
    $('teacherCloudLock').addEventListener('click',lock);
    $('teacherSessionHide').addEventListener('click',hideSessionQr);
    global.addEventListener('pagehide',lock,{once:true});
  };
})(window);
