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
            <h1>Teacher Dashboard</h1><p>Progress from your class, across student devices.</p></div>
          <a class="btn-secondary" href="${location.pathname}">Back to game</a>
        </header>
        <section class="teacher-page-content">
          <form id="teacherConnectForm" class="cloud-connect">
            <label>Class code<input id="teacherClassCode" maxlength="32" required autocomplete="off"></label>
            <label>Teacher access key<input id="teacherAccessKey" type="password" required autocomplete="off"></label>
            <button class="btn-primary" type="submit">Connect to class</button>
          </form>
          <p id="teacherConnectionHelp">Find both values on the private Sheet’s Connection tab. Share only the class code with students.</p>
          <div class="cloud-toolbar hidden" id="teacherCloudToolbar">
            <button id="teacherCloudRefresh" type="button" class="btn-secondary">Refresh results</button>
            <button id="teacherCloudLock" type="button" class="btn-secondary">Lock dashboard</button>
            <span>Refreshes every 30 seconds while this tab is visible.</span>
          </div>
          <p id="teacherCloudStatus" role="status" aria-live="polite">Enter your class details to connect.</p>
          <div id="dashContent"></div>
        </section>
      </main>`;
    let credentials = null;
    let generation = 0;
    let loading = false;
    let interval;
    const form = document.getElementById('teacherConnectForm');
    const content = document.getElementById('dashContent');
    const status = document.getElementById('teacherCloudStatus');
    const toolbar = document.getElementById('teacherCloudToolbar');
    function lock(){
      generation++;
      credentials = null;
      clearInterval(interval);
      interval = null;
      form.reset();
      form.classList.remove('hidden');
      toolbar.classList.add('hidden');
      document.getElementById('teacherConnectionHelp').classList.remove('hidden');
      content.replaceChildren();
      status.textContent = 'Dashboard locked. Enter your class details to connect.';
    }
    async function refresh(){
      if(!credentials || loading) return;
      const current = generation;
      loading = true;
      status.textContent = 'Loading class progress…';
      try {
        const result = await FTCloud.list(credentials.classCode, credentials.key);
        if(current !== generation) return;
        if(!Array.isArray(result.students)) throw new Error('The server returned an invalid class list.');
        renderStudents(result.students);
        form.classList.add('hidden');
        toolbar.classList.remove('hidden');
        document.getElementById('teacherConnectionHelp').classList.add('hidden');
        document.getElementById('teacherAccessKey').value = '';
        status.textContent = 'Connected to ' + credentials.classCode + ' · Updated ' + new Date().toLocaleTimeString();
        if(!interval) interval = setInterval(()=>{ if(!document.hidden) refresh(); },30000);
      } catch(e){
        if(current === generation) status.textContent = 'Could not refresh: ' + e.message + (content.childNodes.length ? ' Showing the previously fetched results.' : '');
      } finally { loading = false; }
    }
    function renderStudents(students){
      const esc = value=>escapeHtml(value == null ? '' : value);
      const number = value=>Number.isFinite(value) ? Math.max(0,Math.floor(value)) : 0;
      students.sort((a,b)=>String(a.studentId).localeCompare(String(b.studentId),undefined,{numeric:true}));
      if(!students.length){
        content.innerHTML = '<div class="dash-empty">Connected. No student progress yet. Ask students to enter this class code and start an adventure.</div>';
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
      content.innerHTML = `<p><b>${students.length} ${students.length === 1 ? 'student' : 'students'}</b> · Latest session per student ID. Earlier sessions remain in the Sheet.</p>
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
    form.addEventListener('submit', event=>{
      event.preventDefault();
      if(loading) return;
      generation++;
      credentials = {classCode:document.getElementById('teacherClassCode').value.trim().toUpperCase(),key:document.getElementById('teacherAccessKey').value.trim()};
      refresh();
    });
    document.getElementById('teacherCloudRefresh').addEventListener('click',refresh);
    document.getElementById('teacherCloudLock').addEventListener('click',()=>{ lock(); interval = null; });
    global.addEventListener('pagehide',lock,{once:true});
  };
})(window);
