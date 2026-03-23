// ═══════════════════════════════════════════════════════════
//  PO Tracker — Google Apps Script Backend v3
//  Format ตรงกับ PO-Tracker-v2.xlsx ทุกอย่าง
//  วิธีใช้: วาง code นี้ใน Google Apps Script → Deploy เป็น Web App
//  Execute as: Me | Access: Anyone (even anonymous)
// ═══════════════════════════════════════════════════════════

// ── ชื่อ Sheet (ตรงกับ v2) ──
const SHEET_PO        = '📋 PO_LIST';
const SHEET_ITEMS     = '🔩 PO_ITEMS';
const SHEET_DASHBOARD = '📊 DASHBOARD';
const SHEET_CONFIG    = '⚙️ CONFIG';

// ── Column keys ──
const PO_KEYS    = ['id','company','model','recv','due','urgent','status','remark'];
const ITEM_KEYS  = ['po','part','color','urgent','status','sentDate','bundlePO','order','due','remark'];

// ── Header ภาษาไทย (แถวที่ 2 ของแต่ละ sheet) ──
const PO_HEADERS_TH   = ['No.','เลขที่ PO','บริษัท / ลูกค้า','รุ่นรถ','สี / หมายเหตุ',
                          'รับมาทั้งหมด\n(ชิ้น)','ส่งแล้ว\n(ชิ้น)','ยังค้าง\n(ชิ้น)',
                          'กำลังผลิต\n(ชิ้น)','สถานะ PO','วันที่รับ','กำหนดส่ง','ด่วน'];
const ITEM_HEADERS_TH = ['เลขที่ PO','ชิ้นงาน / Part','สี','ด่วน','สถานะชิ้น',
                          'วันส่งจริง','ส่งไปกับ PO','ลำดับชิ้น\nใน PO','กำหนดส่ง PO','หมายเหตุ'];

// ── สถานะ map emoji (ตรงกับ v2) ──
const STATUS_EMOJI = {
  'รับของแล้ว':   '📥 รับของแล้ว',
  'กำลังผลิต':   '🔄 กำลังผลิต',
  'เตรียมส่ง':   '📦 เตรียมส่ง',
  'ส่งแล้ว':     '✅ ส่งแล้ว',
  'กลับมาแก้ไข': '🔁 กลับมาแก้ไข',
  // รองรับสถานะเก่าจาก v2 ด้วย
  'รอคิว':       '⏳ รอคิว',
  'รอส่ง':       '📦 รอส่ง',
};

function addEmoji(s) {
  if (!s) return '';
  return STATUS_EMOJI[s] || s;
}
function stripEmoji(s) {
  if (!s) return '';
  // ลบ emoji prefix เช่น "✅ ส่งแล้ว" → "ส่งแล้ว"
  return String(s).replace(/^[^\u0E00-\u0E7Fa-zA-Z0-9]+/, '').trim();
}

// ════════════════════════════════════════════════════════
//  doGet — ใช้ JSONP สำหรับ ping, getAll (อ่านข้อมูล)
// ════════════════════════════════════════════════════════
// ★★★ VERSION STAMP — ถ้า ping แล้วเห็นเลขนี้ = GAS version ใหม่
const GAS_VERSION = 'v4.5-DEDUP-ARCHIVE-2026-03-23';

function doGet(e) {
  const params = e.parameter || {};
  const action = params.action || 'getAll';
  let result;

  try {
    if      (action === 'ping')           result = { ok: true, message: 'PO Tracker GAS ' + GAS_VERSION + ' ✅', version: GAS_VERSION };
    else if (action === 'getAll')         result = getAllData();
    else if (action === 'getArchiveList') result = getArchiveList();
    else if (action === 'getArchive')     result = getArchiveData(params.sheet);
    else if (action === 'archiveNow')     result = archiveCompletedPOs();  // ★ NEW: Archive ทันทีจากปุ่มใน App
    else if (action === 'saveAll') {
      // fallback: ยังรองรับ GET saveAll (กรณี data เล็ก)
      const data = JSON.parse(decodeURIComponent(params.data || '{}'));
      result = saveAllData(data);
    }
    else result = { ok: false, error: 'Unknown action: ' + action };
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }

  const callback = params.callback;
  const json     = JSON.stringify(result);
  const output   = callback
    ? ContentService.createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT)
    : ContentService.createTextOutput(json)
        .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ════════════════════════════════════════════════════════
//  doPost — ใช้ POST สำหรับ saveAll (ข้อมูลใหญ่ไม่จำกัด URL length)
// ════════════════════════════════════════════════════════
function doPost(e) {
  let result;
  try {
    const body   = JSON.parse(e.postData.contents || '{}');
    const action = body.action || 'saveAll';

    if (action === 'saveAll') {
      result = saveAllData(body.data || body);
    } else {
      result = { ok: false, error: 'Unknown POST action: ' + action };
    }
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════
//  getAllData — ดึงข้อมูลจาก Sheet → ส่งให้ Mobile App
// ════════════════════════════════════════════════════════
function getAllData() {
  // ★ ล็อกป้องกันอ่านขณะกำลังเขียน
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);  // รอสูงสุด 15 วินาที
  try {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);

  // อ่าน PO_LIST
  const poSheet  = ss.getSheetByName(SHEET_PO);
  const poData   = poSheet.getDataRange().getValues();
  const pos = [];
  if (poData.length > 2) {
    for (let r = 2; r < poData.length; r++) {
      const row = poData[r];
      const id  = String(row[1] || '').trim();
      if (!id) continue;
      pos.push({
        id:      id,
        company: String(row[2] || ''),
        model:   String(row[3] || ''),
        recv:    formatDateOut(row[10]),
        due:     formatDateOut(row[11]),
        urgent:  row[12] === 'Y' || row[12] === true,
        status:  String(row[9] || 'Order'),
        remark:  String(row[4] || '')
      });
    }
  }

  // อ่าน PO_ITEMS
  const itemSheet = ss.getSheetByName(SHEET_ITEMS);
  const itemData  = itemSheet.getDataRange().getValues();
  const items = [];
  if (itemData.length > 2) {
    for (let r = 2; r < itemData.length; r++) {
      const row = itemData[r];
      const po  = String(row[0] || '').trim();
      if (!po || po.startsWith('✅') || po.startsWith('🔄')) continue; // skip legend row
      const part = String(row[1] || '').trim();
      if (!part) continue;  // ★ skip row ที่ไม่มีชื่อชิ้นงาน
      items.push({
        po:       po,
        part:     part,
        color:    String(row[2] || ''),
        urgent:   row[3] === 'Y' || row[3] === true,
        status:   stripEmoji(String(row[4] || 'รับของแล้ว')),
        sentDate: formatDateOut(row[5]),
        bundlePO: String(row[6] || ''),
        remark:   String(row[9] || '')
      });
    }
  }

  // อ่าน CONFIG (master lists)
  const cfgSheet = ss.getSheetByName(SHEET_CONFIG);
  const cfgData  = cfgSheet.getDataRange().getValues();
  const masterCompanies = [], masterModels = [], masterParts = [];
  for (let r = 2; r < cfgData.length; r++) {
    if (cfgData[r][0]) masterCompanies.push(String(cfgData[r][0]));
    if (cfgData[r][1]) masterModels.push(String(cfgData[r][1]));
    if (cfgData[r][2]) masterParts.push(String(cfgData[r][2]));
  }

  return { ok: true, data: { pos, items, masterCompanies, masterModels, masterParts } };
  } finally { lock.releaseLock(); }  // ★ ปลดล็อก
}

