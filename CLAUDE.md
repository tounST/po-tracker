# Memory — PO Tracker Project

## เจ้าของโปรเจค (Boss)
| | |
|---|---|
| **ชื่อ** | toun (tounzx2@gmail.com) |
| **บทบาท** | เจ้าของโรงงานพ่นสีชิ้นส่วนยานยนต์ ABS/PP |
| **พื้นฐาน tech** | ศูนย์ — ไม่เคยเขียน code ไม่เคยเป็น developer มาก่อนเลย |
| **สไตล์การสื่อสาร** | ตรงไปตรงมา วิเคราะห์เป็นข้อ สรุปท้าย |

## วิธีคุยกับ toun
- **ใช้ศัพท์เทคนิคได้** แต่ถ้าถามต้องอธิบายละเอียดทีละขั้น ไม่ข้ามขั้นตอน
- อธิบายเหมือน pitch ลูกค้า — เข้าใจง่าย ทำตามได้ทันที
- ไม่สมมติว่ารู้แล้ว เช่น ถ้าบอกให้ "deploy" ต้องอธิบายทุก step
- ถ้าทำได้เองเลย → ทำให้เลย ไม่ต้องรออธิบาย

## ⚠️ กฎสำคัญ — ห้ามทำโดยเด็ดขาด
- **ห้ามสร้าง Google Apps Script ใหม่** — มี GAS อยู่แล้ว ให้แก้ไขใน project เดิมเท่านั้น
- **ห้ามสร้าง Google Sheet ใหม่** — มี Sheet อยู่แล้ว ชื่อ sheet คงที่ตามที่กำหนดใน GAS
- **ห้าม overwrite ข้อมูลใน Sheet** — ถ้าต้องแก้ GAS ให้วาง code ทับใน project เดิม แล้ว New Deployment เท่านั้น
- **ถ้าไม่แน่ใจ → ถามก่อนเสมอ อย่าสร้างอะไรใหม่เอง**
- **Branch main = production** — ห้ามแก้ main โดยตรง ถ้ากำลัง dev feature ใหม่ ให้ทำใน branch dev เท่านั้น

## โปรเจคปัจจุบัน — PO Tracker
| | |
|---|---|
| **URL (Production)** | https://tounst.github.io/po-tracker/po-mobile.html |
| **Repo** | https://github.com/tounST/po-tracker |
| **Stack (Production)** | GitHub Pages + Supabase (PostgreSQL) |
| **Stack (Legacy)** | Google Apps Script + Google Sheets (ไม่ใช้แล้ว เก็บเป็น backup) |
| **Branch main** | Production — ต่อ Supabase แล้ว (po-mobile.html ~3300 lines) |
| **GAS URL (Legacy)** | https://script.google.com/macros/s/AKfycbxIJ5kQPLI_zbRpf7eIDaADs68jBaY8IZLn5IkqeHOrkIGqD_Tz1lAUa5EXQbbdGNGU/exec |
| **GAS Version** | v4.6-REWORK-FLAG-2026-03-24 |

## Supabase (New Backend)
| | |
|---|---|
| **Project ID** | rkdxbxtakvisroxelrvq |
| **Project URL** | https://rkdxbxtakvisroxelrvq.supabase.co |
| **Anon Key** | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHhieHRha3Zpc3JveGVscnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzM2MjgsImV4cCI6MjA4OTkwOTYyOH0.KvTaFrdXCERYl77hVt5x5_udMQn7YSy6GFdDoyu9bOU |
| **Region** | South Asia (Mumbai) — ap-south-1 |
| **Status** | ✅ Tables สร้างเสร็จ + ข้อมูลย้ายจาก GAS เรียบร้อย |

### Supabase Tables
| Table | หน้าที่ | แทน Google Sheet |
|---|---|---|
| `po_list` | PO headers (po_number, company, car_model, order_date, due_date, po_status, remark) | 📋 PO_LIST |
| `po_items` | ชิ้นงาน (part_name, color, status, rework flag, sent_date, bundle_po) — FK ไป po_list | 🔩 PO_ITEMS |
| `config` | Master lists dropdown (config_type: company/car_model/part_name) | ⚙️ CONFIG |
| `users` | ผู้ใช้ + จุดงาน (role: admin/staff, station: all/receiving/production/shipping) | ใหม่ |
| `activity_log` | บันทึกว่าใครทำอะไรเมื่อไหร่ (action, target_type, detail JSONB) | ใหม่ |

