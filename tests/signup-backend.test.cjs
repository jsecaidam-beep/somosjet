const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname,'..','google-apps-script.js'),'utf8');
const ID = '7435de86-92f8-4e46-8524-8294f132c6f7';
const OTHER_ID = '053a52a1-dbe6-43d1-8488-95ecea8eebad';
const HISTORICAL_HEADERS = ['Fecha','Nombre completo','Correo electrónico','Ubicación'];

function environment(initialRows = [HISTORICAL_HEADERS]) {
  const rows = initialRows.map(row => row.slice());
  const cache = new Map();
  const state = {rows,appendFailure:false,flushFailure:false,flushed:0,locks:0,releases:0};
  let held = false;
  let uuid = 0;
  const cell = (row,column) => rows[row-1]?.[column-1] ?? '';
  const range = (row,column,numRows=1,numColumns=1) => ({
    getValues:() => Array.from({length:numRows},(_,r) => Array.from({length:numColumns},(_,c) => cell(row+r,column+c))),
    getValue:() => cell(row,column),
    setValue(value) {while(rows.length<row) rows.push([]);rows[row-1][column-1]=value;return this;},
    createTextFinder(query) {
      let entire = false;
      return {
        matchEntireCell(value) {entire=value;return this;},
        findNext() {
          for(let r=row;r<row+numRows;r++) for(let c=column;c<column+numColumns;c++) {
            const value=String(cell(r,c));
            if(entire ? value===query : value.includes(query)) return {getRow:() => r};
          }
          return null;
        }
      };
    }
  });
  const sheet = {
    getLastRow:() => rows.length,
    getRange:range,
    appendRow(row) {if(state.appendFailure) throw Error('Simulated write failure');rows.push(row.slice());return this;}
  };
  const output = text => ({text,mime:null,setMimeType(mime) {this.mime=mime;return this;}});
  const sandbox = {
    SpreadsheetApp:{getActiveSpreadsheet:() => ({getSheetByName:name => name==='Sheet1' ? sheet : null}),flush() {if(state.flushFailure) throw Error('Simulated flush failure');state.flushed++;}},
    ContentService:{MimeType:{JSON:'application/json',JAVASCRIPT:'application/javascript'},createTextOutput:output},
    LockService:{getScriptLock:() => ({waitLock() {assert.equal(held,false);held=true;state.locks++;},hasLock:() => held,releaseLock() {held=false;state.releases++;}})},
    CacheService:{getScriptCache:() => ({put:(key,value) => cache.set(key,value),get:key => cache.get(key) ?? null})},
    Utilities:{getUuid:() => `${String(++uuid).padStart(8,'0')}-1111-4111-8111-111111111111`}
  };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE,sandbox,{filename:'google-apps-script.js'});
  const post = parameters => JSON.parse(sandbox.doPost({parameter:parameters}).text);
  const get = parameters => JSON.parse(sandbox.doGet({parameter:parameters}).text);
  return {state,rows,sheet,sandbox,post,get,rawGet:parameters => sandbox.doGet({parameter:parameters})};
}

const valid = overrides => ({requestId:ID,name:'Participación de prueba',email:'test@example.org',department:'Petén',location:'Flores',interest:'Quiero ser parte de JET',message:'Un mensaje privado',consent:'yes',...overrides});

test('new signup is stored before success and preserves historical columns',() => {
  const env=environment();
  const receipt=env.post(valid());
  assert.equal(receipt.protocol,'jet-v2');
  assert.equal(receipt.result,'success');
  assert.equal(receipt.requestId,ID);
  assert.equal(receipt.department,'Petén');
  assert.equal('interest' in receipt,false);
  assert.deepEqual(env.rows[0].slice(0,4),HISTORICAL_HEADERS);
  assert.deepEqual(env.rows[0].slice(4),['Interés','Mensaje','Consentimiento','ID de registro','Departamento','País','Estado/departamento internacional']);
  assert.equal(env.rows.length,2);
  assert.equal(env.rows[1][3],'Petén · Flores');
  assert.equal(env.rows[1][7],ID);
  assert.equal(env.rows[1][8],'Petén');
  assert.equal(env.state.flushed,1);
  assert.equal(env.state.releases,1);
});