// ════════════════════════════════════════════════════════
//  saveAllData — รับข้อมูลจาก Mobile App → เขียนลง Sheet
// ════════════════════════════════════════════════════════
function saveAllData(data) {
  // ★ ล็อกป้องกัน read/write ชนกัน
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);  // รอสูงสุด 30 วินาที
  try {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);

  const pos      = data.pos   || [];
  const rawItems = data.items || [];

  // ★★★ FIX: กรอง item ที่ไม่มี po หรือไม่มี part ออกก่อนทุกอย่าง
  // ทำ filter ครั้งเดียวตรงนี้แล้วใช้ validItems ทุกที่
  const validItems = rawItems.filter(function(it) {
    return it && String(it.po || '').trim() !== '' && String(it.part || '').trim() !== '';
  });

  // ★ Debug log
  Logger.log('[saveAllData] rawItems: ' + rawItems.length + ', validItems: ' + validItems.length);
  if (rawItems.length !== validItems.length) {
    Logger.log('[saveAllData] WARNING: ' + (rawItems.length - validItems.length) + ' invalid items filtered out!');
  }

  // ── เขียน PO_LIST ──
  const poSheet = ss.getSheetByName(SHEET_PO);
  clearDataRows(poSheet);

  if (pos.length > 0) {
    const rows = pos.map(function(p, i) {
      // ★ ใช้ validItems (ที่ filter แล้ว) เพื่อนับจำนวน — ไม่ใช้ rawItems
      var its        = validItems.filter(function(it) { return it.po === p.id; });
      var totalCount = its.length;
      var sentCount  = its.filter(function(it) { return it.status === 'ส่งแล้ว'; }).length;
      var pendCount  = its.filter(function(it) { return it.status !== 'ส่งแล้ว'; }).length;
      var prodCount  = its.filter(function(it) { return it.status === 'กำลังผลิต'; }).length;

      return [
        i + 1,                          // No.
        p.id,                           // เลขที่ PO
        p.company,                      // บริษัท
        p.model,                        // รุ่นรถ
        p.remark || '',                 // สี/หมายเหตุ
        totalCount,                     // รับมาทั้งหมด
        sentCount,                      // ส่งแล้ว
        pendCount,                      // ยังค้าง
        prodCount,                      // กำลังผลิต
        p.status || 'Order',            // สถานะ PO
        formatDateIn(p.recv),           // วันที่รับ
        formatDateIn(p.due),            // กำหนดส่ง
        p.urgent ? 'Y' : ''            // ด่วน
      ];
    });
    poSheet.getRange(3, 1, rows.length, 13).setValues(rows);
  }

  // ── เขียน PO_ITEMS ──
  var itemSheet = ss.getSheetByName(SHEET_ITEMS);
  clearDataRows(itemSheet);

  if (validItems.length > 0) {
    // นับ order ต่อ PO
    var orderMap = {};
    var rows = validItems.map(function(it) {
      if (!orderMap[it.po]) orderMap[it.po] = 0;
      orderMap[it.po]++;
      var poDue = '';
      for (var k = 0; k < pos.length; k++) {
        if (pos[k].id === it.po) { poDue = pos[k].due || ''; break; }
      }
      return [
        String(it.po || ''),
        String(it.part || ''),
        String(it.color || ''),
        it.urgent ? 'Y' : '',
        addEmoji(it.status || 'รับของแล้ว'),
        formatDateIn(it.sentDate),
        it.bundlePO || '',
        orderMap[it.po],
        formatDateIn(poDue),
        it.remark || ''
      ];
    });
    itemSheet.getRange(3, 1, rows.length, 10).setValues(rows);
  }

  // ── อัพเดท CONFIG master lists ──
  if (data.masterCompanies || data.masterModels || data.masterParts) {
    updateConfig(ss, data);
  }

  // ── ฟอร์แมต + อัพเดท DASHBOARD ──
  formatAllSheets(ss, pos, validItems);
  updateDashboard(ss, pos, validItems);

  return {
    ok: true,
    version: GAS_VERSION,
    saved_pos:   pos.length,
    saved_items: validItems.length,
    raw_items:   rawItems.length,
    filtered_out: rawItems.length - validItems.length
  };
  } finally { lock.releaseLock(); }  // ★ ปลดล็อก
}

// ════════════════════════════════════════════════════════
//  updateConfig — อัพเดทรายชื่ออ้างอิงใน ⚙️ CONFIG
// ════════════════════════════════════════════════════════
function updateConfig(ss, data) {
  const sheet = ss.getSheetByName(SHEET_CONFIG);
  if (sheet.getLastRow() > 2) {
    sheet.getRange(3, 1, sheet.getLastRow() - 2, 3).clearContent();
  }
  const companies = data.masterCompanies || [];
  const models    = data.masterModels    || [];
  const parts     = data.masterParts     || [];
  const maxLen = Math.max(companies.length, models.length, parts.length);
  if (maxLen === 0) return;
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push([
      companies[i] || '',
      models[i]    || '',
      parts[i]     || ''
    ]);
  }
  sheet.getRange(3, 1, rows.length, 3).setValues(rows);
}