### Supabase Connection Code (ใช้ใน po-mobile.html)
```javascript
const SUPABASE_URL = 'https://rkdxbxtakvisroxelrvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZHhieHRha3Zpc3JveGVscnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzM2MjgsImV4cCI6MjA4OTkwOTYyOH0.KvTaFrdXCERYl77hVt5x5_udMQn7YSy6GFdDoyu9bOU';
// ใช้ supabase-js CDN: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
```

## ไฟล์สำคัญ (อยู่ใน repo root)
| ไฟล์ | หน้าที่ |
|---|---|
| `po-mobile.html` | แอปหลัก — single-file PWA ทั้ง HTML/CSS/JS |
| `sw.js` | Service Worker — cache v5 + offline |
| `manifest.json` | PWA — install เป็นแอปบนมือถือได้ |
| `po-tracker-gas.js` | GAS backend code — copy วางใน Apps Script Editor |
| `gas-code-to-paste.txt` | สำเนาของ po-tracker-gas.js สำหรับ copy วาง |
| `docs/superpowers/specs/` | Design specs สำหรับฟีเจอร์ที่ brainstorm แล้ว |

## สถานะชิ้นงาน (Item Statuses)
- 4 สถานะหลัก: **รับของแล้ว, กำลังผลิต, เตรียมส่ง, ส่งแล้ว**
- **"กลับมาแก้ไข"** = toggle flag แยกจากสถานะ (rework: true/false)
  - เปิด toggle → badge แสดง "🔁 แก้ไข" + สถานะปัจจุบัน เช่น "🔁 แก้ไข 🔄 กำลังผลิต"
  - เก็บใน Google Sheet column K ของ 🔩 PO_ITEMS (Y/ว่าง)
- 4 สถานะ PO (คำนวณอัตโนมัติ): Order, In progress, Partial Send, Complete

## Google Sheet Structure
| Sheet | หน้าที่ |
|---|---|
| `📋 PO_LIST` | PO headers (8 columns: A-H) |
| `🔩 PO_ITEMS` | Item details (11 columns: A-K, K=rework flag) |
| `⚙️ CONFIG` | Master lists (บริษัท, รุ่นรถ, ชิ้นงาน) |
| `📊 DASHBOARD` | สรุปภาพรวม (GAS เขียนอัตโนมัติ) |
| `📦 Archive_YYYY_MM` | Archive รายเดือน |

## Bugs ที่แก้ไปแล้วทั้งหมด
| Bug | สถานะ |
|---|---|
| BUG1: fetchFromSheet race condition | ✅ Fixed |
| BUG2: deletePO no rollback | ✅ Fixed |
| BUG3: fixDateStr timestamp | ✅ Fixed |
| BUG4: plain text password → SHA-256 | ✅ Fixed |
| BUG5: PWA manifest + SW registration | ✅ Fixed |
| Chrome ERR_TOO_MANY_REDIRECTS | ✅ Fixed (JSONP → fetch + credentials:omit) |
| sw.js chrome-extension scheme error | ✅ Fixed |
| Complete PO แสดง "เลยกำหนด X วัน" | ✅ Fixed → แสดง "✅ ส่งครบแล้ว" |
| Archive detail แสดง "ไม่มีข้อมูล" | ✅ Fixed → rewrite parser ใช้ PO-ID pattern matching |
| Archive ข้อมูลซ้ำเมื่อกดปุ่มหลายครั้ง | ✅ Fixed → dedup check ก่อนเขียน |
| BUG6: วันที่เลื่อน ±1 วัน (timezone) | ✅ Fixed (2026-04-10) → เปลี่ยน toISOString() เป็น localISO() ทุกจุด |
| BUG7: Save bar บังข้างล่าง scroll ไม่ได้ | ✅ Fixed (2026-04-20) → body.has-save-bar padding ขยาย 170px |
| BUG8: QC Pass/Fail "เลือกชิ้นงานก่อน" หลัง auto-refresh | ✅ Fixed (2026-04-20) → เก็บ selection ด้วย `_sbId` แทน array index (index เพี้ยนเมื่อ db.items ถูก refresh ทุก 30 วิ) |
| BUG9: QC Pass/Fail เขียน DB ทันทีแล้ว switchTab | ✅ Fixed (2026-04-20) → Pass/Fail เป็นแค่ stage decision, บันทึกผ่าน main save bar path เดียว |
| BUG10: Item selection ghost-click/hang บนมือถือ | ✅ Fixed (2026-04-20) → inline onclick → data-sbkey + event delegation; touch-action: manipulation |
| BUG11: Save bar ค้าง "บันทึก N ชิ้น" หลัง save เสร็จ | ✅ Fixed (2026-04-20) → hide `.show` + body.has-save-bar ทั้งใน saveUpdate + openPoItems |
| BUG12: Archive แล้ว Update tab ยังโชว์ PO ที่ archive | ✅ Fixed (2026-04-20) → `await loadFromSupabase()` + assign db + renderDashboard หลัง archive/unarchive |
| BUG13: QC panel ค้างโชว์เมื่อเปิด PO อื่น | ✅ Fixed (2026-04-20) → backToPoList ล้าง qc-panel display + qc-decision .selected + qc-fail-detail ครบ |
| BUG14: ปุ่ม + Add PO ไม่อยู่กลางเมื่อบาง role | ✅ Fixed (2026-04-20) → CSS `order` split tabs ซ้าย/ขวา รอบ primary ตาม visible count |

