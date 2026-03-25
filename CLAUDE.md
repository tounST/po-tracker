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

## 🗺️ แผนพัฒนา (Development Roadmap)

### Phase 2A — โหมดจุดงาน + Partial Update (✅ เสร็จแล้ว)
- ✅ โหมดจุดงาน — role/station-based access control
- ✅ Partial Update — Supabase update ทีละ row (ไม่ overwrite ทั้ง sheet)

### Phase 2B — Migrate ไป Supabase (✅ เสร็จแล้ว)
- ✅ สร้าง Supabase project + tables + ย้ายข้อมูล
- ✅ แก้ po-mobile.html ต่อ Supabase แทน GAS (supabase-js client)
- ✅ PIN login + User account + Activity Log
- ✅ Role & Permission system + User Management CRUD
- ✅ QC Inspection + Defect tracking
- ✅ Archive: เอากลับ + ลบถาวร

### Phase 3 — ฟีเจอร์ธุรกิจ (ทำถัดไป ⭐ เพิ่มได้เรื่อยๆ)
- TODO: โหมดจุดงาน UI จริง — หลัง login แต่ละ station เห็นเฉพาะ tab/ฟีเจอร์ที่จำเป็น
- TODO: ระบบสต๊อกวัตถุดิบ/สี (เพิ่ม table ใน Supabase)
- TODO: ระบบคิดต้นทุน (SQL คำนวณได้เลย)
- TODO: Line แจ้งเตือน (Supabase Edge Functions + Webhook)
- TODO: เชื่อม n8n workflow (REST API พร้อมใช้)
- TODO: Dashboard สรุปยอดผลิต/ส่ง (SQL query เร็ว)

### Phase 3 — ฟีเจอร์ธุรกิจ (หลังย้าย Supabase แล้ว เพิ่มได้เรื่อยๆ)
- ระบบสต๊อกวัตถุดิบ/สี (เพิ่ม table ใน Supabase)
- ระบบคิดต้นทุน (SQL คำนวณได้เลย)
- Line แจ้งเตือน (Supabase Edge Functions + Webhook)
- เชื่อม n8n workflow (REST API พร้อมใช้)
- Dashboard สรุปยอดผลิต/ส่ง (SQL query เร็ว)

### Phase 4 — Scale Up (เมื่อธุรกิจโตจริง)
- Mobile app จริง (React Native / Flutter)
- Row Level Security (แต่ละคนเห็นเฉพาะข้อมูลที่ควรเห็น)
- Realtime sync (เหมือน Google Docs — ทุกคนเห็นการเปลี่ยนแปลงทันที)
- รองรับ 100+ users

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

## Context ธุรกิจ
- โรงงานพ่นสี ABS/PP ชิ้นส่วนยานยนต์
- ปริมาณงาน ~2,000-3,000 ชิ้น/เดือน
- ใช้งานภายในออฟฟิศ + ลูกน้อง
- พนักงานประจำ 2-3 จุด: จุดรับของ, จุด QC/ผลิต, จุดส่งของ
- เจ้าของ (toun) = Admin เห็นทุกอย่าง