// ════════════════════════════════════════════════════════
//  updateDashboard — สร้าง DASHBOARD ใหม่ทุกครั้ง saveAll
// ════════════════════════════════════════════════════════
function updateDashboard(ss, pos, items) {
  const sheet = ss.getSheetByName(SHEET_DASHBOARD);
  sheet.clearContents();
  sheet.clearFormats();

  const BLUE      = '#1A73E8';
  const DARK_BLUE = '#0D47A1';
  const ORANGE    = '#E65100';
  const GREEN     = '#1B5E20';
  const AMBER     = '#F57F17';
  const RED       = '#C62828';
  const BG_LIGHT  = '#F8F9FA';
  const WHITE     = '#FFFFFF';

  // ── แถวที่ 1: หัวเรื่อง ──
  const title = sheet.getRange('A1:I1');
  title.merge();
  title.setValue('📊 DASHBOARD — สรุปยอดงานพ่นสี (อัพเดทอัตโนมัติ)');
  title.setBackground(DARK_BLUE).setFontColor(WHITE)
       .setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');

  // ── แถวที่ 2: วันที่อัพเดท ──
  const today = new Date();
  const thaiDay = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`;
  sheet.getRange('A2').setValue(`อัพเดท: ${thaiDay}`);
  sheet.getRange('A2').setFontColor('#546E7A').setFontStyle('italic');

  // ─── ส่วนที่ 1: ภาพรวมระดับ PO ───
  sheet.getRange('A4:I4').merge();
  sheet.getRange('A4').setValue('📦 ภาพรวมระดับ PO');
  styleSection(sheet.getRange('A4'), BLUE);

  const poHeaderRow  = ['','📋 PO ทั้งหมด','✅ PO เสร็จสมบูรณ์','🌸 ส่งบางส่วน',
                        '⏳ ยังค้าง (In prog+Order)','🔥 PO ด่วนค้างอยู่'];
  const totalPO      = pos.length;
  const completePO   = pos.filter(p => p.status === 'Complete').length;
  const partialPO    = pos.filter(p => p.status === 'Partial Send').length;
  const pendingPO    = pos.filter(p => ['In progress','Order'].includes(p.status)).length;
  const urgentPendPO = pos.filter(p => p.urgent && p.status !== 'Complete').length;
  const poValRow     = ['', totalPO, completePO, partialPO, pendingPO, urgentPendPO];

  sheet.getRange(5, 1, 1, 6).setValues([poHeaderRow]);
  sheet.getRange(6, 1, 1, 6).setValues([poValRow]);
  styleHeaderRow(sheet.getRange(5, 2, 1, 5), BLUE);
  styleValueRow(sheet.getRange(6, 2, 1, 5));

  // ─── ส่วนที่ 2: ภาพรวมระดับชิ้นงาน ───
  sheet.getRange('A8:I8').merge();
  sheet.getRange('A8').setValue('🔩 ภาพรวมระดับชิ้นงาน (จาก PO_ITEMS)');
  styleSection(sheet.getRange('A8'), ORANGE);

  const totalItems   = items.length;
  const sentItems    = items.filter(i => i.status === 'ส่งแล้ว').length;
  const prodItems    = items.filter(i => i.status === 'กำลังผลิต').length;
  const readyItems   = items.filter(i => i.status === 'เตรียมส่ง').length;
  const recvItems    = items.filter(i => i.status === 'รับของแล้ว').length;
  const reworkItems  = items.filter(i => i.status === 'กลับมาแก้ไข').length;
  const urgentItems  = items.filter(i => i.urgent && i.status !== 'ส่งแล้ว').length;

  const itemHdr = ['','🔩 ชิ้นทั้งหมด','✅ ส่งแล้ว','🔄 กำลังผลิต',
                   '📦 เตรียมส่ง','📥 รับของแล้ว','🔁 แก้ไข','🔥 ชิ้นด่วนค้าง'];
  const itemVal = ['', totalItems, sentItems, prodItems, readyItems, recvItems, reworkItems, urgentItems];

  sheet.getRange(9, 1, 1, 8).setValues([itemHdr]);
  sheet.getRange(10, 1, 1, 8).setValues([itemVal]);
  styleHeaderRow(sheet.getRange(9, 2, 1, 7), ORANGE);
  styleValueRow(sheet.getRange(10, 2, 1, 7));

  // ─── ส่วนที่ 3: ตารางสรุปแต่ละ PO ───
  sheet.getRange('A12:I12').merge();
  sheet.getRange('A12').setValue('📋 สรุปสถานะแต่ละ PO (ชิ้นส่งแล้ว vs ยังค้าง)');
  styleSection(sheet.getRange('A12'), '#2E7D32');

  const tblHdr = ['เลขที่ PO','บริษัท','รุ่นรถ','ชิ้นทั้งหมด',
                  'ส่งแล้ว','กำลังผลิต','รอส่ง+รับของ','แก้ไข','สถานะ PO','ด่วน'];
  sheet.getRange(13, 1, 1, 10).setValues([tblHdr]);
  styleTableHeader(sheet.getRange(13, 1, 1, 10), '#2E7D32');

  let row = 14;
  pos.forEach(p => {
    const its       = items.filter(i => i.po === p.id);
    const total     = its.length;
    const sent      = its.filter(i => i.status === 'ส่งแล้ว').length;
    const prod      = its.filter(i => i.status === 'กำลังผลิต').length;
    const waiting   = its.filter(i => ['รับของแล้ว','เตรียมส่ง'].includes(i.status)).length;
    const rework    = its.filter(i => i.status === 'กลับมาแก้ไข').length;
    const dataRow   = [p.id, p.company, p.model, total, sent, prod, waiting, rework,
                       p.status, p.urgent ? 'Y' : ''];
    sheet.getRange(row, 1, 1, 10).setValues([dataRow]);

    // สีตามสถานะ PO
    let bg = WHITE;
    if (p.status === 'Complete')     bg = '#E8F5E9';
    else if (p.status === 'Partial Send') bg = '#FFF9C4';
    else if (p.urgent)               bg = '#FFF3E0';
    sheet.getRange(row, 1, 1, 10).setBackground(bg);
    if (row % 2 === 0 && bg === WHITE) sheet.getRange(row, 1, 1, 10).setBackground('#F5F5F5');
    row++;
  });

  // รวมทั้งหมด
  if (pos.length > 0) {
    const totals = ['รวมทั้งหมด','','',
      items.length,
      items.filter(i=>i.status==='ส่งแล้ว').length,
      items.filter(i=>i.status==='กำลังผลิต').length,
      items.filter(i=>['รับของแล้ว','เตรียมส่ง'].includes(i.status)).length,
      items.filter(i=>i.status==='กลับมาแก้ไข').length,
      '',''];
    sheet.getRange(row, 1, 1, 10).setValues([totals]);
    sheet.getRange(row, 1, 1, 10).setBackground('#E3F2FD').setFontWeight('bold');
    row++;
  }

  // ─── ส่วนที่ 4: ชิ้นด่วนที่ยังไม่ส่ง ───
  row++;
  sheet.getRange(row, 1, 1, 9).merge();
  sheet.getRange(row, 1).setValue('🔥 ชิ้นด่วนที่ยังไม่ได้ส่ง (ต้องติดตามก่อน)');
  styleSection(sheet.getRange(row, 1), RED);
  row++;

  const urgentPend = items.filter(i => i.urgent && i.status !== 'ส่งแล้ว');
  if (urgentPend.length === 0) {
    sheet.getRange(row, 1, 1, 7).merge();
    sheet.getRange(row, 1).setValue('✅ ไม่มีชิ้นด่วนค้างอยู่');
    sheet.getRange(row, 1).setBackground('#E8F5E9').setFontColor('#2E7D32').setHorizontalAlignment('center');
    row++;
  } else {
    const urgHdr = ['เลขที่ PO','ชิ้นงาน','สี','สถานะชิ้น','กำหนดส่ง PO','ส่งไปกับ PO','หมายเหตุ'];
    sheet.getRange(row, 1, 1, 7).setValues([urgHdr]);
    styleTableHeader(sheet.getRange(row, 1, 1, 7), RED);
    row++;
    urgentPend.forEach(i => {
      const poDue = (pos.find(p => p.id === i.po) || {}).due || '';
      sheet.getRange(row, 1, 1, 7).setValues([[
        i.po, i.part, i.color, addEmoji(i.status), isoToDisplay(poDue), i.bundlePO||'', i.remark||''
      ]]);
      sheet.getRange(row, 1, 1, 7).setBackground('#FFF3E0');
      row++;
    });
  }

  // ─── ส่วนที่ 5: วิธีใช้งาน ───
  row++;
  sheet.getRange(row, 1, 1, 9).merge();
  sheet.getRange(row, 1).setValue('📖 วิธีใช้งาน');
  styleSection(sheet.getRange(row, 1), '#546E7A');
  row++;

  const howto = [
    '1. เพิ่ม PO ใหม่ → กรอกใน Sheet 📋 PO_LIST (ยอดชิ้นคำนวณอัตโนมัติจาก 🔩 PO_ITEMS)',
    '2. เพิ่มชิ้นงาน → กรอกใน Sheet 🔩 PO_ITEMS (1 row = 1 ชิ้น ระบุ PO ที่ชิ้นนี้สังกัด)',
    '3. อัพเดทสถานะชิ้น → เปลี่ยน "สถานะชิ้น" ใน 🔩 PO_ITEMS ให้ตรงกับสถานะปัจจุบัน',
    '4. ส่งบางชิ้นก่อน → ใส่ "วันส่งจริง" และเปลี่ยนสถานะเป็น "ส่งแล้ว"',
    '5. ชิ้นที่รอรวมกับ PO อื่น → ใส่เลข PO ปลายทางใน "ส่งไปกับ PO" เช่น PO-67-003',
    '6. 📊 DASHBOARD อัพเดทอัตโนมัติทุกครั้งที่ Sync จาก Mobile App',
  ];
  howto.forEach(txt => {
    sheet.getRange(row, 1, 1, 9).merge();
    sheet.getRange(row, 1).setValue(txt);
    sheet.getRange(row, 1).setBackground('#FAFAFA').setFontColor('#546E7A');
    row++;
  });

  // ── Column widths ──
  const dashWidths = [160,120,120,100,90,100,100,90,120,60];
  dashWidths.forEach((w,i) => { if(i<10) sheet.setColumnWidth(i+1, w); });
  sheet.setFrozenRows(1);
}

// ════════════════════════════════════════════════════════
//  formatAllSheets — จัด format PO_LIST + PO_ITEMS ตาม v2
// ════════════════════════════════════════════════════════
function formatAllSheets(ss, pos, items) {
  // ── PO_LIST ──
  const poSheet = ss.getSheetByName(SHEET_PO);
  if (poSheet.getLastRow() >= 2) {
    // แถว title (row 1)
    const titleRange = poSheet.getRange(1, 1, 1, 13);
    titleRange.merge();
    titleRange.setBackground('#0D47A1').setFontColor('#FFFFFF')
              .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');

    // แถว header (row 2)
    const hdrRange = poSheet.getRange(2, 1, 1, 13);
    hdrRange.setValues([PO_HEADERS_TH]);
    hdrRange.setBackground('#1A73E8').setFontColor('#FFFFFF')
            .setFontWeight('bold').setHorizontalAlignment('center').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    hdrRange.setRowHeight && poSheet.setRowHeight(2, 42);

    // สีแถวข้อมูล
    for (let r = 3; r <= Math.max(poSheet.getLastRow(), 3); r++) {
      if (r > poSheet.getLastRow()) break;
      const statusVal = String(poSheet.getRange(r, 10).getValue());
      let bg = '#FFFFFF';
      if (statusVal === 'Complete')     bg = '#E8F5E9';
      else if (statusVal === 'Partial Send') bg = '#FFF9C4';
      else if (r % 2 === 0)            bg = '#E8F0FE';
      // ด่วน → ส้มอ่อน ทับ
      if (poSheet.getRange(r, 13).getValue() === 'Y') bg = '#FFF3E0';
      poSheet.getRange(r, 1, 1, 13).setBackground(bg);
    }

    // column widths
    const poW = [50,120,150,120,180,70,70,70,80,110,90,90,50];
    poW.forEach((w,i) => poSheet.setColumnWidth(i+1, w));
    poSheet.setFrozenRows(2);
  }

  // ── PO_ITEMS ──
  const itemSheet = ss.getSheetByName(SHEET_ITEMS);
  if (itemSheet.getLastRow() >= 2) {
    const titleRange2 = itemSheet.getRange(1, 1, 1, 10);
    titleRange2.merge();
    titleRange2.setBackground('#BF360C').setFontColor('#FFFFFF')
               .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');

    const hdrRange2 = itemSheet.getRange(2, 1, 1, 10);
    hdrRange2.setValues([ITEM_HEADERS_TH]);
    hdrRange2.setBackground('#E65100').setFontColor('#FFFFFF')
             .setFontWeight('bold').setHorizontalAlignment('center').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    itemSheet.setRowHeight(2, 42);

    for (let r = 3; r <= itemSheet.getLastRow(); r++) {
      const statusVal = stripEmoji(String(itemSheet.getRange(r, 5).getValue()));
      let bg = '#FFFFFF';
      if (statusVal === 'ส่งแล้ว')       bg = '#E8F5E9';
      else if (statusVal === 'กำลังผลิต') bg = '#FFF9C4';
      else if (statusVal === 'เตรียมส่ง') bg = '#E3F2FD';
      else if (statusVal === 'กลับมาแก้ไข') bg = '#FCE4EC';
      else if (r % 2 === 0)               bg = '#FBE9E7';
      // ด่วน → ส้มอ่อน
      if (itemSheet.getRange(r, 4).getValue() === 'Y') bg = '#FFF3E0';
      itemSheet.getRange(r, 1, 1, 10).setBackground(bg);
    }

    // legend row สุดท้าย
    const legendRow = itemSheet.getLastRow() + 2;
    itemSheet.getRange(legendRow, 1, 1, 10).merge();
    itemSheet.getRange(legendRow, 1).setValue(
      '✅ ส่งแล้ว (เขียว)   🔄 กำลังผลิต (เหลือง)   📦 เตรียมส่ง (น้ำเงิน)   📥 รับของแล้ว (ขาว)   🔁 กลับมาแก้ไข (ชมพู)   🔥 ด่วน (ส้ม)'
    );
    itemSheet.getRange(legendRow, 1).setFontColor('#546E7A').setFontStyle('italic').setFontSize(10);

    const itemW = [120,150,100,50,110,90,120,70,90,160];
    itemW.forEach((w,i) => itemSheet.setColumnWidth(i+1, w));
    itemSheet.setFrozenRows(2);
  }
}

// ── Default Master Lists (จาก 2567_06 Gantt สมบูรณ์.xlsx) ──
const DEFAULT_COMPANIES = [
  'ACE','ACG','ADEK','AFF','APD','BBT','BK','CCC','DB','JBM','MKP','OAP',
  'PPP','PPPPA','PQ','PRS','PY','SPN','SUN','TAS','TB','TFP','TPO',
  'TRIPLE-AUTO','TTS','คุณเก่ง','คุณเอ็กซ์','ธรรมนูญ','นก','สาโรจน์ A&T','ออโต้บาย'
];

const DEFAULT_MODELS = [
  'AH-R1','ALMERA','ALMERA 2020','ALMERA NISMO','ALPHARD',
  'ALTIS TAXI','ATTRAGE','ATTRAGE 17','ATTRAGE 2020','ATTRAGE R1',
  'CAMRY','CH-R','CH-R 18','CIAZ','CITY','CIVIC','CROSS 2020',
  'D-MAX','D-MAX 1.9','D-MAX 2021 V2','D-MAX ALL NEW',
  'EVEREST','EVEREST 22','FORD RANGER',
  'FORTUNER','FORTUNER 13','FORTUNER R1','HILUX CHAMP',
  'HONDA CITY','HONDA CIVIC','ISUZU',
  'MARCH','MARCH EURO','MARCH EURO SPORT',
  'MAZDA 2','MAZDA 2 2020','MAZDA 2 4D','MAZDA 2 5D','MAZDA 3 2020',
  'MG 5','MG ZS','MG ZS V9','MINI COOPER','MIRAGE','MIRAGE 2020','MITSU',
  'MU-X','MU-X 2021','MU-X 2021 V1','MU-X 2021 V2','MU-X 2021 V3',
  'NAVARA','NISSAN ALMERA','NISSAN ALMERA 2020','NISSAN MARCH EURO','NISSAN TERRA',
  'NOTE 17','PAJERO SPORT','RANGER','REVO','REVO 2020','SIENTA',
  'SUZUKI SWIFT','SUZUKI SWIFT 18','SUZUKI SWIFT 2020','SUZUKI SWIFT 2021 V3',
  'TOYOTA ATIV','TOYOTA REVO','TOYOTA VELOZ 2022','TRITON','TRITON 19','TRITON 2020',
  'VELOZ 2022','VIOS','VIOS 13','VIOS 17',
  'X-PANDER','X-PANDER 18','X-PANDER 2020',
  'YARIS','YARIS 17','YARIS 2020','YARIS 2021 S1',
  'YARIS ATIV 17','YARIS ATIV 2020','YARIS ATIV 2021 V1','YARIS ATIV 2023 HB',
  'รถกอฟล์','รถตู้','รถบัส','รถมอเตอร์ไซค์'
];

const DEFAULT_PARTS = [
  'กระจังหน้า','กันชน','กันชนหน้า','กันชนหน้า-หลัง',
  'กาบ 4 ชิ้น','กาบ 6 ชิ้น','กาบข้าง L/R','กาบประตู','กาบประตู 4 ชิ้น',
  'กาบประตูหน้า LH','กาบประตูหน้า RH','กาบประตูหลัง LH','กาบประตูหลัง RH',
  'ครอบป้ายทะเบียน','ครอบฝาหน้า','ครอบไฟตัดหมอก L/R','ครอบไฟท้าย L/R',
  'คาดเอว','คาดเอว มีไฟ','คิ้วล้อ','คิ้วล้อ 4 ชิ้น','คิ้วล้อ 8 ชิ้น',
  'คิ้วล้อหน้า L/R','คิ้วล้อหลัง L/R','คิ้วบังโคลนหน้า','คิ้วบังโคลนหลัง L/R',
  'บันได L/R','บันไดข้าง L/R',
  'สปอยเลอร์','สปอยเลอร์ มีไฟ','สปอยเลอร์ ยกสูง','สปอยเลอร์ 6 ชิ้น',
  'สเกิร์ต','สเกิร์ต 4 ชิ้น','สเกิร์ต 6 ชิ้น','สเกิร์ต+สปอยเลอร์',
  'สเกิร์ตข้าง','สเกิร์ตข้าง L/R','สเกิร์ตรอบคัน',
  'สเกิร์ตหน้า','สเกิร์ตหน้า-หลัง','สเกิร์ตหน้า-หลัง-ข้าง',
  'สเกิร์ตหลัง','สเกิร์ตหลัง L/R',
  'หน้ากระจัง','เดินกาว3M','เดินเทปกาว 2 หน้า','โรบาร์'
];

// ════════════════════════════════════════════════════════
//  ensureSheets — สร้าง sheet ถ้ายังไม่มี
// ════════════════════════════════════════════════════════
function ensureSheets(ss) {
  const needed = [SHEET_CONFIG, SHEET_PO, SHEET_ITEMS, SHEET_DASHBOARD];
  needed.forEach(name => {
    if (!ss.getSheetByName(name)) {
      const s = ss.insertSheet(name);
      if (name === SHEET_PO) {
        s.getRange(1,1).setValue('📋 PO TRACKER — รายการ PO (1 row = 1 ใบ PO)');
        s.getRange(2,1,1,13).setValues([PO_HEADERS_TH]);
        s.setFrozenRows(2);
      } else if (name === SHEET_ITEMS) {
        s.getRange(1,1).setValue('🔩 PO_ITEMS — รายละเอียดระดับชิ้นงาน (1 row = 1 ชิ้น)');
        s.getRange(2,1,1,10).setValues([ITEM_HEADERS_TH]);
        s.setFrozenRows(2);
      } else if (name === SHEET_CONFIG) {
        s.getRange(1,1).setValue('⚙️ CONFIG — รายชื่ออ้างอิง (ห้ามลบชีทนี้)');
        s.getRange(2,1,1,7).setValues([['บริษัท / ลูกค้า','รุ่นรถ','พาร์ท / ชิ้นงาน',
                                        'สถานะ PO','ด่วน','เคลม','สถานะชิ้น (PO_ITEMS)']]);
        // เขียน default lists ลง CONFIG ทันที
        const maxLen = Math.max(DEFAULT_COMPANIES.length, DEFAULT_MODELS.length, DEFAULT_PARTS.length);
        const rows = [];
        for (let i = 0; i < maxLen; i++) {
          rows.push([
            DEFAULT_COMPANIES[i] || '',
            DEFAULT_MODELS[i]    || '',
            DEFAULT_PARTS[i]     || ''
          ]);
        }
        if (rows.length > 0) s.getRange(3, 1, rows.length, 3).setValues(rows);
      }
    }
  });
}

// ════════════════════════════════════════════════════════
//  cleanEmptyRows — ลบ row ที่ไม่มีชิ้นงานออกจาก PO_ITEMS
//  วิธีใช้: เปิด Apps Script Editor → เลือก cleanEmptyRows → กด Run
// ════════════════════════════════════════════════════════
function cleanEmptyRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const itemSheet = ss.getSheetByName(SHEET_ITEMS);
  if (!itemSheet) { Logger.log('ไม่พบ Sheet: ' + SHEET_ITEMS); return; }

  const lastRow = itemSheet.getLastRow();
  if (lastRow <= 2) { Logger.log('ไม่มีข้อมูลให้เคลียร์'); return; }

  // อ่านข้อมูลทั้งหมดตั้งแต่ row 3
  const data = itemSheet.getRange(3, 1, lastRow - 2, 10).getValues();

  // เก็บเฉพาะ row ที่ column A (PO) และ column B (ชิ้นงาน) ไม่ว่างทั้งคู่
  const cleanRows = data.filter(row => {
    const po   = String(row[0] || '').trim();
    const part = String(row[1] || '').trim();
    // ข้าม legend row และ row ว่าง
    if (!po || po.startsWith('✅') || po.startsWith('🔄') || po.startsWith('📦') || po.startsWith('📥') || po.startsWith('🔁')) return false;
    if (!part) return false;
    return true;
  });

  // เคลียร์ข้อมูลเก่าทั้งหมดก่อน
  itemSheet.getRange(3, 1, lastRow - 2, 10).clearContent();

  // เขียน row ที่สะอาดกลับลงไป
  if (cleanRows.length > 0) {
    itemSheet.getRange(3, 1, cleanRows.length, 10).setValues(cleanRows);
  }

  Logger.log('✅ เคลียร์เรียบร้อย: เหลือ ' + cleanRows.length + ' rows จากทั้งหมด ' + data.length + ' rows');
  SpreadsheetApp.getUi().alert('✅ ทำความสะอาดเสร็จแล้ว!\nเหลือข้อมูลจริง: ' + cleanRows.length + ' ชิ้น\nลบ row ว่าง: ' + (data.length - cleanRows.length) + ' rows');
}

// ════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════
function clearDataRows(sheet) {
  var last = sheet.getLastRow();
  if (last > 2) {
    // ★★★ FIX v4: ใช้ deleteRows แทน clearContent
    // clearContent + breakApart ยังมีปัญหากับ merged cells ที่อยู่นอก data range
    // deleteRows ลบ rows จริงๆ ไม่เหลือ merged cells ค้าง
    sheet.deleteRows(3, last - 2);
  }
}

function formatDateOut(val) {
  if (!val || val === '') return '';
  // ★ Google Sheets อาจส่งมาเป็น Date object จริง
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0]; // yyyy-mm-dd
  }
  const s = String(val).trim();
  // ถ้าเป็น ISO อยู่แล้ว → ใช้เลย
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10);
  // ถ้าเป็น d/m/y (ข้อมูลเก่าที่เป็น พ.ศ. หรือ ค.ศ.) → แปลงเป็น ISO ค.ศ.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(-?\d{1,4})$/);
  if (m) {
    let yr = parseInt(m[3]);
    if (yr < 0) yr = yr + 2500 - 67;   // แก้ค่าติดลบจากสูตรเก่า
    if (yr < 100) yr += 2500;           // 67 → 2567
    if (yr > 2400) yr -= 543;           // พ.ศ. → ค.ศ.
    if (yr < 1900 || yr > 2100) return ''; // ค่าผิดปกติ
    return `${yr}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  }
  return '';
}