## สิ่งที่ทำเสร็จแล้ว
- ✅ ระบบ Archive ปิดรอบรายเดือน (GAS + UI ครบ)
- ✅ Complete PO แสดง "✅ ส่งครบแล้ว" แทนเตือน overdue
- ✅ Archive parser ใช้ pattern-based (robust ทั้ง format เก่า/ใหม่)
- ✅ Dedup protection ใน archiveCompletedPOs()
- ✅ Bundle PO selector สำหรับทั้ง "เตรียมส่ง" และ "ส่งแล้ว"
- ✅ "กลับมาแก้ไข" เปลี่ยนเป็น toggle flag (ไม่ใช่สถานะ)
- ✅ ยุบช่องเพิ่มชิ้นงานเหลือ "เพิ่มหลายชิ้นพร้อมกัน" อันเดียว
- ✅ PWA ติดตั้งเป็นแอปบนมือถือได้
- ✅ ระบบ QC Inspection + defect tracking (defect reasons จาก config table)
- ✅ Defect reason management ในหน้าจัดการ (CRUD สาเหตุ defect)
- ✅ **Supabase migration เสร็จสมบูรณ์** — po-mobile.html ต่อ Supabase แทน GAS แล้ว
- ✅ **PIN login + User account** — login ด้วย PIN 4 หลัก, ดึง user จาก Supabase table `users`
- ✅ **Activity Log** — บันทึกทุก action (login, logout, add/edit/delete PO, archive, etc.)
- ✅ **Role & Permission system** — admin/supervisor/manager/staff + station-based access
- ✅ **User Management Panel** — หน้าจัดการผู้ใช้ (Admin only) ในหน้าจัดการ
  - CRUD ผู้ใช้: เพิ่ม/แก้ไข/ลบ user + validation (username/PIN ห้ามซ้ำ)
  - PIN toggle แสดง/ซ่อน (default ••••, กด 👁 เพื่อดู)
  - Station checkbox group (all/receiving/production/qc/shipping)
  - บันทึก activity_log ทุกการ add/edit/delete user
- ✅ **UI Refresh** — topbar gradient + pill-tab nav + เพิ่ม font-size ทั้งแอป
- ✅ **Archive: เอากลับ + ลบถาวร** (2026-03-25)
  - ปุ่ม ⋯ dropdown menu บน PO card ใน Archive detail (Admin only)
  - 🔄 เอากลับ → unarchive (is_archived=false) กลับหน้าหลัก
  - 🗑️ ลบถาวร → DELETE po_items + po_list จาก database
  - บันทึก activity_log ทุกครั้ง
  - ลบจนเดือนว่าง → กลับ archive home อัตโนมัติ
- ✅ **เลข PO format ใหม่** — default เปลี่ยนจาก `PO-67-xxx` เป็น `PO-YYMMDD-xx` (เช่น PO-260325-01)
  - แต่ละวันเริ่มนับ 01 ใหม่, auto-increment ตาม PO ที่มีอยู่ในวันนั้น
  - เป็นแค่ค่า default — user พิมพ์ทับได้ตลอดตามรูปแบบลูกค้า
