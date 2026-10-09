/** Fraction Trails: paste into a Sheet-bound Apps Script project.
 * Run setupFractionTrails once, then deploy as a web app (owner / Anyone).
 * The teacher key is generated in Script Properties and shown on the PRIVATE Connection tab.
 * Class sessions (each with its own class code) are created and managed in the game's Teacher Dashboard.
 */
const FT_HEADERS = [
  'Class', 'Student ID', 'Session ID', 'Revision', 'First received at', 'Received at',
  'Name', 'Level', 'Caught', 'Round caught', 'Round target', 'Trainer badges',
  'Best streak', 'Boss correct', 'Boss total', 'Boss passed',
  'Correct records', 'Wrong attempts', 'Hints used', 'Reflection', 'Payload JSON'
];
const FT_SESSION_HEADERS = ['Code', 'Name', 'Status', 'Created at', 'Closed at', 'Archived at'];

function setupFractionTrails(){
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if(!book) throw new Error('Open your Google Sheet, then Extensions > Apps Script.');
  const props = PropertiesService.getScriptProperties();
  if(props.getProperty('SPREADSHEET_ID') && props.getProperty('SPREADSHEET_ID') !== book.getId()){
    throw new Error('This script is already connected to a different spreadsheet.');
  }
  const results = book.getSheetByName('Progress') || book.insertSheet('Progress');
  if(results.getLastRow() && JSON.stringify(results.getRange(1,1,1,FT_HEADERS.length).getValues()[0]) !== JSON.stringify(FT_HEADERS)){
    throw new Error('The existing Progress tab has different headers. Rename it before setup.');
  }
  results.getRange(1,1,1,FT_HEADERS.length).setValues([FT_HEADERS]).setFontWeight('bold').setBackground('#dcefd8');
  results.setFrozenRows(1);
  results.getRange('A:C').setNumberFormat('@');
  results.getRange('E:F').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  results.autoResizeColumns(1,20);
  results.setColumnWidth(20,280);
  results.setColumnWidth(21,180);
  props.setProperty('SPREADSHEET_ID', book.getId());
  if(!props.getProperty('TEACHER_KEY')) props.setProperty('TEACHER_KEY',Utilities.getUuid() + Utilities.getUuid());
  // A class code from the single-class version becomes the first session, so existing results stay visible.
  ftSessionsSheet_(props);
  ftArchiveSheet_(props);
  const connection = book.getSheetByName('Connection') || book.insertSheet('Connection');
  connection.getRange(1,1,5,2).setValues([
    ['Fraction Trails connection','Keep this spreadsheet private'],
    ['Teacher access key',props.getProperty('TEACHER_KEY')],
    ['Class codes','Create, stop and archive sessions in the game Teacher Dashboard. See the Sessions tab.'],
    ['Student access','Share the QR code or class code of an open session, plus the game link'],
    ['Teacher access','Enter the teacher access key in the game Teacher Dashboard']
  ]);
  connection.getRange('A1:B1').setFontWeight('bold').setBackground('#dcefd8');
  connection.setColumnWidth(1,180);
  connection.setColumnWidth(2,560);
  connection.getRange('A1:B5').setWrap(true);
  book.toast('Ready. Your teacher key is on the Connection tab; create sessions in the Teacher Dashboard.');
}

function doGet(){
  return ftJson_({ok:true, service:'Fraction Trails', version:2});
}

