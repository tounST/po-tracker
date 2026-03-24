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
| **Stack** | GitHub Pages + Google Apps Script + Google Sheets |
| **Branch main** | v4.9-REWORK-TOGGLE — version ที่ใช้งานจริง |
| **Branch dev** | สำหรับพัฒนาต่อ — merge เข้า main เมื่อพร้อม |
| **GAS URL** | https://script.google.com/macros/s/AKfycbxIJ5kQPLI_zbRpf7eIDaADs68jBaY8IZLn5IkqeHOrkIGqD_Tz1lAUa5EXQbbdGNGU/exec |
| **GAS Version** | v4.6-REWORK-FLAG-2026-03-24 |

## ไฟล์สำคัญ (อยู่ใน repo root)
| ไฟล์ | หน้าที่ |
|---|---|
| `po-mobile.html` | แอปหลัก — single-file PWA ทั้ง HTML/CSS/JS |
| `sw.js` | Service Worker — cache v5 + offline |
| `manifest.json` | PWA — install เป็นแอปบนมือถือได้ |
| `po-tracker-gas.js` | GAS backend code — copy วางใน Apps Script Editor |
| `gas-code-to-paste.txt` | สำเนาของ po-tracker-gas.js สำหรับ copy วาง |

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

## 🗺️ แผนพัฒนา (Development Roadmap)

### ระดับ 1 — โหมดจุดงาน (ทำถัดไป ⭐)
**เป้าหมาย:** ลูกน้องเปิดแอป → เลือกจุดงาน → เห็นเฉพาะงานที่เกี่ยวข้อง
- หลัง login เลือก: 📥 จุดรับของ | 🔄 จุด QC/ผลิต | 📦 จุดส่งของ | 👑 Admin
- แต่ละจุดเห็นเฉพาะ tab/ฟีเจอร์ที่จำเป็น
- ไม่ต้องเปลี่ยน stack — แก้ใน po-mobile.html เดิม
- **ทำใน branch dev** → merge เข้า main เมื่อพร้อม

### ระดับ 2 — User Account + Activity Log (เมื่อพร้อม)
- เพิ่ม sheet "👤 USERS" ใน Google Sheet (Username, PIN, Role, Station)
- Login ด้วย ชื่อ + PIN 4 ตัว
- เพิ่ม sheet "📝 LOG" เก็บว่า ใคร ทำอะไร เมื่อไหร่
- แต่ละคนเห็นเฉพาะงานของจุดตัวเอง

### ระดับ 3 — Migrate ไป Supabase (ระยะยาว เมื่อธุรกิจโต)
- PostgreSQL database + Authentication จริง
- Row Level Security + Realtime sync
- รองรับ mobile app จริง, 100+ users

## Architecture & Decision Log
- **ทำไมใช้ JSONP → fetch + credentials:omit**: Chrome ส่ง Google session cookie กับ JSONP → GAS redirect loop
- **ทำไมใช้ GitHub Pages + GAS**: toun ไม่มี server, ไม่มี budget — ใช้ฟรีทั้งหมด
- **Archive logic**: archive ตามเดือนที่ PO Complete, PO ที่คาบเกี่ยวเดือนให้ค้างไว้จนกว่าจะ Complete
- **SHA-256 password**: เดิมเป็น plain text → แก้เป็น hash แล้ว
- **กลับมาแก้ไข = toggle flag**: ไม่ใช่สถานะแยก เพราะต้องดูได้ว่าของที่ตีกลับมาอยู่ขั้นตอนไหนแล้ว
- **Branch strategy**: main = production (save slot 1), dev = ทดลอง (save slot 2), merge เมื่อพร้อม
- **GAS deploy flow**: แก้โค้ด → วาง code ทับใน Apps Script Editor → New Deployment → copy URL ใหม่ → อัพเดท HARDCODED_GAS_URL ใน po-mobile.html

## Context ธุรกิจ
- โรงงานพ่นสี ABS/PP ชิ้นส่วนยานยนต์
- ปริมาณงาน ~2,000-3,000 ชิ้น/เดือน
- ใช้งานภายในออฟฟิศ + ลูกน้อง
- พนักงานประจำ 2-3 จุด: จุดรับของ, จุด QC/ผลิต, จุดส่งของ
- เจ้าของ (toun) = Admin เห็นทุกอย่าง
