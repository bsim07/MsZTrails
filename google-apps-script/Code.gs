/** Fraction Trails: paste into a Sheet-bound Apps Script project.
 * Run setupFractionTrails once, then deploy as a web app (owner / Anyone).
 * Credentials are generated in Script Properties and the PRIVATE Connection tab.
 */
const FT_HEADERS = [
  'Class', 'Student ID', 'Session ID', 'Revision', 'First received at', 'Received at',
  'Name', 'Level', 'Caught', 'Round caught', 'Round target', 'Trainer badges',
  'Best streak', 'Boss correct', 'Boss total', 'Boss passed',
  'Correct records', 'Wrong attempts', 'Hints used', 'Reflection', 'Payload JSON'
];

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
  if(!props.getProperty('CLASS_CODE')) props.setProperty('CLASS_CODE','FT-' + Utilities.getUuid().slice(0,8).toUpperCase());
  if(!props.getProperty('TEACHER_KEY')) props.setProperty('TEACHER_KEY',Utilities.getUuid() + Utilities.getUuid());
  const connection = book.getSheetByName('Connection') || book.insertSheet('Connection');
  connection.getRange(1,1,5,2).setValues([
    ['Fraction Trails connection','Keep this spreadsheet private'],
    ['Class code',props.getProperty('CLASS_CODE')],
    ['Teacher access key',props.getProperty('TEACHER_KEY')],
    ['Student access','Share only the class code and the game link'],
    ['Teacher access','Enter both values in the game Teacher Dashboard']
  ]);
  connection.getRange('A1:B1').setFontWeight('bold').setBackground('#dcefd8');
  connection.setColumnWidth(1,180);
  connection.setColumnWidth(2,560);
  connection.getRange('A1:B5').setWrap(true);
  book.toast('Ready. Your class code and teacher key are on the Connection tab.');
}

function doGet(){
  return ftJson_({ok:true, service:'Fraction Trails', version:1});
}

function doPost(e){
  try {
    const raw = e && e.postData && e.postData.contents;
    if(!raw || raw.length > 48000) throw new Error('Invalid or oversized request.');
    const request = JSON.parse(raw);
    const props = PropertiesService.getScriptProperties();
    const classCode = props.getProperty('CLASS_CODE');
    if(!classCode || !props.getProperty('SPREADSHEET_ID')) throw new Error('Run setupFractionTrails first.');
    if(!request || request.classCode !== classCode) throw new Error('Check the class code with your teacher.');
    if(request.action === 'submit') return ftJson_(ftSubmit_(request, props));
    if(request.action === 'list'){
      if(!request.teacherKey || request.teacherKey !== props.getProperty('TEACHER_KEY')) throw new Error('Incorrect teacher access key.');
      return ftJson_(ftList_(props));
    }
    throw new Error('Unknown action.');
  } catch(error){
    // No stack traces, spreadsheet identifiers or credentials in public responses.
    return ftJson_({ok:false, error:error instanceof SyntaxError ? 'Invalid JSON.' : error.message || 'Unable to process the request.'});
  }
}

function ftJson_(value){
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
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
function ftSheet_(props){
  const sheet = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID')).getSheetByName('Progress');
  if(!sheet) throw new Error('Progress tab missing. Run setupFractionTrails.');
  return sheet;
}
function ftSubmit_(request, props){
  if(typeof request.studentId !== 'string' || !/^[A-Z0-9_-]{1,24}$/.test(request.studentId)) throw new Error('Use a student number or ID with letters, digits, hyphens or underscores.');
  if(typeof request.sessionId !== 'string' || !/^[a-f0-9-]{36}$/.test(request.sessionId)) throw new Error('Invalid session.');
  if(!Number.isSafeInteger(request.revision) || request.revision < 1) throw new Error('Invalid revision.');
  const payload = ftPayload_(request.payload);
  const lock = LockService.getScriptLock();
  if(!lock.tryLock(10000)) throw new Error('Class is busy syncing. Please retry.');
  try {
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
    if(row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),100);
    sheet.getRange(row,1,1,FT_HEADERS.length).setValues([values]);
    SpreadsheetApp.flush();
    return {ok:true,sessionId:request.sessionId,revision:request.revision};
  } finally { lock.releaseLock(); }
}
function ftList_(props){
  const sheet = ftSheet_(props);
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,FT_HEADERS.length).getValues() : [];
  const students = Object.create(null);
  rows.forEach(row=>{
    if(row[0] !== props.getProperty('CLASS_CODE')) return;
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
  return {ok:true, students:Object.values(students), fetchedAt:Date.now()};
}