- ✅ **Archive Export Excel** — ปุ่ม "📥 Export Excel" ในหน้า archive detail
  - เลือกเดือนใน archive → กดปุ่ม → ได้ไฟล์ `Archive-YYYY-MM.xlsx`
  - Sheet 1: สรุป PO (เลขที่, บริษัท, รุ่นรถ, วันรับ/ส่ง, สถานะ, จำนวนชิ้น)
  - Sheet 2: รายการชิ้นงานทั้งหมด (สถานะ, สี, วันส่ง, bundle PO)
  - Header สีม่วง (theme เข้ากับ Archive), แถวสลับสี, ชิ้นที่ส่งแล้วไฮไลท์เขียว
- ✅ **แก้บั๊กวันที่เลื่อน ±1 วัน** (2026-04-10)
  - สาเหตุ: ใช้ `toISOString()` ซึ่งคืน UTC — ไทย UTC+7 ทำให้ช่วง 00:00-06:59 วันที่ถอยหลัง 1 วัน
  - แก้: สร้าง `localISO(d)` ใช้ `getFullYear/getMonth/getDate` แทน ทั้ง 4 จุด
  - จุดที่แก้: `todayISO()`, `fixDateStr()` (2 จุด), Export filename
- ✅ **Mobile UI Redesign ตาม design handoff** (2026-04-20) — ดูรายละเอียดใน "Phase 2C" ด้านล่าง
- ✅ **Stabilization Pass — production bug sweep** (2026-04-20) — 7 bugs (BUG8-14) + 3 features จาก real-device testing
  - **QC flow rework**: Pass/Fail ไม่เขียน DB ทันทีแล้ว; stage decision → main save bar commits (path เดียวเหมือน status อื่น)
  - **Selection stability**: เปลี่ยน array-index → `_sbId` เป็น stable key, survives auto-refresh ทุก 30 วิ
  - **Mobile responsiveness**: event delegation + `touch-action: manipulation` แก้ ghost tap, 300ms delay
  - **State cleanup discipline**: `backToPoList` + `openPoItems` + `saveUpdate` ล้าง state ครบทุก path (qc-panel, qc-decision, save bar)
  - **QC-passed chip**: "ผ่าน QC · เตรียมส่ง" สีเขียวแทน "QC" สีม่วง เมื่อ qcPassed=true
  - **Archive "ปิด PO"**: แสดงวันที่ปิด = MAX(sent_date) ของ items ในแต่ละ PO card
  - **Archive delete month** (Admin only): ปุ่มลบทั้งเดือน + double confirm เพื่อเคลียร์ข้อมูลที่ export แล้ว
  - **Tab bar balanced per role**: ปุ่ม + (Add PO) centered เสมอ, tabs ที่ visible แบ่งซ้าย/ขวาเท่า ๆ กันผ่าน CSS `order`

## 🗺️ แผนพัฒนา (Development Roadmap)

---

### ✅ Phase 2A — โหมดจุดงาน + Partial Update (เสร็จแล้ว)
- ✅ โหมดจุดงาน — role/station-based access control
- ✅ Partial Update — Supabase update ทีละ row (ไม่ overwrite ทั้ง sheet)

---

### ✅ Phase 2B — Migrate ไป Supabase (เสร็จแล้ว)
- ✅ สร้าง Supabase project + tables + ย้ายข้อมูล
- ✅ แก้ po-mobile.html ต่อ Supabase แทน GAS (supabase-js client)
- ✅ PIN login + User account + Activity Log
- ✅ Role & Permission system + User Management CRUD
- ✅ QC Inspection + Defect tracking
- ✅ Archive: เอากลับ + ลบถาวร

---

### ✅ Phase 2C — Mobile UI Redesign (เสร็จแล้ว 2026-04-20)
**สรุป**: ปรับหน้าตาทั้งแอปตาม design handoff `For mobile/PO tracker (1)/po_tracker_handoff/` — **~25 commits**
Design tokens จาก `tokens.css` (official) — Terracotta accent + warm cream palette

**L1 — Theme colors** (`3095d7f`)
- เปลี่ยน :root variables จาก blue → warm neutral + terracotta `#B85C3C`
- Status badges, topbar gradient, meta theme-color