function doPost(e){
  try {
    const raw = e && e.postData && e.postData.contents;
    if(!raw || raw.length > 48000) throw ftErr_('Invalid or oversized request.', 'invalid');
    const request = JSON.parse(raw);
    if(!request || typeof request !== 'object') throw ftErr_('Invalid request.', 'invalid');
    const props = PropertiesService.getScriptProperties();
    if(!props.getProperty('SPREADSHEET_ID')) throw ftErr_('Run setupFractionTrails first.', 'setup');
    if(request.action === 'check') return ftJson_(ftCheck_(request, props));
    if(request.action === 'submit') return ftJson_(ftSubmit_(request, props));
    if(['list','sessions','createSession','setStatus','archiveSession','restoreSession'].indexOf(request.action) < 0){
      throw ftErr_('Unknown action.', 'invalid');
    }
    ftRequireTeacher_(request, props);
    switch(request.action){
      case 'list': return ftJson_(ftList_(request, props));
      case 'sessions': return ftJson_(ftSessionsList_(props));
      case 'createSession': return ftJson_(ftCreateSession_(request, props));
      case 'setStatus': return ftJson_(ftSetStatus_(request, props));
      case 'archiveSession': return ftJson_(ftArchive_(request, props));
      default: return ftJson_(ftRestore_(request, props));
    }
  } catch(error){
    // No stack traces, spreadsheet identifiers or credentials in public responses.
    return ftJson_({ok:false, error:error instanceof SyntaxError ? 'Invalid JSON.' : error.message || 'Unable to process the request.', code:error && error.code});
  }
}

function ftJson_(value){
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function ftErr_(message, code){
  const error = new Error(message);
  error.code = code;
  return error;
}
function ftText_(value, limit){
  return typeof value === 'string' ? value.slice(0,limit) : '';
}
function ftNumber_(value, max){
  return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
}
function ftCell_(value){
  // User text must never become a Google Sheets formula.
  return typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
}
function ftTime_(value){
  return value ? new Date(value).getTime() : null;
}
function ftWithLock_(work){
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(10000)) throw ftErr_('Class is busy syncing. Please retry.', 'busy');
  try { return work(); } finally { lock.releaseLock(); }
}
function ftRequireTeacher_(request, props){
  const key = props.getProperty('TEACHER_KEY');
  if(!key || typeof request.teacherKey !== 'string' || request.teacherKey !== key) throw ftErr_('Incorrect teacher access key.', 'auth');
}

/* ---------- Sheets ---------- */
function ftBook_(props){
  return SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
}
function ftSheet_(props){
  const sheet = ftBook_(props).getSheetByName('Progress');
  if(!sheet) throw new Error('Progress tab missing. Run setupFractionTrails.');
  return sheet;
}
function ftSessionsSheet_(props){
  const book = ftBook_(props);
  let sheet = book.getSheetByName('Sessions');
  if(sheet) return sheet;
  sheet = book.insertSheet('Sessions');
  sheet.getRange(1,1,1,FT_SESSION_HEADERS.length).setValues([FT_SESSION_HEADERS]).setFontWeight('bold').setBackground('#dcefd8');
  sheet.setFrozenRows(1);
  sheet.getRange('A:C').setNumberFormat('@');
  sheet.getRange('D:F').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sheet.setColumnWidth(2,260);
  const legacyCode = props.getProperty('CLASS_CODE');
  if(legacyCode) sheet.getRange(2,1,1,FT_SESSION_HEADERS.length).setValues([[legacyCode,'Class 1','Open',new Date(),'','']]);
  return sheet;
}
function ftArchiveSheet_(props){
  const book = ftBook_(props);
  let sheet = book.getSheetByName('Archive');
  if(sheet) return sheet;
  sheet = book.insertSheet('Archive');
  sheet.getRange(1,1,1,FT_HEADERS.length).setValues([FT_HEADERS]).setFontWeight('bold').setBackground('#f0e3d0');
  sheet.setFrozenRows(1);
  sheet.getRange('A:C').setNumberFormat('@');
  sheet.getRange('E:F').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  return sheet;
}
function ftRows_(sheet, width){
  const last = sheet.getLastRow();
  return last > 1 ? sheet.getRange(2,1,last-1,width).getValues() : [];
}
function ftEnsureRows_(sheet, lastNeeded){
  const max = sheet.getMaxRows();
  if(lastNeeded > max) sheet.insertRowsAfter(max, lastNeeded - max + 100);
}
function ftAppendRows_(sheet, rows){
  if(!rows.length) return;
  const start = sheet.getLastRow() + 1;
  ftEnsureRows_(sheet, start + rows.length - 1);
  // Values read back from a sheet lose their escaping apostrophe, so escape again before writing.
  sheet.getRange(start,1,rows.length,FT_HEADERS.length).setValues(rows.map(r=>r.map(ftCell_)));
}
function ftReplaceRows_(sheet, oldCount, rows){
  if(oldCount) sheet.getRange(2,1,oldCount,FT_HEADERS.length).clearContent();
  if(rows.length) sheet.getRange(2,1,rows.length,FT_HEADERS.length).setValues(rows.map(r=>r.map(ftCell_)));
}

