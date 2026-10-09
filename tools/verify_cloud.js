const assert = require('node:assert/strict');
const {makeBackend} = require('./cloud_test_support');
const backend = makeBackend();
let checks = 0;
function test(name,fn){fn();checks++;console.log('ok  '+name);}
const body = {
  action:'submit',classCode:'FT-TEST',studentId:'07',sessionId:'12345678-1234-1234-1234-123456789012',revision:1,
  payload:{name:'Ada',updatedAt:Date.now(),level:1,caughtCount:1,roundCaught:1,roundTarget:10,trainerBadges:[],bestStreak:1,records:[{
    fractling:'Halvo',tag:'Shading Type',question:'Half?',yourAnswer:'1/2',correctAnswer:'1/2',correct:true,attempts:2,wrongAttempts:1,neededHint:true,strategy:'Counted parts',confidence:'Very sure'
  }]}
};
const list = extra=>backend.send({action:'list',classCode:'FT-TEST',teacherKey:'private-test-key',...extra});
test('health exposes no student data',()=>assert.deepEqual(Object.keys(backend.health()).sort(),['ok','service','version']));
test('class code alone cannot read data',()=>assert.equal(list({teacherKey:''}).ok,false));
test('wrong class cannot submit',()=>assert.equal(backend.send({...body,classCode:'WRONG'}).ok,false));
test('first save produces one session row and preserves student ID',()=>{
  assert.equal(backend.send(body).ok,true);assert.equal(backend.rows.length,1);assert.equal(backend.rows[0][1],'07');
});
test('retry is idempotent',()=>{assert.equal(backend.send(body).ok,true);assert.equal(backend.rows.length,1);});
test('new revision updates same row; stale revision cannot undo it',()=>{
  assert.equal(backend.send({...body,revision:2,payload:{...body.payload,caughtCount:2}}).ok,true);
  const ack=backend.send(body);assert.equal(ack.revision,2);assert.equal(backend.rows.length,1);assert.equal(list().students[0].caughtCount,2);
});
test('session cannot be reassigned to a different student',()=>assert.equal(backend.send({...body,studentId:'08',revision:3}).ok,false));
test('teacher reads reflected answers and server sync time',()=>{
  const student=list().students[0];assert.equal(student.records[0].wrongAttempts,1);assert.ok(student.receivedAt);assert.equal(student.name,'Ada');
});
test('non-answer is never counted correct even if client claims it is',()=>{
  const copy=structuredClone(body);copy.revision=3;copy.payload.records=[{correct:true}];
  backend.send(copy);assert.equal(list().students[0].records[0].correct,false);
});
test('spreadsheet formulas are escaped; original text remains in JSON',()=>{
  backend.send({...body,revision:4,payload:{...body.payload,name:'=1+1',exitNote:'  =IMPORTXML("x")'}});
  assert.equal(backend.rows[0][6],'=1+1');assert.equal(backend.rows[0][19],'  =IMPORTXML("x")');assert.deepEqual(backend.formulaWrites,[]);assert.equal(list().students[0].name,'=1+1');
});
test('invalid record shape and oversized requests are rejected',()=>{
  assert.equal(backend.send({...body,payload:{name:'Ada',records:[null]}}).ok,false);
  assert.equal(backend.send({...body,payload:{name:'Ada',records:'bad'}}).ok,false);
  assert.equal(backend.send({...body,padding:'a'.repeat(49000)}).ok,false);
});
test('new sessions remain in Sheet while dashboard groups by student ID',()=>{
  backend.rows[0][4]=new Date(Date.now()-10000);
  assert.equal(backend.send({...body,sessionId:'22345678-1234-1234-1234-123456789012',payload:{...body.payload,name:'New session'}}).ok,true);
  assert.equal(backend.rows.length,2);assert.equal(list().students.length,1);assert.equal(list().students[0].name,'New session');
});
test('late update to older session does not replace latest session',()=>{
  backend.send({...body,revision:5});assert.equal(list().students[0].name,'New session');
});
test('malformed JSON returns safe error',()=>{
  const response=JSON.parse(backend.context.doPost({postData:{contents:'{bad'}}));assert.equal(response.ok,false);assert.equal(response.error,'Invalid JSON.');
});