**L2 — Component refinement** (`76dd4c3`, `2495731`)
- Cards: ลบ drop shadow → border 1px
- Form inputs: radius 10, border 1px, focus terracotta
- Buttons: hover brightness, outline variant
- Topbar: solid shadow → subtle border

**L3-A — Hero Stat Card** (`9840808`)
- Dark ink card บน Dashboard: 48px active PO number + 4-col split (ส่ง/ผลิต/QC/แก้ไข)

**L3-B — Urgent section + Due-soon** (`7b10509`, `4e25bca`)
- Urgent: flame icon + borderLeft danger, cap 5 POs, count chip
- Due-soon: horizontal scroll 2 cards, tone ตาม days-left

**Token migration + Login redesign** (`1de1467`, `0f186d6`)
- ใช้ tokens.css มาตรฐาน (--accent, --ink, --surface, etc.)
- Login: PO brand mark + PIN pad ใหม่ + cream bg

**POCard + SegmentedProgress + DueChip** (`bacb03d`)
- Mono PO number, 🔥 pulse animation, segmented bar ตาม status

**Screen-by-screen redesign** (`5741621`, `1a34ea5`, `9cd7cde`, `7acb3ec`, `b66d990`, `56bb491`, `13e9f01`)
- PO Detail modal (stats row + progress + grouped items)
- Update tab (selection banner, status picker, sticky save bar)
- QC dark hero + 2 decision cards
- Archive month cards + PO cards
- Manage tabs + User cards + tag chips
- Sync modal

**Minimalize** (`5e73cd7`, `fa24fc1`, `bb460f6`, `9e2a681`, `2ebc8fc`)
- ลบ Quick Actions (redundant กับ bottom tab)
- Emoji → SVG line icons (1.7 stroke)
- Update page: full detail layout (company/stats/progress/grouped)
- Status picker: icon + text (ไม่ใช่แค่สี)
- Status chip ต่อท้ายชื่อชิ้นงาน
- Typography hierarchy: PO number เด่นเป็น heading
- Fix save bar bug — body padding ขยายเมื่อ save bar ขึ้น

**Filter chips + Bottom tab bar** (`fc0a262`, `b8a599c`)
- Bottom tab bar fixed + center terracotta ➕ primary
- Filter chips แทน dropdown (กำลังทำ/ด่วน/บางส่วน/เสร็จ/ทั้งหมด)

---

### 🔨 กำลังทำอยู่ตอนนี้ (As of 2026-04-20)
**ไม่มี** — Mobile UI เสร็จสมบูรณ์แล้ว กำลังรอ user ทดสอบใช้งานจริง

---

### 📋 ขั้นตอนที่เหลือ (เรียงตามลำดับ)

#### **🎯 ลำดับ 1: PC Version** (parked — ทำเมื่อ Mobile stable)
จาก design bundle `For PC/_unzip/po_tracker_handoff/` — 8 หน้าจอ desktop layout
- [ ] Desktop Shell: Sidebar 248px ซ้าย + Topbar บน
- [ ] Dashboard — Sidebar + KPI row + 2-col (due list + activity)
- [ ] PO List — ตาราง 9 คอลัมน์ (data table)
- [ ] PO Detail — main + 340px side panel (timeline, notes)
- [ ] Create PO — form ซ้าย + sticky summary ขวา
- [ ] QC Inspect — queue grid 3-col + inspect panel 400px
- [ ] Archive — month cards 4-col + stats
- [ ] Manage — tabs + role breakdown
- **เวลาประเมิน**: 2-5 วัน | **ทำใน**: `@media (min-width: 1024px)` block

#### **⭐ ลำดับ 2: Phase 3 — ฟีเจอร์ธุรกิจ** (6 ฟีเจอร์)
- [ ] โหมดจุดงาน UI จริง — หลัง login แต่ละ station เห็นเฉพาะ tab/ฟีเจอร์ที่จำเป็น
- [ ] ระบบสต๊อกวัตถุดิบ/สี — เพิ่ม table `stock`, `stock_movements` ใน Supabase
- [ ] ระบบคิดต้นทุน — คำนวณต้นทุน PO จากชิ้น × สี + ค่าแรง (SQL view)
- [ ] Line แจ้งเตือน — Supabase Edge Function + Line Notify webhook (เตือนลูกค้าเมื่อส่ง)
- [ ] เชื่อม n8n workflow — เปิด REST API สำหรับ automation
- [ ] Dashboard สรุปยอดผลิต/ส่ง — chart ยอดรายเดือน, top customers, top parts