test('pending status stays read-only and never confirms an absent row',() => {
  const env=environment();
  assert.equal(env.get({action:'status',requestId:ID}).result,'pending');
  assert.equal(env.rows.length,1);
  assert.equal(env.state.flushed,0);
  assert.equal(env.state.locks,0);
  env.post(valid());
  assert.equal(env.get({action:'status',requestId:ID}).result,'success');
  assert.equal(env.get({action:'status',requestId:OTHER_ID}).result,'pending');
  assert.equal(env.rows.length,2);
});

test('retrying the same UUID returns its receipt without another row',() => {
  const env=environment();
  const first=env.post(valid());
  const second=env.post(valid({name:'Changed retry name',department:'Guatemala'}));
  assert.deepEqual(second,first);
  assert.equal(env.rows.length,2);
  assert.equal(env.rows[1][1],'Participación de prueba');
  assert.equal(env.state.flushed,1);
  assert.equal(env.state.releases,2);
});

test('invalid departments, email, consent, IDs and honeypot never create registrations',() => {
  for(const overrides of [{department:'Narnia',location:'Unknown'},{email:'bad-at-example'},{consent:'no'},{consent:''},{requestId:'not-a-uuid'},{website:'spam.example'},{name:''},{interest:'Unknown interest'}]) {
    const env=environment();
    assert.equal(env.post(valid(overrides)).result,'error',JSON.stringify(overrides));
    assert.equal(env.rows.length,1,JSON.stringify(overrides));
    assert.equal(env.state.flushed,0);
    if(overrides.requestId!=='not-a-uuid') assert.equal(env.get({action:'status',requestId:ID}).result,'error');
  }
});

test('public requests expose no participant counts, categories or private data',() => {
  const env=environment([
    HISTORICAL_HEADERS,
    [new Date('2026-01-01'),'PRIVATE historical name','private@example.org','Ciudad de Guatemala'],
    [new Date('2026-01-02'),'PRIVATE other name','another@example.org','Antigua Guatemala']
  ]);
  env.post(valid({name:'PRIVATE current name',email:'current@example.org',location:'PRIVATE exact address',message:'PRIVATE message'}));
  const result=env.get({action:'territories'});
  assert.equal(result.result,'ready');
  assert.deepEqual(Object.keys(result).sort(),['protocol','result']);
  const receipt=env.get({action:'status',requestId:ID});
  assert.deepEqual(Object.keys(receipt).sort(),['department','protocol','requestId','result']);
  for(const output of [result,receipt,env.get({})]) {
    const exposed=JSON.stringify(output);
    for(const privateValue of ['PRIVATE','@example.org','exact address','message','stats','total','interests','member','donor','count']) assert.equal(exposed.includes(privateValue),false);
  }
  assert.equal(env.get({action:'status',requestId:OTHER_ID}).result,'pending');
});

test('formula-like names, locations and messages are escaped as spreadsheet text',() => {
  const env=environment();
  const receipt=env.post(valid({name:'  =HYPERLINK("https://example.org") ',email:'+test@example.org',department:'',location:'=Petén',message:'\t@SUM(A1:A2)'}));
  assert.equal(receipt.result,'success');
  assert.equal(env.rows[1][1],"'=HYPERLINK(\"https://example.org\")");
  assert.equal(env.rows[1][2],"'+test@example.org");
  assert.equal(env.rows[1][3],'Petén · =Petén');
  assert.equal(env.rows[1][5],"'@SUM(A1:A2)");
  for(const prefix of ['=','+','-','@']) assert.equal(env.sandbox.jetCell_(prefix+'payload'),"'"+prefix+'payload');
});

test('legacy POST remains compatible without requestId or a department field',() => {
  const env=environment();
  const parameters=valid({location:'Ciudad de Guatemala',interest:'Quiero conocer más'});
  delete parameters.requestId;
  delete parameters.department;
  const result=env.post(parameters);
  assert.equal(result.result,'success');
  assert.equal(result.department,'Guatemala');
  assert.equal('interest' in result,false);
  assert.match(result.requestId,/^[a-f0-9-]{36}$/i);
  assert.equal(env.rows.length,2);
  const unrecognized=env.post({...parameters,location:'Municipio sin identificar'});
  assert.equal(unrecognized.result,'success');
  assert.equal(unrecognized.department,'');
  assert.equal(env.rows.length,3);
  assert.equal(env.get({action:'territories'}).stats,undefined);
});

