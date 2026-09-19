const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeBackend(){
  const rows = [];
  const props = {SPREADSHEET_ID:'test-book',CLASS_CODE:'FT-TEST',TEACHER_KEY:'private-test-key'};
  let locked = false;
  const sheet = {
    getLastRow:()=>rows.length+1,
    getMaxRows:()=>10000,
    getRange:(row,col,height,width)=>({
      getValues:()=>rows.slice(row-2,row-2+height).map(r=>r.slice(col-1,col-1+width)),
      setValues:values=>{ values.forEach((r,i)=>{rows[row-2+i]=r;}); }
    })
  };
  const context = vm.createContext({
    console,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key]})},
    SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush:()=>{}},
    LockService:{getScriptLock:()=>({tryLock:()=>{ if(locked) return false; locked=true; return true; },releaseLock:()=>{locked=false;}})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../google-apps-script/Code.gs'),'utf8'),context);
  return {
    rows,context,
    send:body=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}})),
    health:()=>JSON.parse(context.doGet())
  };
}
module.exports = {makeBackend};