/* ---------- Sessions ---------- */
function ftReadSessions_(props){
  return ftRows_(ftSessionsSheet_(props), FT_SESSION_HEADERS.length).map((r,i)=>({
    row:i+2, raw:r, code:String(r[0]), name:String(r[1]), status:String(r[2]).trim(),
    createdAt:ftTime_(r[3]), closedAt:ftTime_(r[4]), archivedAt:ftTime_(r[5])
  })).filter(s=>s.code);
}
function ftFindSession_(props, code){
  if(typeof code !== 'string' || !code) return null;
  return ftReadSessions_(props).find(s=>s.code === code) || null;
}
function ftOpenSession_(props, code){
  const session = ftFindSession_(props, code);
  if(!session || session.status === 'Archived') throw ftErr_('Check the class code with your teacher.', 'unknown');
  if(session.status !== 'Open') throw ftErr_('This session has been closed by your teacher.', 'closed');
  return session;
}
function ftPublicSession_(s){
  return {code:s.code, name:s.name, status:s.status, createdAt:s.createdAt, closedAt:s.closedAt, archivedAt:s.archivedAt};
}
function ftWriteSession_(props, session, status, closedAt, archivedAt){
  const next = session.raw.slice();
  next[2] = status;
  next[4] = closedAt;
  next[5] = archivedAt;
  ftSessionsSheet_(props).getRange(session.row,1,1,FT_SESSION_HEADERS.length).setValues([next.map(ftCell_)]);
}

function ftCheck_(request, props){
  return {ok:true, name:ftOpenSession_(props, request.classCode).name};
}

function ftSessionsList_(props){
  const counts = Object.create(null);
  const tally = rows=>rows.forEach(r=>{
    const code = String(r[0]);
    (counts[code] = counts[code] || Object.create(null))[String(r[1])] = true;
  });
  tally(ftRows_(ftSheet_(props), FT_HEADERS.length));
  const archive = ftBook_(props).getSheetByName('Archive');
  if(archive) tally(ftRows_(archive, FT_HEADERS.length));
  const sessions = ftReadSessions_(props).map(s=>Object.assign(ftPublicSession_(s), {students:Object.keys(counts[s.code] || {}).length}));
  return {ok:true, sessions, fetchedAt:Date.now()};
}

function ftCreateSession_(request, props){
  const name = ftText_(request.name, 60).trim();
  if(!name) throw ftErr_('Enter a name for the session, for example the class and lesson.', 'invalid');
  return ftWithLock_(()=>{
    const sheet = ftSessionsSheet_(props);
    const existing = ftReadSessions_(props);
    let code;
    do { code = 'FT-' + Utilities.getUuid().slice(0,8).toUpperCase(); } while(existing.some(s=>s.code === code));
    const row = sheet.getLastRow() + 1;
    ftEnsureRows_(sheet, row);
    const created = new Date();
    sheet.getRange(row,1,1,FT_SESSION_HEADERS.length).setValues([[code, name, 'Open', created, '', ''].map(ftCell_)]);
    SpreadsheetApp.flush();
    return {ok:true, session:{code, name, status:'Open', createdAt:created.getTime(), closedAt:null, archivedAt:null, students:0}};
  });
}