function formatDateIn(val) {
  if (!val || val === '') return '';
  // ★ เก็บเป็น dd/mm/yyyy ค.ศ. เช่น 21/03/2024
  // ไม่แปลงเป็น พ.ศ. เพื่อป้องกันปัญหาแปลงซ้ำ
  const s = String(val).trim();
  // ถ้าเป็น ISO (yyyy-mm-dd) → แปลงเป็น dd/mm/yyyy ค.ศ.
  const isoM = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoM) {
    const yr = parseInt(isoM[1]);
    if (yr > 2400) return `${parseInt(isoM[3])}/${parseInt(isoM[2])}/${yr - 543}`; // กรณี พ.ศ. หลุดเข้ามา
    return `${parseInt(isoM[3])}/${parseInt(isoM[2])}/${yr}`;
  }
  // ถ้าเป็น d/m/y อยู่แล้ว → ตรวจสอบแล้วคืนเป็น dd/mm/yyyy ค.ศ.
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(-?\d{1,4})$/);
  if (m) {
    let yr = parseInt(m[3]);
    if (yr < 0) yr = yr + 2500 - 67;   // แก้ค่าติดลบ
    if (yr < 100) yr += 2500;           // 67 → 2567
    if (yr > 2400) yr -= 543;           // พ.ศ. → ค.ศ.
    return `${parseInt(m[1])}/${parseInt(m[2])}/${yr}`;
  }
  return s;
}

