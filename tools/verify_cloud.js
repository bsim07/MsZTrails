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
  assert.ok(backend.rows[0][6].startsWith("'="));assert.ok(backend.rows[0][19].startsWith("'"));assert.equal(list().students[0].name,'=1+1');
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
console.log(`${checks}/${checks} cloud server checks passed`);