#### **🛡️ ลำดับ 3: Hardening + Backup** (ควรทำก่อน user เยอะขึ้น)
- [ ] Supabase auto backup — ตั้ง scheduled backup รายวัน (Supabase Pro หรือ custom script)
- [ ] Row Level Security (RLS) — แต่ละ user เห็นเฉพาะข้อมูลที่ตัวเองเกี่ยวข้อง
- [ ] Supabase Realtime — เปลี่ยน fetch เป็น subscribe (ลูกน้อง 2 คน update พร้อมกันเห็น real-time)
- [ ] Error monitoring — log JS errors ขึ้น Supabase table หรือ Sentry free tier
- [ ] Rate limit — กัน abuse ผ่าน Edge Function middleware

#### **🚀 ลำดับ 4: Phase 4 — Scale Up** (เมื่อธุรกิจโตจริง)
- [ ] Mobile app จริง (React Native / Flutter) — ถ้ามีคนใช้ 100+
- [ ] Multi-tenant — รองรับหลายโรงงาน (ถ้า toun เปิดสาขา)
- [ ] Photo upload จริง — ใช้ Supabase Storage (รับของ + QC)
- [ ] Customer portal — ลูกค้า login มาดู status PO ของตัวเองได้

#### **🌏 ลำดับ 5: Optional — i18n TH/EN → MY/EN** (ยังไม่ตัดสินใจว่าทำ)
เพิ่ม toggle ภาษาให้ส่วนที่เป็นภาษาไทย → เปลี่ยนเป็นภาษาพม่าได้ (ส่วนที่เป็น English คงเดิม, user-entered data ไม่แปล)
- [ ] ระบบ i18n (แนะนำ: hybrid — `data-i18n` attribute สำหรับ static label + `t(key)` function สำหรับ template literal)
- [ ] Burmese font loading (Noto Sans Myanmar จาก Google Fonts สำหรับ iOS/old Windows)
- [ ] Language switcher UI (ตำแหน่งยังไม่ตกลง)
- [ ] Map display labels ของ item status จาก Thai ใน DB → Burmese ตอน render (ไม่แก้ schema)

**คำถามค้างที่ต้องถาม toun ก่อนเริ่ม** — อย่าเริ่ม code จนกว่าจะได้ทุกคำตอบ:
1. **ลูกน้องที่จะใช้ Burmese**: มีแล้วกี่คน? ใช้ role ไหน (staff/supervisor)?
2. **แหล่ง translation**: toun ให้รายการ TH→MY เอง (แม่นยำ 100%) หรือให้ฉันลองแปลก่อนแล้ว review?
3. **Scope เฟส 1**: เริ่มจาก Login + Dashboard + Update tab + PIN pad ก่อน (ส่วนที่ staff เห็นบ่อย) ค่อย expand — ok ไหม?
4. **Language switcher ตรงไหน**: (A) Topbar chip ข้างปุ่ม logout — แนะนำ; (B) หน้า login; (C) หน้า "จัดการ"; (D) auto ตาม `preferred_language` ใน `users` table (เพิ่ม column)?

**Decision log**: DB statuses (`'รับของแล้ว'`, `'กำลังผลิต'`, ...) เก็บเป็น Thai **data** — แปลง label ตอน render เท่านั้น. ไม่ migrate เป็น enum code เพราะจะกระทบทุก query ที่ `.eq('status', 'กำลังผลิต')` ใน codebase

---

### สรุปจำนวนขั้นตอนที่เหลือ
| ระดับ | จำนวนงาน | เวลาประเมิน |
|---|---|---|
| **1. PC Version** | 8 หน้าจอ | 2-5 วัน |
| **2. Phase 3 ฟีเจอร์ธุรกิจ** | 6 ฟีเจอร์ | 2-4 สัปดาห์ |
| **3. Hardening + Backup** | 5 งาน | 3-5 วัน |
| **4. Phase 4 Scale Up** | 4 งาน | ~1-2 เดือน |
| **5. Optional — i18n Burmese** | 4 งาน | 1-2 สัปดาห์ (ถ้าทำ) |
| **รวม (ไม่รวม optional)** | **~23 งาน** | **~2-3 เดือน** |