// ★ แสดง dd/mm/yyyy ค.ศ. จาก ISO date — ใช้เฉพาะ Dashboard
function isoToDisplay(isoStr) {
  if (!isoStr) return '';
  const s = String(isoStr).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${parseInt(m[3])}/${parseInt(m[2])}/${parseInt(m[1])}`;
  // ถ้าเป็น d/m/y อยู่แล้ว → คืนเลย
  if (s.includes('/')) return s;
  return s;
}

function styleSection(range, color) {
  range.setBackground(color).setFontColor('#FFFFFF')
       .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('left');
}
function styleHeaderRow(range, color) {
  range.setBackground(color).setFontColor('#FFFFFF')
       .setFontWeight('bold').setHorizontalAlignment('center').setFontSize(11);
}
function styleValueRow(range) {
  range.setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center')
       .setBackground('#F8F9FA');
}
function styleTableHeader(range, color) {
  range.setBackground(color).setFontColor('#FFFFFF')
       .setFontWeight('bold').setHorizontalAlignment('center');
}


// ════════════════════════════════════════════════════════
//  ARCHIVE SYSTEM — ปิดรอบรายเดือน (v4.2)
//
//  วิธีทำงาน:
//  1. ทุกวันที่ 1 ของเดือน GAS รันอัตโนมัติ (Time-based Trigger)
//  2. หา PO ที่ status = 'Complete' ใน PO_LIST
//  3. ดูว่า PO นั้น Complete เดือนอะไร (ดูจากวันที่ชิ้นงานสุดท้ายถูกส่ง)
//  4. ย้าย PO + ชิ้นงานทั้งหมดไป Sheet "📦 Archive_YYYY_MM"
//  5. ลบออกจาก PO_LIST และ PO_ITEMS หลัก
//  6. PO ที่ยังไม่ Complete → ไม่แตะ ค้างอยู่ในหน้าหลักต่อไป
// ════════════════════════════════════════════════════════

// ── ชื่อ Sheet Archive (format: "📦 Archive_2026_03") ──
function archiveSheetName(year, month) {
  return '📦 Archive_' + year + '_' + String(month).padStart(2, '0');
}

// ════════════════════════════════════════════════════════
//  archiveCompletedPOs — ฟังก์ชันหลัก ปิดรอบรายเดือน
//  เรียกโดย Time-based Trigger อัตโนมัติทุกวันที่ 1
// ════════════════════════════════════════════════════════
function archiveCompletedPOs() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheets(ss);

    const poSheet   = ss.getSheetByName(SHEET_PO);
    const itemSheet = ss.getSheetByName(SHEET_ITEMS);

    // อ่านข้อมูลทั้งหมด
    const poData   = poSheet.getDataRange().getValues();
    const itemData = itemSheet.getDataRange().getValues();

    if (poData.length <= 2) {
      Logger.log('[Archive] ไม่มี PO ให้ archive');
      return { ok: true, archived: 0, message: 'ไม่มี PO ที่ Complete' };
    }

    // หา PO ที่ Complete
    const completePOs = [];
    const keepPORows  = [];   // rows ที่ยังค้างอยู่ (ไม่ archive)

    for (let r = 2; r < poData.length; r++) {
      const row    = poData[r];
      const poId   = String(row[1] || '').trim();
      const status = String(row[9] || '').trim();
      if (!poId) continue;

      if (status === 'Complete') {
        completePOs.push({ row: row, id: poId });
      } else {
        keepPORows.push(row);
      }
    }

    if (completePOs.length === 0) {
      Logger.log('[Archive] ไม่มี PO Complete ที่ต้อง archive');
      return { ok: true, archived: 0, message: 'ไม่มี PO ที่ Complete' };
    }

    Logger.log('[Archive] พบ PO Complete: ' + completePOs.length + ' รายการ');

    // แยก items ตาม PO
    const allItems = [];
    if (itemData.length > 2) {
      for (let r = 2; r < itemData.length; r++) {
        const row  = itemData[r];
        const po   = String(row[0] || '').trim();
        const part = String(row[1] || '').trim();
        if (!po || !part) continue;
        allItems.push({ row: row, po: po });
      }
    }

    // จัดกลุ่ม PO Complete ตามเดือน
    // ใช้ "เดือนปัจจุบัน - 1" เป็น archive เดือน
    // เหตุผล: ถ้า trigger รันวันที่ 1 มีนาคม → archive งานที่เสร็จก่อนวันนี้ → ไปเดือนกุมภา
    const now       = new Date();
    let   archYear  = now.getFullYear();
    let   archMonth = now.getMonth(); // getMonth() คืน 0-11, ไม่ +1 = เดือนก่อนหน้า
    if (archMonth === 0) { archMonth = 12; archYear--; } // กรณีรันเดือนมกราคม → archive ธันวาของปีก่อน

    const sheetName = archiveSheetName(archYear, archMonth);

    // สร้างหรือเปิด Archive Sheet
    let archSheet = ss.getSheetByName(sheetName);
    if (!archSheet) {
      archSheet = ss.insertSheet(sheetName);
      // ตั้ง Header (เฉพาะ Title + PO Header — ไม่ใส่ separator ตรงนี้!)
      const title = '📦 Archive เดือน ' + archMonth + '/' + archYear + ' — PO ที่ส่งงานครบแล้ว';
      archSheet.getRange(1, 1, 1, 13).merge();
      archSheet.getRange(1, 1).setValue(title);
      archSheet.getRange(1, 1).setBackground('#37474F').setFontColor('#FFFFFF')
               .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
      archSheet.getRange(2, 1, 1, 13).setValues([PO_HEADERS_TH]);
      archSheet.getRange(2, 1, 1, 13).setBackground('#546E7A').setFontColor('#FFFFFF')
               .setFontWeight('bold').setHorizontalAlignment('center');
      // ★ ไม่ใส่ separator "▼" ตรงนี้ — จะใส่ตอนเขียน items แทน (line ด้านล่าง)
      Logger.log('[Archive] สร้าง Sheet ใหม่: ' + sheetName);
    }

    // ★ Dedup check: ดู PO ที่อยู่ใน Archive Sheet แล้ว — ไม่เขียนซ้ำ
    const existingArchivePoIds = [];
    try {
      const archData = archSheet.getDataRange().getValues();
      for (let r = 2; r < archData.length; r++) {
        var cellB = String(archData[r][1] || '').trim();
        if (cellB.match(/^PO-/)) existingArchivePoIds.push(cellB);
      }
    } catch(e) {}

    // กรองเอาเฉพาะ PO ที่ยังไม่เคยอยู่ใน Archive
    var newCompletePOs = completePOs.filter(function(p) {
      return existingArchivePoIds.indexOf(p.id) < 0;
    });
    var skippedCount = completePOs.length - newCompletePOs.length;
    if (skippedCount > 0) {
      Logger.log('[Archive] ข้าม PO ที่ archive แล้ว: ' + skippedCount + ' รายการ');
    }

    // เขียน PO Complete ลง Archive Sheet (เฉพาะ PO ใหม่)
    const archLastRow = archSheet.getLastRow();
    let   writeRow    = archLastRow + 1;

    const poRowsToWrite = newCompletePOs.map(function(p) { return p.row; });
    if (poRowsToWrite.length > 0) {
      archSheet.getRange(writeRow, 1, poRowsToWrite.length, 13).setValues(poRowsToWrite);
      archSheet.getRange(writeRow, 1, poRowsToWrite.length, 13).setBackground('#E8F5E9');
      writeRow += poRowsToWrite.length;
    }

    // เขียน Items ของ PO ใหม่ ลง Archive Sheet (ต่อท้าย)
    // ★ ลบ PO Complete ทั้งหมดออกจาก PO_LIST (รวมที่ซ้ำด้วย — เพื่อ cleanup)
    const completePoIds = completePOs.map(function(p) { return p.id; });
    var newCompletePoIds = newCompletePOs.map(function(p) { return p.id; });
    const archiveItems  = allItems.filter(function(i) { return newCompletePoIds.indexOf(i.po) >= 0; });
    const keepItems     = allItems.filter(function(i) { return completePoIds.indexOf(i.po) < 0; });

    if (archiveItems.length > 0) {
      // separator row
      archSheet.getRange(writeRow, 1, 1, 10).merge();
      archSheet.getRange(writeRow, 1).setValue('🔩 รายละเอียดชิ้นงาน (' + archiveItems.length + ' ชิ้น)');
      archSheet.getRange(writeRow, 1).setBackground('#CFD8DC').setFontColor('#37474F').setFontWeight('bold');
      writeRow++;

      // item header
      archSheet.getRange(writeRow, 1, 1, 10).setValues([ITEM_HEADERS_TH]);
      archSheet.getRange(writeRow, 1, 1, 10).setBackground('#546E7A').setFontColor('#FFFFFF').setFontWeight('bold');
      writeRow++;

      const itemRowsToWrite = archiveItems.map(function(i) { return i.row; });
      archSheet.getRange(writeRow, 1, itemRowsToWrite.length, 10).setValues(itemRowsToWrite);
      archSheet.getRange(writeRow, 1, itemRowsToWrite.length, 10).setBackground('#F5F5F5');
    }

    // ── ลบ PO Complete ออกจาก PO_LIST หลัก ──
    clearDataRows(poSheet);
    if (keepPORows.length > 0) {
      poSheet.getRange(3, 1, keepPORows.length, 13).setValues(keepPORows);
    }

    // ── ลบ Items ของ PO Complete ออกจาก PO_ITEMS หลัก ──
    clearDataRows(itemSheet);
    if (keepItems.length > 0) {
      const keepItemRows = keepItems.map(function(i) { return i.row; });
      itemSheet.getRange(3, 1, keepItemRows.length, 10).setValues(keepItemRows);
    }

    // ── อัพเดท Dashboard ──
    const remainingPOs = keepPORows.map(function(row) {
      return {
        id: String(row[1] || ''), company: String(row[2] || ''),
        model: String(row[3] || ''), recv: formatDateOut(row[10]),
        due: formatDateOut(row[11]),
        urgent: row[12] === 'Y', status: String(row[9] || 'Order'),
        remark: String(row[4] || '')
      };
    });
    const remainingItems = keepItems.map(function(i) {
      const row = i.row;
      return {
        po: String(row[0] || ''), part: String(row[1] || ''),
        color: String(row[2] || ''), urgent: row[3] === 'Y',
        status: stripEmoji(String(row[4] || '')),
        sentDate: formatDateOut(row[5]), bundlePO: String(row[6] || ''),
        remark: String(row[9] || '')
      };
    });

    formatAllSheets(ss, remainingPOs, remainingItems);
    updateDashboard(ss, remainingPOs, remainingItems);

    var newMsg = '✅ Archive สำเร็จ: ย้าย ' + newCompletePOs.length + ' PO ใหม่ (' + archiveItems.length + ' ชิ้น) → ' + sheetName;
    if (skippedCount > 0) newMsg += ' (ข้าม ' + skippedCount + ' PO ที่ archive แล้ว)';
    // ★ ลบ PO Complete ออกจาก PO_LIST ทั้งหมด (รวมที่ซ้ำ) เพื่อ cleanup
    newMsg += ' — ลบ PO Complete ออกจากหน้าหลัก ' + completePOs.length + ' รายการ';
    Logger.log('[Archive] ' + newMsg);
    return { ok: true, archived: newCompletePOs.length, items: archiveItems.length, skipped: skippedCount, sheet: sheetName, message: newMsg };

  } finally {
    lock.releaseLock();
  }
}

// ════════════════════════════════════════════════════════
//  getArchiveList — ส่งรายชื่อ Archive Sheets ทั้งหมดให้แอป
// ════════════════════════════════════════════════════════
function getArchiveList() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheets  = ss.getSheets();
  const archives = [];
  sheets.forEach(function(s) {
    const name = s.getName();
    if (name.startsWith('📦 Archive_')) {
      const match = name.match(/Archive_(\d{4})_(\d{2})/);
      if (match) {
        // ★ นับ PO/Items แบบ robust — PO row = มี PO-xx ใน col B, อยู่ก่อน separator
        // Items = อยู่หลัง separator (🔩 หรือ ▼)
        let poCount   = 0;
        let itemCount = 0;
        try {
          const data = s.getDataRange().getValues();
          let inItems = false;
          for (let r = 2; r < data.length; r++) {
            const cellA = String(data[r][0] || '').trim();
            const cellB = String(data[r][1] || '').trim();
            // separator row → switch to items mode
            if (cellA.startsWith('🔩') || cellA.startsWith('▼')) { inItems = true; continue; }
            // skip header rows ซ้ำ
            if (cellA === 'No.' || cellB === 'เลขที่ PO' || cellA === 'เลขที่ PO') continue;
            if (inItems) {
              // item row: col A = po_id, col B = part name
              const part = cellB;
              if (part && cellA) itemCount++;
            } else {
              // PO row: col B = po_id (e.g. PO-67-008)
              if (cellB && cellB.match(/^PO-/)) poCount++;
            }
          }
        } catch(e) {}
        archives.push({
          sheet:     name,
          year:      parseInt(match[1]),
          month:     parseInt(match[2]),
          poCount:   poCount,
          itemCount: itemCount
        });
      }
    }
  });
  // เรียงจากใหม่ → เก่า
  archives.sort(function(a, b) {
    return (b.year * 100 + b.month) - (a.year * 100 + a.month);
  });
  return { ok: true, data: archives };
}

// ════════════════════════════════════════════════════════
//  getArchiveData — ดึงข้อมูล PO จาก Archive Sheet ที่ระบุ
// ════════════════════════════════════════════════════════
function getArchiveData(sheetName) {
  if (!sheetName) return { ok: false, error: 'ต้องระบุชื่อ Sheet' };
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'ไม่พบ Sheet: ' + sheetName };

  const data  = sheet.getDataRange().getValues();
  const pos   = [];
  const items = [];

  // ★ Two-pass approach: แยก PO rows กับ Item rows แบบ robust
  // หา separator row (🔩 หรือ ▼) ที่มี "รายละเอียดชิ้นงาน" หรือ "ชิ้น"
  let separatorIdx = -1;
  for (let r = 2; r < data.length; r++) {
    const cell = String(data[r][0] || '').trim();
    if (cell.startsWith('🔩') || (cell.startsWith('▼') && cell.indexOf('รายละเอียด') >= 0)) {
      separatorIdx = r;
      break;
    }
  }

  // อ่าน PO rows — อยู่ระหว่าง header (row 2) กับ separator
  // ★ แก้ bug: ถ้า sheet เก่ามี separator ที่ row 3 (ก่อน PO) → PO จะอยู่หลัง separator
  // ตรวจสอบโดยดูว่า row หลัง separator มี PO-xx pattern ใน col B หรือไม่

  // กลยุทธ์: scan ทุก row ที่ไม่ใช่ header/separator
  // ถ้า col B match PO-xx → เป็น PO row
  // ถ้า col A match PO-xx (และ col B มีชื่อชิ้นงาน) → เป็น item row
  for (let r = 2; r < data.length; r++) {
    const row  = data[r];
    const cellA = String(row[0] || '').trim();
    const cellB = String(row[1] || '').trim();

    // skip separator rows
    if (cellA.startsWith('🔩') || cellA.startsWith('▼')) continue;
    // skip header rows ซ้ำ
    if (cellA === 'No.' || cellB === 'เลขที่ PO' || cellA === 'เลขที่ PO') continue;
    if (!cellA && !cellB) continue;

    // ตรวจสอบว่าเป็น PO row หรือ item row
    if (cellB && cellB.match(/^PO-/)) {
      // PO row: col A=No., col B=po_id, col C=company...
      pos.push({
        po_id:     cellB,
        company:   String(row[2] || ''),
        model:     String(row[3] || ''),
        recv_date: formatDateOut(row[10]),
        due_date:  formatDateOut(row[11]),
        urgent:    row[12] === 'Y',
        status:    String(row[9] || 'Complete'),
        remark:    String(row[4] || '')
      });
    } else if (cellA && cellA.match(/^PO-/) && cellB) {
      // Item row: col A=po_id, col B=part name
      items.push({
        po_id:     cellA,
        item_name: cellB,
        color:     String(row[2] || ''),
        urgent:    row[3] === 'Y',
        status:    stripEmoji(String(row[4] || '')),
        sent_date: formatDateOut(row[5]),
        bundle_po: String(row[6] || ''),
        remark:    String(row[9] || '')
      });
    }
  }
  return { ok: true, data: { pos: pos, items: items }, sheet: sheetName };
}

// ════════════════════════════════════════════════════════
//  installMonthlyTrigger — ติดตั้ง Trigger อัตโนมัติ
//  วิธีใช้: เปิด Apps Script → เลือกฟังก์ชันนี้ → กด Run ครั้งเดียวพอ
//  หลังจากนั้น GAS จะรัน archiveCompletedPOs() ทุกวันที่ 1 อัตโนมัติ
// ════════════════════════════════════════════════════════
function installMonthlyTrigger() {
  // ลบ Trigger เก่าที่ชื่อ archiveCompletedPOs ออกก่อน (ป้องกันซ้ำ)
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'archiveCompletedPOs') {
      ScriptApp.deleteTrigger(t);
      Logger.log('[Trigger] ลบ trigger เก่าออกแล้ว');
    }
  });

  // สร้าง Trigger ใหม่ — รันวันที่ 1 ของทุกเดือน เวลา 01:00-02:00
  ScriptApp.newTrigger('archiveCompletedPOs')
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();

  Logger.log('[Trigger] ✅ ติดตั้ง Monthly Trigger สำเร็จ — จะรันทุกวันที่ 1 เวลา 01:00');
  SpreadsheetApp.getUi().alert(
    '✅ ติดตั้ง Trigger สำเร็จ!\n\n' +
    'ระบบจะ Archive PO ที่ Complete อัตโนมัติ\n' +
    'ทุกวันที่ 1 ของเดือน เวลา 01:00 น.\n\n' +
    'ไม่ต้องทำอะไรเพิ่มอีกแล้ว'
  );
}
