const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

// Emulates just enough of Google Sheets for the server code: tabs, ranges, and the
// text-escaping rules that stop student text becoming a formula.
function makeBackend(){
  const props = {SPREADSHEET_ID:'test-book',CLASS_CODE:'FT-TEST',TEACHER_KEY:'private-test-key'};
  const sheets = Object.create(null);
  const formulaWrites = [];
  let locked = false;
  const chain = new Proxy({},{get:()=>()=>chain});

  function makeSheet(name){
    const header = [];
    const data = [];
    const blank = row=>!row || row.every(cell=>cell === '' || cell === undefined);
    const lineAt = r=> r === 1 ? header : (data[r - 2] = data[r - 2] || []);
    const sheet = {
      name, header, data,
      getLastRow:()=>{
        for(let i = data.length - 1; i >= 0; i--) if(!blank(data[i])) return i + 2;
        return header.length ? 1 : 0;
      },
      getMaxRows:()=>10000,
      getRange:(row,col,height,width)=>{
        if(typeof row === 'string') return chain;
        const range = new Proxy({
          getValues:()=>Array.from({length:height},(_,i)=>{
            const line = row + i === 1 ? header : (data[row + i - 2] || []);
            return Array.from({length:width},(_,j)=>line[col - 1 + j] === undefined ? '' : line[col - 1 + j]);
          }),
          setValues:values=>{
            values.forEach((cells,i)=>{
              const line = lineAt(row + i);
              cells.forEach((cell,j)=>{
                let stored = cell;
                if(typeof cell === 'string'){
                  // A leading apostrophe forces text and is not stored; an unescaped = + - @ would be parsed as a formula.
                  if(cell.startsWith("'")) stored = cell.slice(1);
                  else if(/^[=+\-@]/.test(cell)) formulaWrites.push(cell);
                }
                line[col - 1 + j] = stored;
              });
            });
            return range;
          },
          clearContent:()=>{
            for(let i = 0; i < height; i++){
              const line = lineAt(row + i);
              for(let j = 0; j < width; j++) line[col - 1 + j] = '';
            }
            return range;
          }
        },{get:(target,key)=> key in target ? target[key] : ()=>range});
        return range;
      }
    };
    return new Proxy(sheet,{get:(target,key)=> key in target ? target[key] : ()=>undefined});
  }
  sheets.Progress = makeSheet('Progress');
  sheets.Progress.header[0] = 'Class'; // setupFractionTrails has already written the header row

  const book = {
    getSheetByName:name=>sheets[name] || null,
    insertSheet:name=>(sheets[name] = makeSheet(name)),
    getId:()=>'test-book',
    toast:()=>{}
  };
  const lock = {tryLock:()=>{ if(locked) return false; locked = true; return true; },releaseLock:()=>{ locked = false; }};
  const context = vm.createContext({
    console,
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props[key],setProperty:(key,value)=>{ props[key] = value; }})},
    SpreadsheetApp:{openById:()=>book,getActiveSpreadsheet:()=>book,flush:()=>{}},
    LockService:{getScriptLock:()=>lock},
    Utilities:{getUuid:()=>crypto.randomUUID()},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../google-apps-script/Code.gs'),'utf8'),context);
  const nonBlank = name=>{
    const sheet = sheets[name];
    return sheet ? sheet.data.filter(row=>row && row.some(cell=>cell !== '' && cell !== undefined)) : [];
  };
  return {
    rows:sheets.Progress.data,context,props,sheets,formulaWrites,
    dataRows:nonBlank,
    send:body=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(body)}})),
    health:()=>JSON.parse(context.doGet())
  };
}
module.exports = {makeBackend};