function ftSetStatus_(request, props){
  if(request.status !== 'Open' && request.status !== 'Closed') throw ftErr_('Invalid status.', 'invalid');
  return ftWithLock_(()=>{
    const session = ftFindSession_(props, request.classCode);
    if(!session || session.status === 'Archived') throw ftErr_('Session not found.', 'unknown');
    const closedAt = request.status === 'Closed' ? (session.status === 'Closed' && session.raw[4] ? session.raw[4] : new Date()) : '';
    ftWriteSession_(props, session, request.status, closedAt, '');
    SpreadsheetApp.flush();
    return {ok:true, code:session.code, status:request.status};
  });
}

// Archiving copies the rows to the Archive tab first and only then removes them, so a failure never loses results.
function ftArchive_(request, props){
  return ftWithLock_(()=>{
    const session = ftFindSession_(props, request.classCode);
    if(!session) throw ftErr_('Session not found.', 'unknown');
    if(session.status === 'Archived') throw ftErr_('That session is already archived.', 'invalid');
    const progress = ftSheet_(props);
    const rows = ftRows_(progress, FT_HEADERS.length);
    const moving = rows.filter(r=>String(r[0]) === session.code);
    if(moving.length){
      ftAppendRows_(ftArchiveSheet_(props), moving);
      ftReplaceRows_(progress, rows.length, rows.filter(r=>String(r[0]) !== session.code));
    }
    ftWriteSession_(props, session, 'Archived', session.raw[4] || new Date(), new Date());
    SpreadsheetApp.flush();
    return {ok:true, code:session.code, moved:moving.length};
  });
}

// A restored session comes back Closed, so students cannot join until the teacher starts it again.
function ftRestore_(request, props){
  return ftWithLock_(()=>{
    const session = ftFindSession_(props, request.classCode);
    if(!session || session.status !== 'Archived') throw ftErr_('Archived session not found.', 'unknown');
    const archive = ftArchiveSheet_(props);
    const rows = ftRows_(archive, FT_HEADERS.length);
    const moving = rows.filter(r=>String(r[0]) === session.code);
    if(moving.length){
      ftAppendRows_(ftSheet_(props), moving);
      ftReplaceRows_(archive, rows.length, rows.filter(r=>String(r[0]) !== session.code));
    }
    ftWriteSession_(props, session, 'Closed', session.raw[4] || new Date(), '');
    SpreadsheetApp.flush();
    return {ok:true, code:session.code, moved:moving.length};
  });
}