/* ---------- Sessions: several classes, stop/start, archive/restore ---------- */
const key='private-test-key';
const teacher=extra=>backend.send({teacherKey:key,...extra});
const sessionsList=()=>teacher({action:'sessions'}).sessions;
let created;
const second={...body,studentId:'11',sessionId:'32345678-1234-1234-1234-123456789012',revision:1,payload:{...body.payload,name:'Bo'}};
test('unknown actions are refused, including inherited property names',()=>{
  for(const action of ['nope','constructor','__proto__','toString']) assert.equal(backend.send({action}).ok,false);
});
test('the single class code from the first version becomes the first open session',()=>{
  const sessions=sessionsList();
  assert.equal(sessions.length,1);assert.equal(sessions[0].code,'FT-TEST');assert.equal(sessions[0].status,'Open');assert.equal(sessions[0].students,1);
});
test('every session action needs the teacher key',()=>{
  for(const action of ['list','sessions','createSession','setStatus','archiveSession','restoreSession']){
    const response=backend.send({action,classCode:'FT-TEST',name:'x',status:'Closed'});assert.equal(response.ok,false);assert.equal(response.code,'auth');
  }
});
test('teacher creates a session with its own class code',()=>{
  const response=teacher({action:'createSession',name:'  3B Fractions  '});
  assert.equal(response.ok,true);created=response.session;
  assert.match(created.code,/^FT-[A-F0-9]{8}$/);assert.equal(created.name,'3B Fractions');assert.equal(created.status,'Open');
  assert.equal(sessionsList().length,2);
  assert.equal(teacher({action:'createSession',name:'   '}).ok,false);
});
test('students can check an open code without credentials and learn only its name',()=>{
  const ok=backend.send({action:'check',classCode:created.code});
  assert.deepEqual(Object.keys(ok).sort(),['name','ok']);assert.equal(ok.name,'3B Fractions');
  const bad=backend.send({action:'check',classCode:'FT-NOPE'});assert.equal(bad.ok,false);assert.equal(bad.code,'unknown');
});
test('each session only shows its own students',()=>{
  assert.equal(backend.send({...second,classCode:created.code}).ok,true);
  assert.deepEqual(teacher({action:'list',classCode:created.code}).students.map(s=>s.name),['Bo']);
  assert.ok(!list().students.some(s=>s.name==='Bo'));
  assert.equal(teacher({action:'list',classCode:'FT-NOPE'}).code,'unknown');
});
test('a stopped session rejects new results but keeps what it has',()=>{
  const rowsBefore=backend.dataRows('Progress').length;
  assert.equal(teacher({action:'setStatus',classCode:created.code,status:'Closed'}).ok,true);
  const refused=backend.send({...second,classCode:created.code,revision:2});
  assert.equal(refused.ok,false);assert.equal(refused.code,'closed');
  assert.equal(backend.send({action:'check',classCode:created.code}).code,'closed');
  assert.equal(teacher({action:'list',classCode:created.code}).students.length,1);
  assert.equal(backend.dataRows('Progress').length,rowsBefore);
  assert.equal(sessionsList().find(s=>s.code===created.code).status,'Closed');
  assert.equal(backend.send({...body,revision:9}).ok,true);
});
test('starting a stopped session lets students send results again',()=>{
  assert.equal(teacher({action:'setStatus',classCode:created.code,status:'Open'}).ok,true);
  assert.equal(backend.send({...second,classCode:created.code,revision:2}).ok,true);
  assert.equal(sessionsList().find(s=>s.code===created.code).closedAt,null);
  assert.equal(teacher({action:'setStatus',classCode:created.code,status:'Deleted'}).ok,false);
});
test('archiving moves a session to the Archive tab and keeps every other class untouched',()=>{
  const progressBefore=backend.dataRows('Progress').length;
  const response=teacher({action:'archiveSession',classCode:created.code});
  assert.equal(response.ok,true);assert.equal(response.moved,1);
  assert.equal(backend.dataRows('Progress').length,progressBefore-1);
  assert.ok(backend.dataRows('Progress').every(row=>row[0]==='FT-TEST'));
  assert.equal(backend.dataRows('Archive').length,1);assert.equal(backend.dataRows('Archive')[0][1],'11');
  const archived=sessionsList().find(s=>s.code===created.code);
  assert.equal(archived.status,'Archived');assert.equal(archived.students,1);assert.ok(archived.archivedAt);
  assert.equal(backend.send({...second,classCode:created.code,revision:3}).code,'unknown');
  assert.equal(backend.send({action:'check',classCode:created.code}).code,'unknown');
  assert.equal(teacher({action:'list',classCode:created.code}).code,'unknown');
  assert.equal(teacher({action:'setStatus',classCode:created.code,status:'Open'}).code,'unknown');
  assert.equal(teacher({action:'archiveSession',classCode:created.code}).ok,false);
  assert.equal(list().students.length,1);
});
test('restoring returns the results, and the session comes back stopped',()=>{
  const response=teacher({action:'restoreSession',classCode:created.code});
  assert.equal(response.ok,true);assert.equal(response.moved,1);
  assert.equal(backend.dataRows('Archive').length,0);
  assert.equal(sessionsList().find(s=>s.code===created.code).status,'Closed');
  assert.deepEqual(teacher({action:'list',classCode:created.code}).students.map(s=>s.name),['Bo']);
  assert.equal(backend.send({...second,classCode:created.code,revision:3}).code,'closed');
  assert.equal(teacher({action:'restoreSession',classCode:created.code}).ok,false);
  assert.equal(teacher({action:'setStatus',classCode:created.code,status:'Open'}).ok,true);
  assert.equal(backend.send({...second,classCode:created.code,revision:3}).ok,true);
});
test('formula-like text stays text through archive and restore',()=>{
  const risky=teacher({action:'createSession',name:'=HYPERLINK("x")'}).session;
  const third={...body,classCode:risky.code,studentId:'12',sessionId:'42345678-1234-1234-1234-123456789012',payload:{...body.payload,name:'=2+2',exitNote:'-9 maybe'}};
  assert.equal(backend.send(third).ok,true);
  assert.equal(teacher({action:'archiveSession',classCode:risky.code}).ok,true);
  assert.equal(teacher({action:'restoreSession',classCode:risky.code}).ok,true);
  assert.equal(teacher({action:'list',classCode:risky.code}).students[0].name,'=2+2');
  assert.equal(sessionsList().find(s=>s.code===risky.code).name,'=HYPERLINK("x")');
  assert.deepEqual(backend.formulaWrites,[]);
});
test('a new install starts with no sessions, so nobody can join until one is created',()=>{
  const fresh=makeBackend();delete fresh.props.CLASS_CODE;
  assert.deepEqual(fresh.send({action:'sessions',teacherKey:key}).sessions,[]);
  assert.equal(fresh.send(body).code,'unknown');
});
console.log(`${checks}/${checks} cloud server checks passed`);