test('department normalization handles accents, city wording and municipality aliases',() => {
  const env=environment();
  for(const [input,expected] of [['Peten','Petén'],[' PETÉN ','Petén'],['Ciudad de Guatemala','Guatemala'],['Guatemala · Zona 1','Guatemala'],['Sacatepequez','Sacatepéquez'],['Antigua Guatemala','Sacatepéquez'],['Xela','Quetzaltenango'],['Xelajú','Quetzaltenango'],['Masagua','Escuintla'],['Palín','Escuintla'],['San Marcos','San Marcos'],['Narnia','']]) assert.equal(env.sandbox.jetDepartment_(input),expected,input);
});

test('JSONP callback is restricted and cannot inject executable suffixes',() => {
  const env=environment();
  const allowed=env.rawGet({action:'territories',callback:'jet_counts_123'});
  assert.equal(allowed.mime,'application/javascript');
  assert.match(allowed.text,/^jet_counts_123\(\{.*\}\);$/);
  const denied=env.rawGet({action:'territories',callback:'jet_cb);alert(1);//'});
  assert.equal(denied.mime,'application/json');
  assert.equal(JSON.parse(denied.text).result,'ready');
  assert.equal(denied.text.includes('alert'),false);
});

test('failed append never reports success and releases the write lock',() => {
  const env=environment();env.state.appendFailure=true;
  assert.equal(env.post(valid()).result,'error');
  assert.equal(env.rows.length,1);
  assert.equal(env.get({action:'status',requestId:ID}).result,'error');
  assert.equal(env.state.releases,1);
  env.state.appendFailure=false;
  assert.equal(env.post(valid()).result,'success');
  assert.equal(env.get({action:'status',requestId:ID}).result,'success');
  assert.equal(env.rows.length,2);
});

test('empty workbook receives headers and exactly one registration',() => {
  const env=environment([]);
  assert.equal(env.post(valid()).result,'success');
  assert.equal(env.rows.length,2);
  assert.equal(env.rows[0][0],'Fecha');
  assert.equal(env.rows[0][8],'Departamento');
});


test('international registration stores country and region without marking Guatemala',() => {
  const env=environment();
  const receipt=env.post(valid({department:'international',country:'México',region:'Guatemala',location:'Ciudad de México'}));
  assert.equal(receipt.result,'success');
  assert.equal(receipt.department,'');
  assert.equal(env.rows[1][3],'México · Guatemala · Ciudad de México');
  assert.equal(env.rows[1][8],'');
  assert.equal(env.rows[1][9],'México');
  assert.equal(env.rows[1][10],'Guatemala');
  const confirmation=env.get({action:'status',requestId:ID});
  assert.equal(confirmation.department,'');
  assert.deepEqual(Object.keys(confirmation).sort(),['department','protocol','requestId','result']);
  assert.equal(JSON.stringify(confirmation).includes('México'),false);
  assert.equal(env.post(valid({department:'international',country:'México',region:'Guatemala',location:'Ciudad de México'})).result,'success');
  assert.equal(env.rows.length,2);
});

test('international registrations require country and region and escape sheet formulas',() => {
  for(const overrides of [{country:'',region:'California'},{country:'Estados Unidos',region:''},{country:'  ',region:'  '}]) {
    const env=environment();
    assert.equal(env.post(valid({department:'international',...overrides})).result,'error');
    assert.equal(env.rows.length,1);
  }
  const env=environment();
  assert.equal(env.post(valid({department:'international',country:'=Mexico',region:'@Estado'})).result,'success');
  assert.equal(env.rows[1][9],"'=Mexico");
  assert.equal(env.rows[1][10],"'@Estado");
});

test('domestic registration ignores stale foreign fields',() => {
  const env=environment();
  assert.equal(env.post(valid({department:'Santa Rosa',country:'México',region:'Oaxaca',location:'Cuilapa'})).result,'success');
  assert.equal(env.rows[1][3],'Santa Rosa · Cuilapa');
  assert.equal(env.rows[1][8],'Santa Rosa');
  assert.equal(env.rows[1][9],'Guatemala');
  assert.equal(env.rows[1][10],'');
});
