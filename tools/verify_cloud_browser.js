/* Real browser/client integration against the actual server code with in-memory Sheets.
 * No Google account, student data or production endpoint is used.
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const {chromium} = require('playwright');
const {makeBackend} = require('./cloud_test_support');
const root = path.resolve(__dirname,'..');
const endpoint = 'https://script.google.com/macros/s/TEST_DEPLOYMENT/exec';
const backend = makeBackend();
const errors=[];
let checks=0;
const check=(name,pass)=>{assert.ok(pass,name);checks++;console.log('ok  '+name);};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try {
    let text=fs.readFileSync(file);
    if(file.endsWith('cloud-config.js')) text=Buffer.from(`window.FRACTION_TRAILS_CONFIG={sheetsUrl:'${endpoint}'};`);
    if(file.endsWith('game.js')) text=Buffer.from(text.toString().replace('window.initFractionTrails = initFractionTrails;',
      'window.initFractionTrails = initFractionTrails; window.cloudTest={state,startEncounter,startBossBattle,finishBoss};'));
    const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(text);
  } catch(e){res.writeHead(404);res.end();}
});

(async()=>{
  let browser;
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({channel:'chrome'});
    const student=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
    const teacher=await browser.newContext({serviceWorkers:'block'});
    let rejectStudent=false;
    let holdSubmission=null;
    let heldResolve=null;
    let submitCount=0;
    async function routeApi(route){
      const request=route.request();
      if(request.method() === 'OPTIONS'){
        await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type'}});return;
      }
      const body=JSON.parse(request.postData());
      if(body.action === 'submit'){
        submitCount++;
        if(rejectStudent){await route.abort('failed');return;}
        if(holdSubmission){heldResolve();await holdSubmission;holdSubmission=null;}
      }
      const result=backend.send(body);
      await route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(result)});
    }
    await student.route(endpoint,routeApi);
    await teacher.route(endpoint,routeApi);
    let page=await student.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);
    check('configured game shows class/student fields',await page.locator('#classJoin').isVisible());
    check('configured phone title has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(root,'test-results/cloud-student.png'),fullPage:true});
    await page.fill('#nameInput','Ada');
    await page.click('#startBtn');
    check('missing class prevents start',await page.locator('#screen-title').isVisible());
    await page.fill('#classCodeInput','ft-test');await page.fill('#studentIdInput','07');await page.click('#startBtn');
    await page.waitForFunction(()=>document.getElementById('cloudSyncStatus').textContent.startsWith('Synced'));
    check('new student reaches Sheet without manual export',backend.rows.length===1 && backend.rows[0][1]==='07');
    check('queue cleared only after acknowledgement',await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ft_sheets_pending_v1:')).length===0));

    const dashboard=await teacher.newPage();dashboard.on('pageerror',e=>errors.push(e.message));
    await dashboard.goto(origin+'/?teacher=dashboard');
    await dashboard.fill('#teacherClassCode','FT-TEST');await dashboard.fill('#teacherAccessKey','wrong-key');await dashboard.click('#teacherConnectForm button');
    await dashboard.waitForFunction(()=>document.getElementById('teacherCloudStatus').textContent.includes('Incorrect'));
    check('wrong key reveals no student results',!(await dashboard.locator('#dashContent').textContent()).includes('Ada'));
    await dashboard.fill('#teacherAccessKey','private-test-key');await dashboard.click('#teacherConnectForm button');
    await dashboard.locator('.dash-table').waitFor();
    check('independent teacher browser sees student', (await dashboard.locator('.dash-table').textContent()).includes('Ada'));
    check('teacher key absent from storage and URL',await dashboard.evaluate(()=>!JSON.stringify(localStorage).includes('private-test-key')&&!JSON.stringify(sessionStorage).includes('private-test-key')&&!location.href.includes('private-test-key')));

    await page.evaluate(()=>cloudTest.startEncounter(0));
    await page.locator('#optionsWrap button').nth(1).click();
    await page.waitForFunction(()=>FTCloud.getStatus().startsWith('Synced'));
    const wrongRecord=JSON.parse(backend.rows[0][20]).records[0];
    check('wrong answer syncs as incorrect with hint and attempt count',wrongRecord.correct===false && wrongRecord.wrongAttempts===1 && wrongRecord.neededHint===true);
    await page.locator('#optionsWrap button').first().click();
    await page.locator('#stratList button').first().waitFor();
    await page.locator('#stratList button').first().click();await page.locator('#confRow button').last().click();await page.click('#catchBtn');
    await page.waitForFunction(()=>cloudTest.state.caught[0]===true);
    await page.waitForFunction(()=>document.getElementById('cloudSyncStatus').textContent.startsWith('Synced'));
    check('catch updates existing row with reflection',backend.rows.length===1 && JSON.parse(backend.rows[0][20]).records[0].confidence==='Very sure');
    await dashboard.click('#teacherCloudRefresh');await dashboard.waitForFunction(()=>document.querySelector('.cloud-record')?.textContent.includes('Very sure'));
    check('teacher receives caught progress and strategy', (await dashboard.locator('.cloud-record').textContent()).includes('counted'));
    await dashboard.locator('.student-details summary').click();
    await dashboard.screenshot({path:path.join(root,'test-results/cloud-teacher.png'),fullPage:true});

    // A failed request must remain queued, including across closing and reopening the page.
    rejectStudent=true;
    await page.evaluate(()=>FTCloud.enqueue({name:'Ada',level:2,caughtCount:2,records:[],roundCaught:1,roundTarget:10}));
    await page.click('#cloudRetryBtn');await page.waitForFunction(()=>document.getElementById('cloudSyncStatus').textContent.startsWith('Not synced'));
    check('failed submission is not marked synced',await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ft_sheets_pending_v1:')).length===1));
    await page.close();
    rejectStudent=false;
    page=await student.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
    await page.waitForFunction(()=>FTCloud.getStatus().startsWith('Synced'));
    check('reopening retries persisted progress without starting another game',JSON.parse(backend.rows[0][20]).level===2 && backend.rows.length===1);

    // Queue a newer snapshot while an older one awaits acknowledgement.
    let release;
    const held=new Promise(r=>{heldResolve=r;});holdSubmission=new Promise(r=>{release=r;});
    await page.evaluate(()=>{FTCloud.startSession('FT-TEST','08');FTCloud.enqueue({name:'Ben',caughtCount:1,records:[]});FTCloud.retry();});
    await held;
    await page.evaluate(()=>FTCloud.enqueue({name:'Ben',caughtCount:3,records:[]}));
    release();
    await page.waitForFunction(()=>FTCloud.getStatus().startsWith('Synced'));
    check('older acknowledgement never discards newer queued snapshot',backend.rows.length===2 && JSON.parse(backend.rows[1][20]).caughtCount===3);

    // Render untrusted imported text as text, never executable markup.
    await page.evaluate(()=>{FTCloud.enqueue({name:'<img src=x>',records:[{fractling:'<img src=x onerror=alert(1)>',question:'<b>Text</b>'}]});FTCloud.retry();});
    await page.waitForFunction(()=>FTCloud.getStatus().startsWith('Synced'));
    await dashboard.click('#teacherCloudRefresh');await dashboard.waitForFunction(()=>document.querySelector('.dash-table').textContent.includes('<img'));
    check('remote text is escaped in dashboard',await dashboard.locator('#dashContent img').count()===0);
    await dashboard.click('#teacherCloudLock');
    check('locking removes results and password field contents',await dashboard.locator('#dashContent').textContent()==='' && await dashboard.inputValue('#teacherAccessKey')==='');
    await dashboard.fill('#teacherClassCode','FT-TEST');await dashboard.fill('#teacherAccessKey','private-test-key');await dashboard.click('#teacherConnectForm button');await dashboard.locator('.dash-table').waitFor();
    check('dashboard reconnects after locking',await dashboard.locator('.dash-table tbody tr').count()===2);
    rejectStudent=true;
    const otherTab=await student.newPage();await otherTab.goto(origin);
    await student.setOffline(true);
    await page.evaluate(()=>FTCloud.enqueue({name:'Ben',caughtCount:4,records:[]}));
    await otherTab.evaluate(()=>{FTCloud.startSession('FT-TEST','09');FTCloud.enqueue({name:'Cara',caughtCount:1,records:[]});});
    const pendingTabs=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('ft_sheets_pending_v1:')).map(k=>JSON.parse(localStorage.getItem(k)).body.studentId));
    assert.deepEqual(pendingTabs.sort(),['08','09']);
    check('separate tabs retain both pending sessions',true);
    await otherTab.evaluate(()=>FTCloud.retry());
    await otherTab.waitForFunction(()=>FTCloud.getStatus().startsWith('Offline'));
    check('offline status reports local saving without claiming a sync',await otherTab.evaluate(()=>FTCloud.getStatus().includes('saved on this device')));
    await otherTab.close();await page.close();rejectStudent=false;
    await student.setOffline(false);
    page=await student.newPage();await page.goto(origin);await page.waitForFunction(()=>FTCloud.getStatus().startsWith('Synced'));
    check('closing and reopening tabs preserves both unsent sessions',backend.rows.length===3 && JSON.parse(backend.rows[1][20]).caughtCount===4 && JSON.parse(backend.rows[2][20]).name==='Cara');
    check('no browser runtime errors',errors.length===0);
    console.log(`${checks}/${checks} cloud browser checks passed (${submitCount} submission attempts)`);
  } finally {
    if(browser) await browser.close();
    await new Promise(r=>server.close(r));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
