/**
 * KRAA Backend — Google Apps Script
 * ------------------------------------------------------------
 * Turns a Google Sheet into a free JSON database for the KRAA app.
 *
 * SETUP:
 * 1. Open (or create) a Google Sheet.
 * 2. Extensions > Apps Script, delete starter code, paste this file.
 * 3. Deploy > New deployment > Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Copy the deployment URL into js/sheets-api.js (SHEETS_WEB_APP_URL).
 *
 * Each "collection" (customers, bookings, etc.) is stored as its own
 * sheet tab. Tabs are created automatically the first time data is
 * pushed to them — you do not need to pre-create anything.
 */

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'ping') {
    return jsonResponse({ ok: true, message: 'KRAA backend is alive' });
  }
  if (action === 'pullAll') {
    return jsonResponse({ ok: true, data: pullAllCollections() });
  }
  return jsonResponse({ ok: false, error: 'Unknown action' });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.action === 'pushCollection') {
    pushCollection(body.collection, body.records);
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ ok: false, error: 'Unknown action' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function pushCollection(collection, records) {
  const sheet = getSheet(collection);
  sheet.clearContents();
  if (!records || records.length === 0) return;

  const headers = Object.keys(records[0]);
  sheet.appendRow(headers);
  records.forEach(r => {
    sheet.appendRow(headers.map(h => r[h] !== undefined ? r[h] : ''));
  });
}

function pullAllCollections() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  ss.getSheets().forEach(sheet => {
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) { result[sheet.getName()] = []; return; }
    const headers = values[0];
    const rows = values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    result[sheet.getName()] = rows;
  });
  return result;
}
