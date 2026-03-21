// ─────────────────────────────────────────────────────────────────────────────
//  PO Tracker — Google Apps Script Backend  v4.3
//  Deploy: Web App | Execute as: Me | Access: Anyone (anonymous)
//
//  Actions (GET):
//    ?action=ping             — health check
//    ?action=getAll           — ดึง PO + Items + Master lists
//    ?action=getArchiveList   — รายการ Archive sheets ทั้งหมด
//    ?action=getArchive&sheet=<name>  — ดึง PO+Items ของเดือนที่เลือก
//    ?action=archiveNow       — ย้าย PO Complete → Archive (manual)
//
//  Actions (POST body JSON):
//    { action: 'saveAll', data: {...} }  — บันทึก PO + Items + Masters
//
//  หลัง deploy ครั้งแรก ให้รัน installMonthlyTrigger() จาก Apps Script editor
//  เพื่อตั้ง auto-archive ทุกวันที่ 1 ของเดือน
// ─────────────────────────────────────────────────────────────────────────────

// ── ชื่อ Sheets ──
var SHEET_PO      = '📋 PO_LIST';
var SHEET_ITEMS   = '🔧 PO_ITEMS';
var SHEET_CONFIG  = '🔑 CONFIG';
var ARCHIVE_PREFIX = '📦 Archive_';

// ── Column headers ──
var PO_HEADERS   = ['po_id','company','model','recv_date','due_date','urgent','status','remark'];
var ITEM_HEADERS = ['po_id','item_name','color','urgent','status','item_due','sent_date','bundle_po','remark'];

// Archive sheet: รวม PO rows และ Item rows ในชีตเดียว โดยมี column "type" = "po" | "item"
var ARCHIVE_HEADERS = [
  'type','po_id','item_name','company','model','color',
  'recv_date','due_date','item_due','sent_date',
  'urgent','status','bundle_po','remark','archived_date'
];

// ─────────────────────────────────────────────────────────────────────────────
//  Entry Points
// ─────────────────────────────────────────────────────────────────────────────