/* ---------- Student results ---------- */
function ftPayload_(raw){
  if(!raw || typeof raw !== 'object' || !Array.isArray(raw.records) || raw.records.length > 25 || !ftText_(raw.name,18).trim()){
    throw new Error('Invalid student results.');
  }
  const payload = {
    name:ftText_(raw.name,18), updatedAt:ftNumber_(raw.updatedAt,8640000000000000),
    level:Math.max(1,ftNumber_(raw.level,3)), caughtCount:ftNumber_(raw.caughtCount,25),
    roundCaught:ftNumber_(raw.roundCaught,25), roundTarget:ftNumber_(raw.roundTarget,25),
    bossPassed:raw.bossPassed === true,
    bossCorrect:ftNumber_(raw.bossCorrect,6), bossTotal:ftNumber_(raw.bossTotal,6),
    bestStreak:ftNumber_(raw.bestStreak,10000), exitNote:ftText_(raw.exitNote,1000),
    trainerBadges:Array.isArray(raw.trainerBadges) ? raw.trainerBadges.slice(0,3).map(x=>ftText_(x,20)) : [],
    records:raw.records.map(r=>{
      if(!r || typeof r !== 'object') throw new Error('Invalid question record.');
      return {
        fractling:ftText_(r.fractling,60),tag:ftText_(r.tag,60),question:ftText_(r.question,500),
        yourAnswer:ftText_(r.yourAnswer,120),correctAnswer:ftText_(r.correctAnswer,120),
        correct:typeof r.yourAnswer === 'string' && typeof r.correctAnswer === 'string' && r.correctAnswer.length > 0 && r.yourAnswer === r.correctAnswer,
        attempts:ftNumber_(r.attempts,10000),wrongAttempts:ftNumber_(r.wrongAttempts,10000),
        neededHint:r.neededHint === true,strategy:ftText_(r.strategy,300),confidence:ftText_(r.confidence,40)
      };
    })
  };
  if(JSON.stringify(payload).length > 44000) throw new Error('Results are too large.');
  return payload;
}
function ftSubmit_(request, props){
  if(typeof request.studentId !== 'string' || !/^[A-Z0-9_-]{1,24}$/.test(request.studentId)) throw new Error('Use a student number or ID with letters, digits, hyphens or underscores.');
  if(typeof request.sessionId !== 'string' || !/^[a-f0-9-]{36}$/.test(request.sessionId)) throw new Error('Invalid session.');
  if(!Number.isSafeInteger(request.revision) || request.revision < 1) throw new Error('Invalid revision.');
  const payload = ftPayload_(request.payload);
  return ftWithLock_(()=>{
    // Checked inside the lock so a session cannot be archived between the check and the write.
    ftOpenSession_(props, request.classCode);
    const sheet = ftSheet_(props);
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues() : [];
    const index = rows.findIndex(r=>r[2] === request.sessionId);
    if(index >= 0 && (rows[index][0] !== request.classCode || rows[index][1] !== request.studentId)) throw new Error('Session identity mismatch.');
    if(index >= 0 && Number(rows[index][3]) >= request.revision){
      return {ok:true,sessionId:request.sessionId,revision:Number(rows[index][3])};
    }
    const receivedAt = new Date();
    // Preserve first receipt on retries, independent of an unreliable student device clock.
    const startedAt = index >= 0 ? rows[index][4] : receivedAt;
    const values = [request.classCode,request.studentId,request.sessionId,request.revision,startedAt,receivedAt,
      payload.name,payload.level,payload.caughtCount,payload.roundCaught,payload.roundTarget,
      payload.trainerBadges.length,payload.bestStreak,payload.bossCorrect,payload.bossTotal,payload.bossPassed,
      payload.records.filter(r=>r.correct).length,payload.records.reduce((n,r)=>n+r.wrongAttempts,0),
      payload.records.filter(r=>r.neededHint).length,payload.exitNote,JSON.stringify(payload)].map(ftCell_);
    const row = index >= 0 ? index+2 : sheet.getLastRow()+1;
    ftEnsureRows_(sheet, row);
    sheet.getRange(row,1,1,FT_HEADERS.length).setValues([values]);
    SpreadsheetApp.flush();
    return {ok:true,sessionId:request.sessionId,revision:request.revision};
  });
}
function ftList_(request, props){
  const session = ftFindSession_(props, request.classCode);
  if(!session || session.status === 'Archived') throw ftErr_('Session not found.', 'unknown');
  const rows = ftRows_(ftSheet_(props), FT_HEADERS.length);
  const students = Object.create(null);
  rows.forEach(row=>{
    if(String(row[0]) !== session.code) return;
    try {
      const payload = ftPayload_(JSON.parse(row[20]));
      const previous = students[row[1]];
      const startedAt = new Date(row[4]).getTime();
      const receivedAt = new Date(row[5]).getTime();
      if(!previous || startedAt > previous.startedAt || (startedAt === previous.startedAt && receivedAt > previous.receivedAt)){
        students[row[1]] = Object.assign(payload,{studentId:String(row[1]),sessionId:String(row[2]),startedAt,receivedAt});
      }
    } catch(e){ /* Ignore an accidentally edited or incomplete row. */ }
  });
  return {ok:true, session:ftPublicSession_(session), students:Object.values(students), fetchedAt:Date.now()};
}
