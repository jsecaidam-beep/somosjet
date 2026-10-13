/**
 * JET — confirmed signup; no participant statistics are public.
 * Bound to Suscriptores Newsletter / Sheet1. Preserve existing columns A:D.
 * GET is read-only; return only the receipt for one random request ID.
 */
var JET_PROTOCOL = 'jet-v2';
var JET_DEPARTMENTS = ['Alta Verapaz','Baja Verapaz','Chimaltenango','Chiquimula','El Progreso','Escuintla','Guatemala','Huehuetenango','Izabal','Jalapa','Jutiapa','Petén','Quetzaltenango','Quiché','Retalhuleu','Sacatepéquez','San Marcos','Santa Rosa','Sololá','Suchitepéquez','Totonicapán','Zacapa'];
var JET_INTERESTS = {
  'Quiero ser parte de JET':'member',
  'Quiero colaborar como organización':'organization',
  'Quiero apoyar como donante':'donor',
  'Quiero conocer más':'info'
};

function doPost(e) {
  var p = (e && e.parameter) || {};
  var requestId = jetString_(p.requestId, 80);
  var modern = !!requestId;
  var lock = LockService.getScriptLock();
  try {
    if (modern && !jetValidId_(requestId)) throw new Error('invalid');
    if (!modern) requestId = Utilities.getUuid();
    var name = jetString_(p.name, 150);
    var email = jetString_(p.email, 254);
    var location = jetString_(p.location, 180);
    var international = p.department === 'international';
    var country = international ? jetString_(p.country,100) : 'Guatemala';
    var region = international ? jetString_(p.region,150) : '';
    var department = international ? '' : jetDepartment_(p.department || location);
    var interest = jetString_(p.interest, 100);
    if (p.website || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !JET_INTERESTS[interest] || p.consent !== 'yes' || (modern && !international && !department) || (international && (!country || !region))) throw new Error('invalid');
    lock.waitLock(10000);
    var sheet = jetSheet_();
    var existing = jetFindRequest_(sheet, requestId);
    if (existing) return jetJson_(jetReceipt_(sheet, existing, requestId));
    jetHeaders_(sheet);
    var locationText = international ? [country,region,location].filter(function(value){return !!value;}).join(' · ') : department && location && location !== department ? department + ' · ' + location : department || location;
    sheet.appendRow([new Date(),jetCell_(name),jetCell_(email),jetCell_(locationText),jetCell_(interest),jetCell_(jetString_(p.message,3000)),'Sí',requestId,department,jetCell_(country),jetCell_(region)]);
    SpreadsheetApp.flush();
    return jetJson_(jetReceipt_(sheet, sheet.getLastRow(), requestId));
  } catch (error) {
    var message = error.message === 'invalid' ? 'Revisa tus datos y completa tu país y estado/departamento cuando corresponda.' : 'No pudimos guardar tu registro. Inténtalo nuevamente.';
    if (jetValidId_(requestId)) CacheService.getScriptCache().put('jet-error-' + requestId, message, 120);
    return jetJson_({protocol:JET_PROTOCOL,result:'error',requestId:requestId,message:message});
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var result;
  try {
    var sheet = jetSheet_();
    if (p.action === 'status') {
      var id = jetString_(p.requestId,80);
      if (!jetValidId_(id)) throw new Error('invalid');
      var row = jetFindRequest_(sheet,id);
      var error = row ? null : CacheService.getScriptCache().get('jet-error-' + id);
      result = row ? jetReceipt_(sheet,row,id) : {protocol:JET_PROTOCOL,result:error ? 'error' : 'pending',requestId:id,message:error || ''};
    } else if (p.action === 'territories' || !p.action) {
      result = {protocol:JET_PROTOCOL,result:'ready'};
    } else {
      throw new Error('invalid');
    }
  } catch (error) {
    result = {protocol:JET_PROTOCOL,result:'error',message:'No pudimos consultar la confirmación. Vuelve a intentarlo.'};
  }
  var callback = jetString_(p.callback,100);
  if (/^jet_[A-Za-z0-9_]{1,80}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jetJson_(result);
}

function jetSheet_() {
  var workbook = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = workbook && workbook.getSheetByName('Sheet1');
  if (!sheet) throw new Error('sheet');
  return sheet;
}
function jetHeaders_(sheet) {
  var headers = ['Fecha','Nombre completo','Correo electrónico','Ubicación','Interés','Mensaje','Consentimiento','ID de registro','Departamento','País','Estado/departamento internacional'];
  if (!sheet.getLastRow()) sheet.appendRow(headers);
  else {
    var cells = sheet.getRange(1,5,1,7).getValues()[0];
    for (var i=0;i<cells.length;i++) if (!cells[i]) sheet.getRange(1,i+5).setValue(headers[i+4]);
  }
}
function jetFindRequest_(sheet,id) {
  var count = sheet.getLastRow()-1;
  if (count < 1) return null;
  var cell = sheet.getRange(2,8,count,1).createTextFinder(id).matchEntireCell(true).findNext();
  return cell ? cell.getRow() : null;
}
function jetReceipt_(sheet,row,id) {
  return {protocol:JET_PROTOCOL,result:'success',requestId:id,department:jetDepartment_(sheet.getRange(row,9).getValue())};
}
function jetDepartment_(value) {
  var text = jetString_(value,180).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
  if (text === 'antigua' || text === 'antigua guatemala') return 'Sacatepéquez';
  if (text === 'xelaju' || text === 'xela') return 'Quetzaltenango';
  if (text === 'masagua' || text === 'palin') return 'Escuintla';
  for (var i=0;i<JET_DEPARTMENTS.length;i++) {
    var name = JET_DEPARTMENTS[i];
    var plain = name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if (text === plain || (' '+text+' ').indexOf(' '+plain+' ') !== -1) return name;
  }
  return '';
}
function jetString_(value,max) {return String(value || '').trim().slice(0,max);}
function jetValidId_(id) {return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);}
function jetCell_(value) {return /^[=+\-@]/.test(value) ? "'"+value : value;}
function jetJson_(value) {return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