function doGet(e) {
  var result;
  try {
    var action = (e && e.parameter && e.parameter.action) || '';
    result = dispatch(action, e, null);
  } catch(err) {
    result = { ok: false, error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var result;
  try {
    var payload = JSON.parse(e.postData.contents);
    result = dispatch(payload.action || '', e, payload.data);
  } catch(err) {
    result = { ok: false, error: String(err) };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function dispatch(action, e, postData) {
  switch (action) {
    case 'ping':
      return { ok: true, message: 'PO Tracker GAS v4.3' };
    case 'getAll':
      return getAllData();
    case 'saveAll':
      return saveAllData(postData);
    case 'getArchiveList':
      return getArchiveList();
    case 'getArchive':
      return getArchiveData((e && e.parameter && e.parameter.sheet) || '');
    case 'archiveNow':
      return archiveNow();
    default:
      return { ok: false, error: 'Unknown action: ' + action };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Sheet rows → array of objects (key = header) */
function sheetToObjects(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function(h) { return String(h).trim(); });
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    // ข้าม row ที่ว่างทั้งหมด
    var isEmpty = row.every(function(c) { return c === '' || c === null || c === undefined; });
    if (isEmpty) continue;
    var obj = {};
    headers.forEach(function(h, idx) {
      obj[h] = (row[idx] !== undefined && row[idx] !== null) ? String(row[idx]) : '';
    });
    result.push(obj);
  }
  return result;
}

/** Array of objects → เขียนลง sheet (clear ก่อน แล้วเขียนใหม่) */
function objectsToSheet(sheet, headers, objects) {
  sheet.clearContents();
  var rows = [headers];
  objects.forEach(function(obj) {
    rows.push(headers.map(function(h) { return (obj[h] !== undefined && obj[h] !== null) ? obj[h] : ''; }));
  });
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
}

/** หา sheet หรือสร้างใหม่ถ้าไม่มี */
function getOrCreateSheet(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

// ─────────────────────────────────────────────────────────────────────────────
//  getAll — ดึงข้อมูลหลักทั้งหมด
// ─────────────────────────────────────────────────────────────────────────────

function getAllData() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var shPO   = getOrCreateSheet(ss, SHEET_PO,    PO_HEADERS);
  var shItem = getOrCreateSheet(ss, SHEET_ITEMS, ITEM_HEADERS);
  var shConf = getOrCreateSheet(ss, SHEET_CONFIG, ['type','value']);

  var pos   = sheetToObjects(shPO);
  var items = sheetToObjects(shItem);

  // อ่าน Master lists จาก CONFIG sheet (col A = type, col B = value)
  var confRows = shConf.getDataRange().getValues();
  var masterCompanies = [], masterModels = [], masterParts = [];
  for (var i = 1; i < confRows.length; i++) {
    var t = String(confRows[i][0]).trim();
    var v = String(confRows[i][1]).trim();
    if (!v) continue;
    if      (t === 'company') masterCompanies.push(v);
    else if (t === 'model')   masterModels.push(v);
    else if (t === 'part')    masterParts.push(v);
  }

  return {
    ok: true,
    data: { pos: pos, items: items, masterCompanies: masterCompanies, masterModels: masterModels, masterParts: masterParts }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  saveAll — บันทึกข้อมูลทั้งหมด (POST)
// ─────────────────────────────────────────────────────────────────────────────

function saveAllData(data) {
  if (!data) return { ok: false, error: 'No data provided' };

  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var shPO   = getOrCreateSheet(ss, SHEET_PO,    PO_HEADERS);
  var shItem = getOrCreateSheet(ss, SHEET_ITEMS, ITEM_HEADERS);
  var shConf = getOrCreateSheet(ss, SHEET_CONFIG, ['type','value']);

  // แปลง HTML format (camelCase/short) → GAS format (snake_case)
  var pos = (data.pos || []).map(function(p) {
    return {
      po_id:     p.id        || p.po_id    || '',
      company:   p.company   || '',
      model:     p.model     || '',
      recv_date: p.recv      || p.recv_date || '',
      due_date:  p.due       || p.due_date  || '',
      urgent:    (p.urgent === true || String(p.urgent).toUpperCase() === 'TRUE') ? 'TRUE' : 'FALSE',
      status:    p.status    || 'Order',
      remark:    p.remark    || ''
    };
  }).filter(function(p) { return p.po_id; });

  var items = (data.items || []).map(function(i) {
    return {
      po_id:     i.po        || i.po_id     || '',
      item_name: i.part      || i.item_name || '',
      color:     i.color     || '',
      urgent:    (i.urgent === true || String(i.urgent).toUpperCase() === 'TRUE') ? 'TRUE' : 'FALSE',
      status:    i.status    || 'รับของแล้ว',
      item_due:  i.itemDue   || i.item_due  || '',
      sent_date: i.sentDate  || i.sent_date || '',
      bundle_po: i.bundlePO  || i.bundle_po || '',
      remark:    i.remark    || ''
    };
  }).filter(function(i) { return i.po_id && i.item_name; });

  objectsToSheet(shPO,   PO_HEADERS,   pos);
  objectsToSheet(shItem, ITEM_HEADERS, items);

  // บันทึก Master lists
  var confRows = [['type','value']];
  (data.masterCompanies || []).forEach(function(v) { if (v) confRows.push(['company', v]); });
  (data.masterModels    || []).forEach(function(v) { if (v) confRows.push(['model',   v]); });
  (data.masterParts     || []).forEach(function(v) { if (v) confRows.push(['part',    v]); });
  shConf.clearContents();
  shConf.getRange(1, 1, confRows.length, 2).setValues(confRows);

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getArchiveList — รายการเดือนที่มี Archive
// ─────────────────────────────────────────────────────────────────────────────

function getArchiveList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var result = [];

  sheets.forEach(function(sh) {
    var name = sh.getName();
    if (name.indexOf(ARCHIVE_PREFIX) === 0) {
      var allRows = sheetToObjects(sh);
      var poCount   = allRows.filter(function(r) { return r.type === 'po'; }).length;
      var itemCount = allRows.filter(function(r) { return r.type === 'item'; }).length;
      result.push({ sheet: name, poCount: poCount, itemCount: itemCount });
    }
  });

  return { ok: true, data: result };
}

// ─────────────────────────────────────────────────────────────────────────────
//  getArchive — ดึง PO+Items ของ Archive เดือนที่เลือก
// ─────────────────────────────────────────────────────────────────────────────

function getArchiveData(sheetName) {
  if (!sheetName) return { ok: false, error: 'No sheet name provided' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { ok: false, error: 'Archive sheet not found: ' + sheetName };

  var allRows = sheetToObjects(sh);
  var pos   = allRows.filter(function(r) { return r.type === 'po'; });
  var items = allRows.filter(function(r) { return r.type === 'item'; });

  return { ok: true, data: { pos: pos, items: items } };
}

// ─────────────────────────────────────────────────────────────────────────────
//  archiveNow — ย้าย PO status=Complete ออกจาก main sheet → Archive sheet
// ─────────────────────────────────────────────────────────────────────────────

function archiveNow() {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var shPO   = getOrCreateSheet(ss, SHEET_PO,    PO_HEADERS);
  var shItem = getOrCreateSheet(ss, SHEET_ITEMS, ITEM_HEADERS);

  var allPos   = sheetToObjects(shPO);
  var allItems = sheetToObjects(shItem);

  // หา PO ที่ status = 'Complete'
  var toArchive = allPos.filter(function(p) { return p.status === 'Complete'; });
  if (toArchive.length === 0) return { ok: true, archived: 0 };

  // ชื่อ Archive sheet = "📦 Archive_YYYY_MM" ของเดือนปัจจุบัน
  var now = new Date();
  var archiveDate  = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
  var monthKey     = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy_MM');
  var archiveName  = ARCHIVE_PREFIX + monthKey;

  var shArchive = getOrCreateSheet(ss, archiveName, ARCHIVE_HEADERS);

  // สร้าง rows สำหรับเขียนลง Archive sheet
  var newRows = [];
  toArchive.forEach(function(po) {
    // PO row
    newRows.push([
      'po',           // type
      po.po_id,       // po_id
      '',             // item_name
      po.company,     // company
      po.model,       // model
      '',             // color
      po.recv_date,   // recv_date
      po.due_date,    // due_date
      '',             // item_due
      '',             // sent_date
      po.urgent,      // urgent
      po.status,      // status
      '',             // bundle_po
      po.remark,      // remark
      archiveDate     // archived_date
    ]);

    // Item rows ของ PO นี้
    var poItems = allItems.filter(function(i) { return i.po_id === po.po_id; });
    poItems.forEach(function(item) {
      newRows.push([
        'item',          // type
        item.po_id,      // po_id
        item.item_name,  // item_name
        '',              // company
        '',              // model
        item.color,      // color
        '',              // recv_date
        '',              // due_date
        item.item_due,   // item_due
        item.sent_date,  // sent_date
        item.urgent,     // urgent
        item.status,     // status
        item.bundle_po,  // bundle_po
        item.remark,     // remark
        archiveDate      // archived_date
      ]);
    });
  });

  // Append ไปใน Archive sheet (ต่อจาก row ล่าสุด เพื่อสะสม archive หลาย batch)
  if (newRows.length > 0) {
    var lastRow = shArchive.getLastRow();
    shArchive.getRange(lastRow + 1, 1, newRows.length, ARCHIVE_HEADERS.length).setValues(newRows);
  }

  // ลบ PO+Items ที่ archive ออกจาก main sheets
  var archivedIds = {};
  toArchive.forEach(function(p) { archivedIds[p.po_id] = true; });

  var remainingPos   = allPos.filter(function(p) { return !archivedIds[p.po_id]; });
  var remainingItems = allItems.filter(function(i) { return !archivedIds[i.po_id]; });

  objectsToSheet(shPO,   PO_HEADERS,   remainingPos);
  objectsToSheet(shItem, ITEM_HEADERS, remainingItems);

  Logger.log('✅ archiveNow: archived ' + toArchive.length + ' POs → ' + archiveName);
  return { ok: true, archived: toArchive.length };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Trigger: Auto-archive ทุกวันที่ 1 ของเดือน
//  รันฟังก์ชันนี้ใน Apps Script Editor ครั้งเดียวหลัง deploy
// ─────────────────────────────────────────────────────────────────────────────

function installMonthlyTrigger() {
  // ลบ trigger เก่าก่อน (ถ้ามี)
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'autoArchiveMonthly') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // สร้าง trigger ใหม่: ทุกวันที่ 1 เวลา 00:00–01:00 (Thai time)
  ScriptApp.newTrigger('autoArchiveMonthly')
    .timeBased()
    .onMonthDay(1)
    .atHour(0)
    .inTimezone('Asia/Bangkok')
    .create();

  Logger.log('✅ Monthly trigger installed: autoArchiveMonthly — runs on 1st of each month at 00:00 BKK');
}

/** เรียกโดย monthly trigger */
function autoArchiveMonthly() {
  archiveNow();
}
