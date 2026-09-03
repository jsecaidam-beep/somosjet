/**
 * Newsletter JET - Google Apps Script
 * Vincúlalo con la hoja de Google Sheets y despliega como Aplicación web.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Fecha", "Nombre", "Correo", "Ubicación", "Interés", "Mensaje", "Consentimiento"]);
    }

    var timestamp = new Date();
    var name = e.parameter.name || '';
    var email = e.parameter.email || '';
    var location = e.parameter.location || '';
    var interest = e.parameter.interest || '';
    var message = e.parameter.message || '';
    var consent = e.parameter.consent ? 'Sí' : 'No';

    sheet.appendRow([timestamp, name, email, location, interest, message, consent]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