## Architecture & Decision Log
- **ทำไมใช้ JSONP → fetch + credentials:omit**: Chrome ส่ง Google session cookie กับ JSONP → GAS redirect loop
- **ทำไมใช้ GitHub Pages + GAS**: toun ไม่มี server, ไม่มี budget — ใช้ฟรีทั้งหมด
- **ทำไมย้ายไป Supabase**: GAS ไม่รองรับ multi-user concurrent write, ไม่มี real database, query ช้า, ไม่มี realtime
- **Archive logic**: archive ตามเดือนที่ PO Complete, PO ที่คาบเกี่ยวเดือนให้ค้างไว้จนกว่าจะ Complete
- **SHA-256 password**: เดิมเป็น plain text → แก้เป็น hash แล้ว (จะเปลี่ยนเป็น PIN + Supabase auth ในอนาคต)
- **กลับมาแก้ไข = toggle flag**: ไม่ใช่สถานะแยก เพราะต้องดูได้ว่าของที่ตีกลับมาอยู่ขั้นตอนไหนแล้ว
- **Branch strategy**: main = production (save slot 1), dev = ทดลอง (save slot 2), merge เมื่อพร้อม
- **GAS deploy flow** (Legacy): แก้โค้ด → วาง code ทับใน Apps Script Editor → New Deployment → copy URL ใหม่ → อัพเดท HARDCODED_GAS_URL ใน po-mobile.html
- **Supabase migration strategy**: แก้ po-mobile.html ให้ต่อ Supabase แทน GAS → GAS ยังเก็บไว้เป็น backup → เมื่อ Supabase version stable แล้ว merge dev → main
- **ทำไมใช้ localISO() แทน toISOString()**: toISOString() คืน UTC ซึ่งไทย (UTC+7) ทำให้วันที่เลื่อน -1 วันช่วงเที่ยงคืน-ตี 7 — ใช้ getFullYear/getMonth/getDate ซึ่งเป็น local time ของ browser แทน
- **ทำไม selection ใช้ `_sbId` ไม่ใช่ array index**: `db.items` ถูก replace ทุก 30 วิจาก auto-refresh. ถ้ามีใคร add/delete item ระหว่างนั้น index เพี้ยน → toggleItem ชี้ผิด row → "เลือกชิ้นงานก่อน" toast ทั้งที่ user เลือกแล้ว. UUID ของ Supabase เป็น stable key
- **ทำไม QC Pass/Fail ไม่เขียน DB ทันที**: ให้ consistency กับ status อื่น (รับของ/ผลิต/ส่ง) ที่ตั้ง staged state แล้ว commit ผ่าน "บันทึก" bar. Pass/Fail เป็นแค่ decision stage + ตัวเลือก reason (ถ้า Fail); saveUpdate เป็น single commit path — ลด race condition + ง่ายต่อการ undo
- **ทำไม "ปิด PO" ใช้ MAX(sent_date) แทน column `archived_at`**: หลีกเลี่ยง schema change. Semantic ตรงกว่า — "ปิด PO" คือตอนของชิ้นสุดท้ายออก ไม่ใช่ตอน admin กดปุ่ม archive (อาจช้ากว่าเป็นสัปดาห์). Derived data > stored data ที่มีโอกาส de-sync
- **ทำไม tab bar ใช้ CSS `order` balance รอบ primary**: `display:none` ทำให้ flex sibling ขยายเติมที่ → primary + ถูก push ไปขวา. Alternative `visibility:hidden` ทำให้เหลือ slot ว่างทางขวา. การ compute `order` ใน JS ให้ non-primary tabs แบ่งซ้าย/ขวา รอบ primary = ไม่มี gap, ไม่ใช้ magic pixel, responsive

## Context ธุรกิจ
- โรงงานพ่นสี ABS/PP ชิ้นส่วนยานยนต์
- ปริมาณงาน ~2,000-3,000 ชิ้น/เดือน
- ใช้งานภายในออฟฟิศ + ลูกน้อง
- พนักงานประจำ 2-3 จุด: จุดรับของ, จุด QC/ผลิต, จุดส่งของ
- เจ้าของ (toun) = Admin เห็นทุกอย่าง
